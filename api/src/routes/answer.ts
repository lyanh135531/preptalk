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

const answerPayloadSchema = z.object({
  session: interviewSessionSchema,
  question: questionSchema,
  history: z.array(interviewTurnSchema).max(12),
  transcript: z.string().trim().min(1).max(12000),
});

const answerFeedbackJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: [
    "correctedAnswer", "correctionSpans", "issues", "grammarFeedback",
    "contentFeedback", "pronunciationHints", "strengths", "improvements",
    "score", "decision", "decisionReason",
  ],
  properties: {
    correctedAnswer: { type: "string" as const },
    correctionSpans: {
      type: "array" as const,
      items: {
        type: "object" as const,
        additionalProperties: false,
        required: ["text", "type"],
        properties: {
          text: { type: "string" as const },
          type: { type: "string" as const, enum: ["grammar", "spelling", "word_choice", "clarity", "content_gap", "strong_point", "neutral"] },
        },
      },
    },
    issues: {
      type: "array" as const,
      items: {
        type: "object" as const,
        additionalProperties: false,
        required: ["type", "originalText", "suggestedText", "explanation", "severity"],
        properties: {
          type: { type: "string" as const, enum: ["grammar", "spelling", "word_choice", "clarity", "content_gap", "strong_point"] },
          originalText: { type: "string" as const },
          suggestedText: { type: "string" as const },
          explanation: { type: "string" as const },
          severity: { type: "string" as const, enum: ["low", "medium", "high"] },
        },
      },
    },
    grammarFeedback: { type: "array" as const, items: { type: "string" as const } },
    contentFeedback: { type: "array" as const, items: { type: "string" as const } },
    pronunciationHints: { type: "array" as const, items: { type: "string" as const } },
    strengths: { type: "array" as const, items: { type: "string" as const } },
    improvements: { type: "array" as const, items: { type: "string" as const } },
    score: {
      type: "object" as const,
      additionalProperties: false,
      required: ["communication", "roleRelevance", "structure", "languageAccuracy", "confidence"],
      properties: {
        communication: { type: "integer" as const, minimum: 0, maximum: 100 },
        roleRelevance: { type: "integer" as const, minimum: 0, maximum: 100 },
        structure: { type: "integer" as const, minimum: 0, maximum: 100 },
        languageAccuracy: { type: "integer" as const, minimum: 0, maximum: 100 },
        confidence: { type: "integer" as const, minimum: 0, maximum: 100 },
      },
    },
    decision: { type: "string" as const, enum: ["follow_up", "new_topic", "end"] },
    decisionReason: { type: "string" as const },
  },
};

const languageName: Record<string, string> = { vi: "Vietnamese", en: "English" };

const buildSystemInstruction = (lang: string) => [
  "You are PrepTalk, an AI interview coach evaluating a candidate's spoken interview answer.",
  `Respond in ${languageName[lang] || "English"}.`,
  "Evaluate the candidate's transcript for grammar, content, clarity, and relevance.",
  "Return only structured JSON matching the schema. No markdown, no code, no explanations.",
].join("\n");

const MAX_HISTORY_TURNS = 3;

const formatHistory = (history: Array<{ question: { text: string }; transcript: string; correctedAnswer: string; feedback: { improvements: string[] } }>): string => {
  if (history.length === 0) return "No previous answers.";
  return history
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => [
      `Q: ${turn.question.text}`,
      `A: ${turn.transcript}`,
      `Key improvements: ${turn.feedback.improvements.slice(0, 3).join("; ")}`,
    ].join("\n"))
    .join("\n\n");
};

const router = Router();

router.post("/answer", async (req: Request, res: Response): Promise<void> => {
  const parsed = answerPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "INVALID_INPUT" });
    return;
  }

  const { session, question, history, transcript } = parsed.data;
  const trimmedTranscript = transcript.trim();

  if (trimmedTranscript.length === 0) {
    res.status(422).json({ error: "No speech was detected. Please answer again and speak clearly.", code: "INVALID_INPUT" });
    return;
  }

  const messages = [
    { role: "system", content: buildSystemInstruction(session.language) },
    {
      role: "user",
      content: [
        `Job role: ${session.role}`,
        `Candidate experience: ${session.yearsOfExperience}`,
        `Interview question: ${question.text}`,
        `Candidate's spoken answer (transcript): ${trimmedTranscript}`,
        "",
        "Recent interview history:",
        formatHistory(history),
        "",
        "Evaluate the candidate's spoken answer on these criteria (0-100 each):",
        "- communication: How clearly and fluently they expressed their ideas",
        "- roleRelevance: How relevant the answer is to the target role",
        "- structure: How well-organized the answer is",
        "- languageAccuracy: Grammar and vocabulary correctness",
        "- confidence: How confident and professional the tone is",
        "",
        "Also provide:",
        "- correctedAnswer: A grammatically corrected version of their transcript",
        "- correctionSpans: Mark specific corrections (grammar, spelling, word choice, clarity, content gaps, strong points)",
        "- issues: List specific issues with severity (low/medium/high)",
        "- grammarFeedback: Array of grammar feedback strings",
        "- contentFeedback: Array of content feedback strings",
        "- pronunciationHints: Array of pronunciation tips",
        "- strengths: Array of what the candidate did well",
        "- improvements: Array of areas to improve",
        "- decision: 'follow_up' to ask more on this topic, or 'new_topic' to move on",
        "- decisionReason: Brief explanation of the decision",
        "",
        "Do NOT write code. Do NOT write technical examples.",
        "Return only JSON.",
      ].join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(
    messages,
    "answer_review_response",
    answerFeedbackJsonSchema,
    0.4,
    800
  );

  if (!raw) {
    res.status(502).json({
      error: "The AI interviewer is unavailable right now. Please try again.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  try {
    const aiResponse = answerFeedbackSchema.parse(JSON.parse(raw));
    const isFinalQuestion = session.currentQuestionNumber >= session.maxQuestions;

    const feedback = {
      transcript: trimmedTranscript,
      correctedAnswer: aiResponse.correctedAnswer,
      correctionSpans: aiResponse.correctionSpans,
      issues: aiResponse.issues,
      grammarFeedback: aiResponse.grammarFeedback,
      contentFeedback: aiResponse.contentFeedback,
      pronunciationHints: aiResponse.pronunciationHints,
      strengths: aiResponse.strengths,
      improvements: aiResponse.improvements,
      score: aiResponse.score,
      decision: isFinalQuestion ? "end" as const : aiResponse.decision,
      decisionReason: aiResponse.decisionReason,
    };

    const turn = {
      id: randomUUID(),
      question,
      transcript: trimmedTranscript,
      correctedAnswer: aiResponse.correctedAnswer,
      feedback,
      answeredAt: new Date().toISOString(),
    };

    res.json({ session, turn });
  } catch {
    res.status(502).json({
      error: "The AI interviewer returned an invalid response. Please try again.",
      code: "AI_UNAVAILABLE",
    });
  }
});

export default router;
