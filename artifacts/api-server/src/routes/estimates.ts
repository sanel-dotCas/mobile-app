import { Router } from "express";
import OpenAI from "openai";
import { db, dmsAccountTypesTable, estimateSubmissionsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

interface AnalyzeRequestBody {
  vehicleInfo: string;
  damageNotes: string;
  imagesBase64?: string[];
}

const SCHEMA_DESCRIPTION = `Return a JSON array of repair estimate lines. Each element must follow this exact shape:
{
  "type": "labor" | "part" | "material",
  "laborCategory": "body" | "refinish" | "mechanical" | "frame" | "glass" | "electrical" | "trim" | "other",  // REQUIRED when type is "labor"
  "description": "string — specific operation name",
  "hours": number,      // labor only — use industry flat-rate hours
  "quantity": number,   // parts/materials only
  "unitPrice": number,
  "total": number
}

Labor category definitions:
- "body"       — Panel repair, straightening, dent removal, sectioning
- "refinish"   — Painting, primer, clear coat, blending, prep
- "mechanical" — Engine, suspension, brakes, drivetrain, cooling
- "frame"      — Structural/chassis repair, rail straightening, alignment
- "glass"      — Windshield, windows, ADAS camera recalibration
- "electrical" — Wiring, sensors, ECU, lighting electronics
- "trim"       — Interior/exterior plastic trim, mouldings, badges
- "other"      — Anything that does not fit the above

Include:
- All labour operations grouped by their correct category with realistic flat-rate hours
- All required OEM replacement parts with current market pricing
- All paint materials, consumables, and sundries

Return ONLY the JSON array — no markdown, no commentary.`;

const DEFAULT_ACCOUNT_TYPES = [
  { id: 1, name: "Customer Pay", code: "CP", displayOrder: 1, isActive: true },
  { id: 2, name: "Warranty",     code: "WR", displayOrder: 2, isActive: true },
  { id: 3, name: "Internal",     code: "IN", displayOrder: 3, isActive: true },
  { id: 4, name: "Sublet",       code: "SL", displayOrder: 4, isActive: true },
];

router.get("/estimates/account-types", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(dmsAccountTypesTable)
      .where(eq(dmsAccountTypesTable.isActive, true))
      .orderBy(asc(dmsAccountTypesTable.displayOrder));
    res.json(rows.length > 0 ? rows : DEFAULT_ACCOUNT_TYPES);
  } catch (err) {
    req.log.error(err, "Failed to fetch account types");
    res.json(DEFAULT_ACCOUNT_TYPES);
  }
});

router.post("/estimates/analyze", async (req, res) => {
  const { vehicleInfo, damageNotes, imagesBase64 } = req.body as AnalyzeRequestBody;

  if (!vehicleInfo || !damageNotes) {
    res.status(400).json({ error: "vehicleInfo and damageNotes are required" });
    return;
  }

  const systemPrompt = `You are an expert automotive damage estimator working for a Dealer Management System (DMS).
Your job is to produce detailed, accurate repair estimates based on vehicle damage photos and notes.
Always respond with ONLY a valid JSON array of estimate lines. No preamble, no explanation, no markdown.`;

  const validImages = (imagesBase64 ?? []).filter(Boolean);

  const userContent: OpenAI.ChatCompletionMessageParam["content"] = validImages.length > 0
    ? [
        ...validImages.map((b64) => ({
          type: "image_url" as const,
          image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" as const },
        })),
        {
          type: "text" as const,
          text: `Vehicle: ${vehicleInfo}\n\nDMS Damage Notes: ${damageNotes}\n\nAnalyse the damage visible in the ${validImages.length > 1 ? `${validImages.length} photos` : "photo"} combined with the notes above.\n\n${SCHEMA_DESCRIPTION}`,
        },
      ]
    : `Vehicle: ${vehicleInfo}\n\nDMS Damage Notes: ${damageNotes}\n\nBased on the damage description, generate a detailed repair estimate.\n\n${SCHEMA_DESCRIPTION}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "[]";
    const lines: unknown[] = JSON.parse(jsonStr);

    const VALID_CATEGORIES = ["body","refinish","mechanical","frame","glass","electrical","trim","other"];

    const validated = (lines as Array<Record<string, unknown>>).map((l, i) => ({
      id: `ai-${Date.now()}-${i}`,
      type: l.type ?? "labor",
      laborCategory: l.type === "labor"
        ? (VALID_CATEGORIES.includes(String(l.laborCategory)) ? l.laborCategory : "other")
        : undefined,
      description: String(l.description ?? ""),
      hours: typeof l.hours === "number" ? l.hours : undefined,
      quantity: typeof l.quantity === "number" ? l.quantity : undefined,
      unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : 0,
      total: typeof l.total === "number" ? l.total : 0,
      aiGenerated: true,
      operation: typeof l.operation === "string" ? l.operation : null,
      accountType: typeof l.accountType === "string" ? l.accountType : null,
    }));

    res.json({ lines: validated });
  } catch (err) {
    req.log.error(err, "AI estimate analysis failed");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

router.post("/estimates/submit", async (req, res) => {
  const { estimateId, estimateNo, vehicle, customer, serviceAdvisor, odometer, lines } = req.body as {
    estimateId: string;
    estimateNo: string;
    vehicle: string;
    customer?: string;
    serviceAdvisor?: string;
    odometer?: string;
    lines: Array<{
      id: string;
      type: string;
      laborCategory?: string;
      description: string;
      hours?: number;
      quantity?: number;
      unitPrice: number;
      total: number;
      operation?: string | null;
      accountType?: string | null;
    }>;
  };

  if (!estimateId || !estimateNo || !vehicle || !Array.isArray(lines)) {
    res.status(400).json({ error: "estimateId, estimateNo, vehicle, and lines are required" });
    return;
  }

  req.log.info(
    { estimateId, estimateNo, vehicle, customer, serviceAdvisor, odometer, lineCount: lines.length },
    "DMS estimate submission received"
  );

  const candidateRoNumber = `RO-${Date.now().toString(36).toUpperCase()}`;

  await db
    .insert(estimateSubmissionsTable)
    .values({ estimateId, dmsRoNumber: candidateRoNumber })
    .onConflictDoNothing();

  const [submission] = await db
    .select()
    .from(estimateSubmissionsTable)
    .where(eq(estimateSubmissionsTable.estimateId, estimateId))
    .limit(1);

  const roNumber = submission.dmsRoNumber;
  const isNew = roNumber === candidateRoNumber;

  if (isNew) {
    lines.forEach((line, i) => {
      req.log.info(
        {
          lineIndex: i,
          type: line.type,
          laborCategory: line.laborCategory ?? null,
          description: line.description,
          operation: line.operation ?? null,
          accountType: line.accountType ?? null,
          total: line.total,
        },
        "DMS estimate line"
      );
    });
    req.log.info({ estimateId, dmsRoNumber: roNumber }, "DMS estimate submission persisted");
  } else {
    req.log.info({ estimateId, dmsRoNumber: roNumber }, "Duplicate DMS submission — returning existing RO number");
  }

  res.json({
    success: true,
    dmsRoNumber: roNumber,
    message: isNew
      ? `Estimate ${estimateNo} submitted to DMS. Repair Order ${roNumber} created.`
      : `Estimate ${estimateNo} was already submitted to DMS. Repair Order ${roNumber} already exists.`,
  });
});

export default router;
