import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission, getObjectAclPolicy } from "../lib/objectAcl";
import { requireMobileAuth, type MobileTokenPayload } from "../lib/authMiddleware";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

type AuthedRequest = Request & { mobileSession: MobileTokenPayload };

// ── Pending-upload registry ───────────────────────────────────────────────────
// When a signed upload URL is minted, the objectPath is bound to the calling
// user. The confirm endpoint verifies membership before setting the ACL,
// preventing any other authenticated user from claiming ownership of an
// arbitrary path (IDOR/ACL takeover).
//
// NOTE: The pending entry is deleted only AFTER a successful ACL write so that
// transient errors (e.g. object not yet visible in GCS) do not prevent the
// client from retrying confirm. TTL matches the signed PUT URL lifetime (900 s).
const PENDING_TTL_MS = 15 * 60 * 1000; // 15 minutes
const pendingUploads = new Map<string, { userCode: string; expiresAt: number }>();

function registerPendingUpload(objectPath: string, userCode: string): void {
  prunePendingUploads();
  pendingUploads.set(objectPath, { userCode, expiresAt: Date.now() + PENDING_TTL_MS });
}

/**
 * Verify that objectPath was minted for userCode and has not expired.
 * Does NOT remove the entry — call releasePendingUpload() after the ACL write
 * succeeds so the client can retry confirm on transient failure.
 */
function verifyPendingUpload(objectPath: string, userCode: string): boolean {
  prunePendingUploads();
  const entry = pendingUploads.get(objectPath);
  return !!(entry && entry.userCode === userCode && entry.expiresAt >= Date.now());
}

function releasePendingUpload(objectPath: string): void {
  pendingUploads.delete(objectPath);
}

function prunePendingUploads(): void {
  const now = Date.now();
  for (const [path, entry] of pendingUploads) {
    if (entry.expiresAt < now) {
      pendingUploads.delete(path);
    }
  }
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * The returned objectPath is registered in the pending-upload registry,
 * bound to the calling user. After the direct GCS upload completes, the client
 * must call POST /storage/uploads/confirm (within 15 minutes) to set ownership.
 *
 * Requires a cryptographically-verified mobile session (x-mobile-session header).
 */
router.post("/storage/uploads/request-url", requireMobileAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const { userCode } = (req as AuthedRequest).mobileSession;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    registerPendingUpload(objectPath, userCode);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/uploads/confirm
 *
 * Called by the client after a successful direct GCS upload.
 * Verifies that the objectPath was minted by the calling user (via the
 * pending-upload registry) and that no ACL has been set yet (idempotent if
 * called multiple times — 409 after first success). The pending entry is
 * released only after a successful ACL write so callers may retry on
 * transient GCS errors without losing their claim.
 *
 * Body: { objectPath: string }  — the /objects/... path returned by request-url
 *
 * Requires a cryptographically-verified mobile session (x-mobile-session header).
 */
router.post("/storage/uploads/confirm", requireMobileAuth, async (req: Request, res: Response) => {
  const { objectPath } = req.body as { objectPath?: string };
  if (!objectPath || typeof objectPath !== "string") {
    res.status(400).json({ error: "objectPath is required" });
    return;
  }

  const { userCode } = (req as AuthedRequest).mobileSession;

  if (!verifyPendingUpload(objectPath, userCode)) {
    res.status(403).json({ error: "Forbidden: no pending upload for this path and caller" });
    return;
  }

  try {
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const existingAcl = await getObjectAclPolicy(objectFile);
    if (existingAcl !== null) {
      // Already confirmed (idempotent): release pending entry if still present.
      releasePendingUpload(objectPath);
      res.status(409).json({ error: "Object already confirmed" });
      return;
    }

    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: userCode,
      // "public" visibility means any authenticated caller may read — the
      // endpoint still requires requireMobileAuth, so anonymous access is
      // blocked. This allows supervisors and other technicians in the same
      // inspection/job workflow to view attachment photos.
      visibility: "public",
    });

    // Release pending entry only after the ACL write succeeds so a transient
    // failure above does not permanently invalidate the client's claim.
    releasePendingUpload(objectPath);

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found during upload confirm — client may retry");
      res.status(404).json({ error: "Object not found — upload may not have completed yet" });
      return;
    }
    req.log.error({ err: error }, "Error confirming upload ACL");
    res.status(500).json({ error: "Failed to confirm upload" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 *
 * Requires a cryptographically-verified mobile session (x-mobile-session header).
 *
 * Authorization: ACL policy on the object is enforced using the verified caller
 * identity (userCode). Objects without an ACL policy (uploaded before the
 * confirm-flow was introduced) fall through to a compatibility path that allows
 * any authenticated caller to read — this preserves existing inspection
 * attachment access and should be removed once all legacy objects are migrated.
 */
router.get("/storage/objects/*path", requireMobileAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const { userCode } = (req as AuthedRequest).mobileSession;
    const aclPolicy = await getObjectAclPolicy(objectFile);

    if (aclPolicy === null) {
      // Legacy compatibility: object has no ACL metadata (pre-migration).
      // Allow any authenticated caller to read. Remove this branch once all
      // pre-existing objects have been confirmed/backfilled with ACL policies.
      req.log.warn({ objectPath }, "Serving legacy object without ACL to authenticated caller");
    } else {
      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId: userCode,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
