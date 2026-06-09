import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"] ?? "openai/gpt-oss-20b:free",
  APP_TITLE: "PrepTalk",
  MAX_QUESTIONS: 999999,
} as const;

async function fetchOpenRouter(
  messages: { role: string; content: string }[],
  responseSchemaName: string,
  responseJsonSchema: object,
  temperature: number,
  maxTokens: number
): Promise<string | null> {
  const body = {
    model: CONFIG.CHAT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: {
      type: "json_object",
    },
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
      console.warn("openrouter_failed", { status: res.status, body: text });
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (content) {
      console.log("[openrouter] content received:", content.substring(0, 200));
      return content;
    }
    console.warn("[openrouter] empty content", { hasChoices: !!json.choices, firstChoice: json.choices?.[0] });
    return null;
  } catch (err) {
    console.warn("openrouter_error", { error: String(err) });
    return null;
  }
}

// ── Schemas ──

const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(8),
  category: z.string().min(1),
  rationale: z.string().min(1),
});

const startInterviewRequestSchema = z.object({
  candidateName: z.string().trim().min(1).max(80),
  language: z.enum(["vi", "en"]),
  role: z.string().trim().min(2).max(120),
  yearsOfExperience: z.string().default("0-1 years"),
  cvAnalysis: z.object({
    candidateName: z.string().default(""),
    skills: z.array(z.string()).default([]),
    experience: z.array(z.object({ role: z.string(), duration: z.string().default(""), highlights: z.array(z.string()).default([]) })).default([]),
    education: z.array(z.object({ degree: z.string().default(""), school: z.string().default("") })).default([]),
    summary: z.string().default(""),
    strengths: z.array(z.string()).default([]),
    gaps: z.array(z.string()).default([]),
  }).optional().nullable(),
  jdAnalysis: z.object({
    title: z.string().default(""),
    mustHaveSkills: z.array(z.string()).default([]),
    niceToHaveSkills: z.array(z.string()).default([]),
    seniority: z.string().default(""),
    keyResponsibilities: z.array(z.string()).default([]),
    summary: z.string().default(""),
  }).optional().nullable(),
  cvJdMatch: z.object({
    matchScore: z.number().int().min(0).max(100),
    matchedSkills: z.array(z.string()).default([]),
    missingSkills: z.array(z.string()).default([]),
    focusAreas: z.array(z.string()).default([]),
    suggestedQuestions: z.array(z.string()).default([]),
  }).optional().nullable(),
});

const startAiResponseSchema = z.object({
  question: z.union([
    questionSchema,
    z.string().min(8).transform((text) => ({
      id: `q-${Date.now()}`,
      text,
      category: "General",
      rationale: "Interview question",
    })),
  ]),
});

// ── JSON Schema for OpenRouter ──

const questionJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["id", "text", "category", "rationale"],
  properties: {
    id: { type: "string" as const },
    text: { type: "string" as const },
    category: { type: "string" as const },
    rationale: { type: "string" as const },
  },
};

const startInterviewJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["question"],
  properties: { question: questionJsonSchema },
};

// ── Prompts ──

const buildSystemInstruction = (lang: "vi" | "en") => [
  "You are PrepTalk, an AI interview coach helping job candidates practice spoken interviews.",
  `Respond in ${lang === "vi" ? "Vietnamese" : "English"}.`,
  "Generate realistic interview questions that a human interviewer would ask.",
  "Return only JSON matching the schema. No markdown, no code.",
].join("\n");

type StartAiResponse = z.infer<typeof startAiResponseSchema>;

const requestStartAiResponse = async (
  messages: { role: string; content: string }[]
): Promise<StartAiResponse | null> => {
  const raw = await fetchOpenRouter(
    messages,
    "interview_start_response",
    startInterviewJsonSchema,
    0.7, 3000
  );
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    console.log("[openrouter] parsed JSON:", JSON.stringify(parsed).substring(0, 200));
    return startAiResponseSchema.parse(parsed);
  } catch (e) {
    console.warn("[openrouter] parse failed", { error: String(e), raw: raw.substring(0, 300) });
    return null;
  }
};

