import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

interface AnalyzeRequestBody {
  vehicleInfo: string;
  damageNotes: string;
  imageBase64?: string;
}

router.post("/estimates/analyze", async (req, res) => {
  const { vehicleInfo, damageNotes, imageBase64 } = req.body as AnalyzeRequestBody;

  if (!vehicleInfo || !damageNotes) {
    res.status(400).json({ error: "vehicleInfo and damageNotes are required" });
    return;
  }

  const systemPrompt = `You are an expert automotive damage estimator working for a Dealer Management System (DMS).
Your job is to produce detailed, accurate repair estimates based on vehicle damage photos and notes.
Always respond with ONLY a valid JSON array of estimate lines. No preamble, no explanation, no markdown.`;

  const userContent: OpenAI.ChatCompletionMessageParam["content"] = imageBase64
    ? [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
        },
        {
          type: "text",
          text: `Vehicle: ${vehicleInfo}\n\nDMS Damage Notes: ${damageNotes}\n\nAnalyse the damage in the photo and the notes above. Return a JSON array of repair estimate lines. Each element must follow this exact shape:\n{\n  "type": "labor" | "part" | "material",\n  "description": "string",\n  "hours": number,      // labor only, omit for others\n  "quantity": number,  // parts/materials only, omit for labor\n  "unitPrice": number,\n  "total": number\n}\n\nInclude:\n- All labour operations with realistic flat-rate hours specific to this vehicle\n- All required OEM replacement parts with current market pricing\n- All paint materials, consumables, and sundries\n\nReturn ONLY the JSON array.`,
        },
      ]
    : `Vehicle: ${vehicleInfo}\n\nDMS Damage Notes: ${damageNotes}\n\nBased on the damage description, generate a detailed repair estimate. Return ONLY a JSON array of estimate lines:\n[{"type":"labor"|"part"|"material","description":"...","hours":number,"quantity":number,"unitPrice":number,"total":number}]`;

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

    const validated = (lines as Array<Record<string, unknown>>).map((l, i) => ({
      id: `ai-${Date.now()}-${i}`,
      type: l.type ?? "labor",
      description: String(l.description ?? ""),
      hours: typeof l.hours === "number" ? l.hours : undefined,
      quantity: typeof l.quantity === "number" ? l.quantity : undefined,
      unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : 0,
      total: typeof l.total === "number" ? l.total : 0,
      aiGenerated: true,
    }));

    res.json({ lines: validated });
  } catch (err) {
    req.log.error(err, "AI estimate analysis failed");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

export default router;
