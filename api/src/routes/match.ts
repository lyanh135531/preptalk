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
      console.warn("match_openrouter_failed", { status: res.status, body: text });
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn("match_openrouter_error", { error: String(err) });
    return null;
  }
}

// ── Schemas ──

const cvExperienceSchema = z.object({
  role: z.string().min(1),
  duration: z.string().default(""),
  highlights: z.array(z.string()).default([]),
});

const cvEducationSchema = z.object({
  degree: z.string().default(""),
  school: z.string().default(""),
});

const cvAnalysisSchema = z.object({
  candidateName: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(cvExperienceSchema).default([]),
  education: z.array(cvEducationSchema).default([]),
  summary: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});

const jdAnalysisSchema = z.object({
  title: z.string().default(""),
  mustHaveSkills: z.array(z.string()).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  seniority: z.string().default(""),
  keyResponsibilities: z.array(z.string()).default([]),
  summary: z.string().default(""),
});

const matchSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  matchedSkills: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  focusAreas: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
});

const matchRequestSchema = z.object({
  cv: cvAnalysisSchema,
  jd: jdAnalysisSchema,
});

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = matchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid CV or JD data.", code: "INVALID_INPUT" });
    return;
  }

  const { cv, jd } = parsed.data;

  const messages = [
    {
      role: "system",
      content: [
        "You are an expert HR recruiter. Compare a candidate's CV against a job description.",
        "Return ONLY a JSON object with these fields:",
        "- matchScore: integer 0-100 (overall fit percentage)",
        "- matchedSkills: string[] (skills from CV that match JD requirements)",
        "- missingSkills: string[] (required skills from JD that are missing in CV)",
        "- focusAreas: string[] (3-5 topics the interviewer should focus on — mix of strengths to probe and gaps to uncover)",
        "- suggestedQuestions: string[] (3-5 interview questions tailored to this CV × JD match)",
        "",
        "Be honest and constructive. The goal is to help the candidate prepare.",
        "Return ONLY valid JSON. No markdown, no explanations.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "=== JOB DESCRIPTION ===",
        `Title: ${jd.title}`,
        `Seniority: ${jd.seniority}`,
        `Summary: ${jd.summary}`,
        `Must-have skills: ${jd.mustHaveSkills.join(", ")}`,
        `Nice-to-have: ${jd.niceToHaveSkills.join(", ")}`,
        `Key responsibilities: ${jd.keyResponsibilities.join("; ")}`,
        "",
        "=== CANDIDATE CV ===",
        `Name: ${cv.candidateName}`,
        `Summary: ${cv.summary}`,
        `Skills: ${cv.skills.join(", ")}`,
        `Experience: ${cv.experience.map(e => `${e.role} (${e.duration}) — ${e.highlights.join(", ")}`).join("; ")}`,
        `Education: ${cv.education.map(e => `${e.degree} — ${e.school}`).join("; ")}`,
        `Strengths: ${cv.strengths.join(", ")}`,
        `Gaps: ${cv.gaps.join(", ")}`,
      ].join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(messages, 0.4, 2000);
  if (!raw) {
    res.status(502).json({
      error: "The AI could not match CV to JD right now. Please try again.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  try {
    const parsedJson = JSON.parse(raw);
    const match = matchSchema.parse(parsedJson);
    res.json({ match });
  } catch {
    console.warn("match_invalid_ai_response", { raw: raw.substring(0, 300) });
    res.status(502).json({
      error: "The AI returned an invalid response. Please try again.",
      code: "AI_UNAVAILABLE",
    });
  }
});

export default router;
