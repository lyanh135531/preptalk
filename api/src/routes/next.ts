import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"] ?? "openai/gpt-oss-20b:free",
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
    if (content) return content;
    return null;
  } catch (err) {
    console.warn("openrouter_error", { error: String(err) });
    return null;
  }
}

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
  yearsOfExperience: z.string().default("0-1 years"),
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
  feedback: answerFeedbackSchema.extend({ decision: z.string(), decisionReason: z.string() }),
  answeredAt: z.string().datetime(),
});

const nextQuestionRequestSchema = z.object({
  session: interviewSessionSchema,
  history: z.array(interviewTurnSchema).max(12),
});

const nextAiResponseSchema = z.object({
  question: questionSchema,
});

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

const nextQuestionJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["question"],
  properties: { question: questionJsonSchema },
};

const languageName: Record<string, string> = { vi: "Vietnamese", en: "English" };

const buildSystemInstruction = (lang: string) => [
  "You are PrepTalk, an AI interview coach helping job candidates practice spoken interviews.",
  `Respond in ${languageName[lang] || "English"}.`,
  "Generate realistic interview questions that a human interviewer would ask.",
  "Return only JSON matching the schema. No markdown, no code.",
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

const router = Router();

router.post("/next", async (req: Request, res: Response): Promise<void> => {
  const parsed = nextQuestionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "INVALID_INPUT" });
    return;
  }

  const { session, history } = parsed.data;
  const lastTurn = history.length > 0 ? history[history.length - 1] : null;

  const isFinalQuestion = session.currentQuestionNumber >= session.maxQuestions;
  const isEndDecision = lastTurn !== null && lastTurn.feedback.decision === "end";

  if (isFinalQuestion || isEndDecision) {
    res.json({
      session,
      question: null,
    });
    return;
  }

  const decision = lastTurn !== null ? lastTurn.feedback.decision : "new_topic";

  const messages = [
    { role: "system", content: buildSystemInstruction(session.language) },
    {
      role: "user",
      content: [
        `Target role: ${session.role}`,
        `Candidate experience: ${session.yearsOfExperience}`,
        "",
        "Recent interview conversation:",
        formatHistory(history),
        "",
        `The previous answer evaluation decided the next step should be: ${decision}`,
        decision === "follow_up"
          ? "Create a follow-up question that digs deeper into the candidate's last answer."
          : "Create a new interview question on a different topic relevant to the role.",
        "",
        "The question must be:",
        "- Something a human interviewer would actually say aloud",
        "- Practical and role-specific",
        "- Concise (1-2 sentences)",
        "- Tailored to the candidate's experience level",
        "",
        "Do NOT write code. Do NOT write technical examples.",
        "Return only JSON with the question.",
      ].join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(
    messages,
    "interview_next_response",
    nextQuestionJsonSchema,
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
    const aiResponse = nextAiResponseSchema.parse(JSON.parse(raw));
    const nextQuestion = {
      ...aiResponse.question,
      id: aiResponse.question.id.trim().length > 0 ? aiResponse.question.id : randomUUID(),
    };

    const updatedSession = {
      ...session,
      currentQuestionNumber: session.currentQuestionNumber + 1,
    };

    res.json({ session: updatedSession, question: nextQuestion });
  } catch {
    res.status(502).json({
      error: "The AI interviewer returned an invalid response. Please try again.",
      code: "AI_UNAVAILABLE",
    });
  }
});

export default router;
