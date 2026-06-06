import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"] ?? "nvidia/nemotron-3-super-120b-a12b:free",
  APP_TITLE: "PrepTalk",
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

const interviewSessionSchema = z.object({
  id: z.string().min(1),
  candidateName: z.string().min(1),
  language: z.enum(["vi", "en"]),
  role: z.string().min(2),
  createdAt: z.string().datetime(),
  currentQuestionNumber: z.number().int().min(1),
  maxQuestions: z.number().int().min(1),
});

const feedbackSpanSchema = z.object({
  text: z.string(),
  type: z.enum(["grammar", "spelling", "word_choice", "clarity", "content_gap", "strong_point", "neutral"]),
});

const feedbackIssueSchema = z.object({
  type: z.enum(["grammar", "spelling", "word_choice", "clarity", "content_gap", "strong_point"]),
  originalText: z.string().min(1),
  suggestedText: z.string().min(1),
  explanation: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
});

const scoreSchema = z.object({
  communication: z.number().int().min(0).max(100),
  roleRelevance: z.number().int().min(0).max(100),
  structure: z.number().int().min(0).max(100),
  languageAccuracy: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
});

const answerFeedbackSchema = z.object({
  transcript: z.string(),
  correctedAnswer: z.string(),
  correctionSpans: z.array(feedbackSpanSchema),
  issues: z.array(feedbackIssueSchema),
  grammarFeedback: z.array(z.string().min(1)),
  contentFeedback: z.array(z.string().min(1)),
  pronunciationHints: z.array(z.string().min(1)),
  strengths: z.array(z.string().min(1)),
  improvements: z.array(z.string().min(1)),
  score: scoreSchema,
  decision: z.enum(["follow_up", "new_topic", "end"]),
  decisionReason: z.string().min(1),
});

const interviewTurnSchema = z.object({
  id: z.string().min(1),
  question: questionSchema,
  transcript: z.string(),
  correctedAnswer: z.string(),
  feedback: answerFeedbackSchema,
  answeredAt: z.string().datetime(),
});

const suggestAnswerRequestSchema = z.object({
  session: interviewSessionSchema,
  question: questionSchema,
  history: z.array(interviewTurnSchema).max(12),
});

const suggestAnswerResponseSchema = z.object({
  suggestedAnswer: z.string().min(12),
  speakingTips: z.array(z.string().min(1)),
});

// ── JSON Schema ──

const suggestAnswerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestedAnswer", "speakingTips"],
  properties: {
    suggestedAnswer: { type: "string" },
    speakingTips: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
  },
};

// ── Prompts ──

const languageName: Record<string, string> = { vi: "Vietnamese", en: "English" };

const buildSystemInstruction = (lang: string) => [
  "You are PrepTalk, a senior interview coach.",
  `Respond in ${languageName[lang] || "English"}.`,
  "Return only JSON matching the schema. No markdown.",
].join("\n");

const MAX_HISTORY_TURNS = 3;

const formatHistory = (history: Array<{ question: { text: string }; transcript: string; correctedAnswer: string; feedback: { improvements: string[] } }>): string => {
  if (history.length === 0) return "No previous answers.";
  return history
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => [
      `Q: ${turn.question.text}`,
      `A: ${turn.transcript}`,
    ].join("\n"))
    .join("\n\n");
};

// ── Handler ──

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", code: "INVALID_INPUT" });
    return;
  }

  const parsed = suggestAnswerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "INVALID_INPUT" });
    return;
  }

  const { session, question, history } = parsed.data;

  const messages = [
    { role: "system", content: buildSystemInstruction(session.language) },
    {
      role: "user",
      content: [
        `Role: ${session.role}`,
        `Question: ${question.text}`,
        "Recent history:",
        formatHistory(history),
        "Write a natural speakable answer. Keep it realistic. Return only JSON.",
      ].join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(
    messages,
    "suggest_answer_response",
    suggestAnswerJsonSchema,
    0.6,
    900
  );

  if (!raw) {
    res.status(502).json({
      error: "The AI interviewer is unavailable right now. Please try again.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  try {
    const aiResponse = suggestAnswerResponseSchema.parse(JSON.parse(raw));
    res.json(aiResponse);
  } catch {
    res.status(502).json({
      error: "The AI interviewer returned an invalid response. Please try again.",
      code: "AI_UNAVAILABLE",
    });
  }
}
