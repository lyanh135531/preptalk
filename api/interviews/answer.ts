import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"] ?? "nvidia/nemotron-3-super-120b-a12b:free",
  APP_TITLE: "PrepTalk",
  MAX_QUESTIONS: 6,
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

  for (let attempt = 1; attempt <= 2; attempt++) {
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
        console.warn("openrouter_failed", { status: res.status, attempt, body: text });
        if (attempt === 2) return null;
        continue;
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (content) return content;
      if (attempt === 2) return null;
    } catch (err) {
      console.warn("openrouter_error", { attempt, error: String(err) });
      if (attempt === 2) return null;
    }
  }
  return null;
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
}).extend({ nextQuestion: z.union([questionSchema, z.null()]) });

const interviewTurnSchema = z.object({
  id: z.string().min(1),
  question: questionSchema,
  transcript: z.string(),
  correctedAnswer: z.string(),
  feedback: answerFeedbackSchema.omit({ nextQuestion: true }).extend({ decision: z.string(), decisionReason: z.string() }),
  answeredAt: z.string().datetime(),
});

const answerPayloadSchema = z.object({
  session: interviewSessionSchema,
  question: questionSchema,
  history: z.array(interviewTurnSchema).max(12),
  transcript: z.string().trim().min(1).max(12000),
});

// ── JSON Schema ──

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

const answerFeedbackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "correctedAnswer", "correctionSpans", "issues", "grammarFeedback",
    "contentFeedback", "pronunciationHints", "strengths", "improvements",
    "score", "decision", "decisionReason", "nextQuestion",
  ],
  properties: {
    correctedAnswer: { type: "string" },
    correctionSpans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "type"],
        properties: {
          text: { type: "string" },
          type: { type: "string", enum: ["grammar", "spelling", "word_choice", "clarity", "content_gap", "strong_point", "neutral"] },
        },
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "originalText", "suggestedText", "explanation", "severity"],
        properties: {
          type: { type: "string", enum: ["grammar", "spelling", "word_choice", "clarity", "content_gap", "strong_point"] },
          originalText: { type: "string" },
          suggestedText: { type: "string" },
          explanation: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    grammarFeedback: { type: "array", items: { type: "string" } },
    contentFeedback: { type: "array", items: { type: "string" } },
    pronunciationHints: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    score: {
      type: "object",
      additionalProperties: false,
      required: ["communication", "roleRelevance", "structure", "languageAccuracy", "confidence"],
      properties: {
        communication: { type: "integer", minimum: 0, maximum: 100 },
        roleRelevance: { type: "integer", minimum: 0, maximum: 100 },
        structure: { type: "integer", minimum: 0, maximum: 100 },
        languageAccuracy: { type: "integer", minimum: 0, maximum: 100 },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
    decision: { type: "string", enum: ["follow_up", "new_topic", "end"] },
    decisionReason: { type: "string" },
    nextQuestion: { anyOf: [questionJsonSchema, { type: "null" }] },
  },
};

// ── Prompts ──

const languageName: Record<string, string> = { vi: "Vietnamese", en: "English" };

const buildSystemInstruction = (lang: string) => [
  "You are PrepTalk, a senior interview coach and professional interviewer.",
  `Respond in ${languageName[lang] || "English"}.`,
  "Be direct, specific, and practical.",
  "Use structured JSON exactly matching the requested schema.",
  "Do not use markdown.",
  "Do not include private chain-of-thought or hidden reasoning.",
].join("\n");

const formatHistory = (history: Array<{ question: { text: string }; transcript: string; correctedAnswer: string; feedback: { improvements: string[] } }>): string => {
  if (history.length === 0) return "No previous answers.";
  return history
    .map((turn, i) => [
      `${i + 1}. Question: ${turn.question.text}`,
      `Transcript: ${turn.transcript}`,
      `Corrected answer: ${turn.correctedAnswer}`,
      `Key improvements: ${turn.feedback.improvements.join("; ")}`,
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
        `Candidate: ${session.candidateName}`,
        `Interview language: ${languageName[session.language] || "English"}`,
        `Target role: ${session.role}`,
        `Question ${session.currentQuestionNumber} of ${session.maxQuestions}: ${question.text}`,
        `Transcript from speech-to-text: ${trimmedTranscript}`,
        "Previous interview history:",
        formatHistory(history),
        "Review only what the candidate actually said in the transcript.",
        "Correct spelling, grammar, wording, clarity, and role-content issues without inventing experience the candidate did not mention.",
        "For pronunciation, provide transcript-based hints only. Do not claim phoneme-level scoring.",
        "Use correctionSpans to reconstruct the corrected answer in order. Use neutral spans for unchanged text.",
        "All score fields must be integer percentages from 0 to 100, not 0 to 5 ratings.",
        "Decide whether the next question should be a follow-up, a new topic, or end.",
        session.currentQuestionNumber >= session.maxQuestions
          ? "This is the final allowed question. decision must be end and nextQuestion must be null."
          : "If decision is follow_up or new_topic, nextQuestion must be a concise role-specific question.",
        "Return only JSON.",
      ].join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(
    messages,
    "answer_review_response",
    answerFeedbackJsonSchema,
    0.4,
    1800
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

    const nextQuestion = isFinalQuestion ? null : (aiResponse.nextQuestion ? { ...aiResponse.nextQuestion, id: aiResponse.nextQuestion.id.trim().length > 0 ? aiResponse.nextQuestion.id : randomUUID() } : null);
    const nextQuestionNumber = nextQuestion === null ? session.currentQuestionNumber : session.currentQuestionNumber + 1;

    const updatedSession = {
      ...session,
      currentQuestionNumber: nextQuestionNumber,
    };

    const turn = {
      id: randomUUID(),
      question,
      transcript: trimmedTranscript,
      correctedAnswer: aiResponse.correctedAnswer,
      feedback,
      answeredAt: new Date().toISOString(),
    };

    res.json({ session: updatedSession, turn, nextQuestion });
  } catch {
    res.status(502).json({
      error: "The AI interviewer returned an invalid response. Please try again.",
      code: "AI_UNAVAILABLE",
    });
  }
}
