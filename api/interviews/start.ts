import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { randomUUID } from "node:crypto";

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
      type: "json_schema",
      json_schema: { name: responseSchemaName, strict: true, schema: responseJsonSchema },
    },
  };

  try {
    const res = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://preptalk.vercel.app",
        "X-OpenRouter-Title": CONFIG.APP_TITLE,
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
    if (content) return content;
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
});

const startAiResponseSchema = z.object({ question: questionSchema });

// ── JSON Schema for OpenRouter ──

const questionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "text", "category", "rationale"],
  properties: {
    id: { type: "string" },
    text: { type: "string" },
    category: { type: "string" },
    rationale: { type: "string" },
  },
};

const startInterviewJsonSchema = {
  type: "object",
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

// ── Handler ──

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", code: "INVALID_INPUT" });
    return;
  }

  const parsed = startInterviewRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "INVALID_INPUT" });
    return;
  }

  const { candidateName, language, role, yearsOfExperience } = parsed.data;

  const messages = [
    { role: "system", content: buildSystemInstruction(language) },
    {
      role: "user",
      content: [
        `Candidate: ${candidateName}`,
        `Target role: ${role}`,
        `Years of experience: ${yearsOfExperience}`,
        "",
        "Create the FIRST interview question for this candidate.",
        "The question should be:",
        "- Practical and role-specific",
        "- Suitable for a spoken interview (something a human interviewer would ask)",
        "- Concise (1-2 sentences)",
        "- Tailored to the candidate's experience level",
        "",
        "Do NOT include greetings like 'Hello' or 'Welcome'.",
        "Do NOT write code or technical examples.",
        "Return only JSON with the question.",
      ].join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(
    messages,
    "interview_start_response",
    startInterviewJsonSchema,
    0.7,
    700
  );

  if (!raw) {
    res.status(502).json({
      error: "The AI interviewer is unavailable right now. Please try again.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  try {
    const aiResponse = startAiResponseSchema.parse(JSON.parse(raw));
    const question = {
      ...aiResponse.question,
      id: aiResponse.question.id.trim().length > 0 ? aiResponse.question.id : randomUUID(),
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
  } catch {
    res.status(502).json({
      error: "The AI interviewer returned an invalid response. Please try again.",
      code: "AI_UNAVAILABLE",
    });
  }
}
