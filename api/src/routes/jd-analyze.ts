import { Router, Request, Response } from "express";
import { z } from "zod";

// ── Config ──
const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"] ?? "openai/gpt-oss-20b:free",
  APP_TITLE: "PrepTalk",
};

async function fetchOpenRouter(
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number
): Promise<string | null> {
  const body = {
    model: CONFIG.CHAT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" as const },
  };

  try {
    const res = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env["CLIENT_ORIGIN"] || "http://localhost:5173",
        "X-Title": CONFIG.APP_TITLE,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("jd_analyze_openrouter_failed", { status: res.status, body: text });
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn("jd_analyze_openrouter_error", { error: String(err) });
    return null;
  }
}

// ── Schemas ──

const jdAnalysisSchema = z.object({
  title: z.string().default(""),
  mustHaveSkills: z.array(z.string()).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  seniority: z.string().default(""),
  keyResponsibilities: z.array(z.string()).default([]),
  summary: z.string().default(""),
});

const analyzeJdRequestSchema = z.object({
  jdText: z.string().trim().min(20).max(20000),
});

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = analyzeJdRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide a job description (at least 20 characters).", code: "INVALID_INPUT" });
    return;
  }

  const { jdText } = parsed.data;
  const truncatedText = jdText.slice(0, 8000);

  const messages = [
    {
      role: "system",
      content: [
        "You are an expert HR recruiter. Analyze a job description and extract structured information.",
        "Return ONLY a JSON object with these fields:",
        "- title: string (job title, empty if not clear)",
        "- mustHaveSkills: string[] (hard requirements, technical skills, qualifications)",
        "- niceToHaveSkills: string[] (preferred/bonus skills)",
        "- seniority: string (Junior/Mid/Senior/Lead/Manager, or empty)",
        "- keyResponsibilities: string[] (3-6 main responsibilities)",
        "- summary: string (2-3 sentence summary of the role)",
        "",
        "If the JD is in Vietnamese, return field values in Vietnamese.",
        "If the JD is in English, return field values in English.",
        "Return ONLY valid JSON. No markdown, no explanations.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Analyze this job description:",
        "",
        "---",
        truncatedText,
        "---",
      ].join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(messages, 0.3, 1500);
  if (!raw) {
    res.status(502).json({
      error: "The AI could not analyze the job description right now. Please try again.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  try {
    const parsedJson = JSON.parse(raw);
    const jd = jdAnalysisSchema.parse(parsedJson);
    res.json({ jd });
  } catch {
    console.warn("jd_analyze_invalid_ai_response", { raw: raw.substring(0, 300) });
    res.status(502).json({
      error: "The AI could not understand the job description. Please try again.",
      code: "AI_UNAVAILABLE",
    });
  }
});

export default router;
