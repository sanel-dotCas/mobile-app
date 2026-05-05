import { type Request, type Response, type NextFunction } from "express";
import { verifyYardToken } from "../lib/yardSession";
import { verifyMobileToken } from "../lib/mobileSession";

export type YardPrincipal = {
  type: "yard";
  userId: number;
  username: string;
  role: string;
};

export type MobilePrincipal = {
  type: "mobile";
  userId: number;
  technicianName: string;
  userCode: string;
  role: string;
};

export type Principal = YardPrincipal | MobilePrincipal;

declare global {
  namespace Express {
    interface Locals {
      principal?: Principal;
    }
  }
}

/**
 * Validates an Authorization: Bearer token.
 * Accepts either a yard-web session token or a mobile session token.
 * On success, populates res.locals.principal.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);

  const yardPayload = verifyYardToken(token);
  if (yardPayload) {
    res.locals.principal = {
      type: "yard",
      userId: yardPayload.userId,
      username: yardPayload.username,
      role: yardPayload.role,
    };
    next();
    return;
  }

  const mobilePayload = verifyMobileToken(token);
  if (mobilePayload) {
    res.locals.principal = {
      type: "mobile",
      userId: mobilePayload.userId,
      technicianName: mobilePayload.technicianName,
      userCode: mobilePayload.userCode,
      role: mobilePayload.role,
    };
    next();
    return;
  }

  res.status(401).json({ error: "Invalid or expired session" });
}

/**
 * Requires a yard-web session (not a mobile session).
 * Mobile principals are rejected with 403.
 * Apply to routes that should only be accessible by yard web users.
 */
export function requireYardPrincipal(req: Request, res: Response, next: NextFunction): void {
  const principal = res.locals.principal;
  if (!principal || principal.type !== "yard") {
    res.status(403).json({ error: "Yard web session required" });
    return;
  }
  next();
}

/**
 * Requires a yard-web session with admin role.
 * Apply to routes that perform privileged mutations (user management, etc.).
 */
export function requireAdminRole(req: Request, res: Response, next: NextFunction): void {
  const principal = res.locals.principal;
  if (!principal || principal.type !== "yard" || principal.role !== "admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  next();
}

/**
 * Returns middleware that allows:
 *  - any yard-web principal (regardless of yard role), OR
 *  - a mobile principal whose mobileRole is in the provided list.
 *
 * Use this to gate operational mutations so that only the relevant
 * DMS roles (e.g. "technician", "supervisor", "parts", "estimator")
 * can perform them, while yard-web users always pass through.
 */
export function requireMobileRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const principal = res.locals.principal;
    if (!principal) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (principal.type === "yard") {
      next();
      return;
    }
    // Mobile principal — check role allowlist
    if (roles.includes(principal.role)) {
      next();
      return;
    }
    res.status(403).json({ error: `Access denied. Required mobile role(s): ${roles.join(", ")}` });
  };
}