// ── Handler ──

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = startInterviewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "INVALID_INPUT" });
    return;
  }

  const { candidateName, language, role, yearsOfExperience, cvAnalysis, jdAnalysis, cvJdMatch } = parsed.data;

  // Build enhanced context from CV/JD if available
  const contextLines: string[] = [
    `Candidate: ${candidateName}`,
    `Target role: ${role}`,
    `Years of experience: ${yearsOfExperience}`,
  ];

  if (cvAnalysis) {
    contextLines.push(
      "",
      "=== CANDIDATE CV ANALYSIS ===",
      cvAnalysis.candidateName ? `Name: ${cvAnalysis.candidateName}` : "",
      cvAnalysis.summary ? `Summary: ${cvAnalysis.summary}` : "",
      cvAnalysis.skills.length > 0 ? `Skills: ${cvAnalysis.skills.join(", ")}` : "",
      cvAnalysis.experience.length > 0 ? `Experience: ${cvAnalysis.experience.map(e => `${e.role} (${e.duration})`).join("; ")}` : "",
      cvAnalysis.strengths.length > 0 ? `Strengths: ${cvAnalysis.strengths.join(", ")}` : "",
      cvAnalysis.gaps.length > 0 ? `Gaps: ${cvAnalysis.gaps.join(", ")}` : "",
    );
  }

  if (jdAnalysis) {
    contextLines.push(
      "",
      "=== JOB DESCRIPTION ===",
      jdAnalysis.title ? `Title: ${jdAnalysis.title}` : "",
      jdAnalysis.summary ? `Summary: ${jdAnalysis.summary}` : "",
      jdAnalysis.mustHaveSkills.length > 0 ? `Must-have skills: ${jdAnalysis.mustHaveSkills.join(", ")}` : "",
      jdAnalysis.niceToHaveSkills.length > 0 ? `Nice-to-have: ${jdAnalysis.niceToHaveSkills.join(", ")}` : "",
      jdAnalysis.keyResponsibilities.length > 0 ? `Responsibilities: ${jdAnalysis.keyResponsibilities.join("; ")}` : "",
    );
  }

  if (cvJdMatch) {
    contextLines.push(
      "",
      "=== CV × JD MATCH ===",
      `Match score: ${cvJdMatch.matchScore}%`,
      cvJdMatch.matchedSkills.length > 0 ? `Matched skills: ${cvJdMatch.matchedSkills.join(", ")}` : "",
      cvJdMatch.missingSkills.length > 0 ? `Missing skills: ${cvJdMatch.missingSkills.join(", ")}` : "",
      cvJdMatch.focusAreas.length > 0 ? `Focus areas: ${cvJdMatch.focusAreas.join("; ")}` : "",
    );
  }

  const messages = [
    { role: "system", content: buildSystemInstruction(language) },
    {
      role: "user",
      content: [
        ...contextLines,
        "",
        "Create the FIRST interview question for this candidate.",
        "The question should be:",
        "- Practical and role-specific",
        "- Suitable for a spoken interview",
        "- Concise (1-2 sentences)",
        "- Tailored to the candidate's experience level",
        cvJdMatch ? "- Consider the CV×JD match: probe strengths and address gaps" : "",
        "",
        "Do NOT include greetings like 'Hello' or 'Welcome'.",
        "Do NOT write code or technical examples.",
        "Return only JSON with the question.",
      ].join("\n"),
    },
  ];

  const aiResult = await requestStartAiResponse(messages);

  if (!aiResult) {
    res.status(502).json({
      error: "The AI interviewer is unavailable right now. Please try again.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  const question = {
    ...aiResult.question,
    id: aiResult.question.id.trim().length > 0 ? aiResult.question.id : randomUUID(),
  };

  const session = {
    id: randomUUID(),
    candidateName,
    language,
    role,
    yearsOfExperience,
    createdAt: new Date().toISOString(),
    currentQuestionNumber: 1,
    maxQuestions: CONFIG.MAX_QUESTIONS,
  };

  res.json({ session, question });
});

export default router;
