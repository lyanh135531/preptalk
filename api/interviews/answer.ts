import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"] ?? "nvidia/nemotron-3-super-120b-a12b:free",
  APP_TITLE: "PrepTalk",
  MAX_QUESTIONS: 999999,
} as const;

async function fetchOpenRouterStreaming(
  messages: { role: string; content: string }[],
  responseSchemaName: string,
  responseJsonSchema: object,
  temperature: number,
  maxTokens: number,
  onChunk: (text: string) => void
): Promise<string | null> {
  const body = {
    model: CONFIG.CHAT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
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
      console.warn("openrouter_stream_failed", { status: res.status, body: text });
      return null;
    }

    const reader = res.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            fullContent += chunk;
            onChunk(chunk);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    return fullContent || null;
  } catch (err) {
    console.warn("openrouter_stream_error", { error: String(err) });
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
    "score", "decision", "decisionReason",
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
  },
};

// ── Prompts ──

const languageName: Record<string, string> = { vi: "Vietnamese", en: "English" };

const buildSystemInstruction = (lang: string) => [
  "You are PrepTalk, a senior interview coach.",
  `Respond in ${languageName[lang] || "English"}.`,
  "Return only structured JSON matching the schema. No markdown, no explanations.",
].join("\n");

const MAX_HISTORY_TURNS = 3;

const formatHistory = (history: Array<{ question: { text: string }; transcript: string; correctedAnswer: string; feedback: { improvements: string[] } }>): string => {
  if (history.length === 0) return "No previous answers.";
  return history
    .slice(-MAX_HISTORY_TURNS)
    .map((turn, i) => [
      `Q: ${turn.question.text}`,
      `A: ${turn.transcript}`,
      `Key improvements: ${turn.feedback.improvements.slice(0, 3).join("; ")}`,
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
        `Role: ${session.role} | Experience: ${session.yearsOfExperience}`,
        `Q${session.currentQuestionNumber}: ${question.text}`,
        `Transcript: ${trimmedTranscript}`,
        "Recent history:",
        formatHistory(history),
        "Evaluate the transcript. Correct grammar, content, clarity. Score 0-100 per field. Decide: follow_up or new_topic (never end).",
        "Return only JSON.",
      ].join("\n"),
    },
  ];

  // Send streaming headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Transfer-Encoding", "chunked");

  let streamedContent = "";

  const raw = await fetchOpenRouterStreaming(
    messages,
    "answer_review_response",
    answerFeedbackJsonSchema,
    0.4,
    800,
    (chunk: string) => {
      streamedContent += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
  );

  if (!raw) {
    res.write(`data: ${JSON.stringify({ error: "The AI interviewer is unavailable right now. Please try again.", code: "AI_UNAVAILABLE" })}\n\n`);
    res.end();
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

    res.write(`data: ${JSON.stringify({ done: true, session, turn })}\n\n`);
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "The AI interviewer returned an invalid response. Please try again.", code: "AI_UNAVAILABLE" })}\n\n`);
    res.end();
  }
}
