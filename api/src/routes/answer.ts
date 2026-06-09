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

const languageName: Record<string, string> = { vi: "Vietnamese", en: "English" };

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

// Build a compact JSON schema example for the prompt
const answerSchemaExample = JSON.stringify({
  correctedAnswer: "<grammatically corrected version of transcript>",
  correctionSpans: [
    { text: "<the corrected text segment>", type: "<grammar|spelling|word_choice|clarity|content_gap|strong_point|neutral>" }
  ],
  issues: [
    { type: "<grammar|spelling|word_choice|clarity|content_gap|strong_point>", originalText: "<original text>", suggestedText: "<suggested replacement>", explanation: "<why>", severity: "<low|medium|high>" }
  ],
  grammarFeedback: ["<string 1>", "<string 2>"],
  contentFeedback: ["<string 1>", "<string 2>"],
  pronunciationHints: ["<string 1>", "<string 2>"],
  strengths: ["<string 1>", "<string 2>"],
  improvements: ["<string 1>", "<string 2>"],
  score: { communication: 80, roleRelevance: 75, structure: 70, languageAccuracy: 85, confidence: 78 },
  decision: "<follow_up|new_topic|end>",
  decisionReason: "<brief explanation>"
}, null, 2);

const buildSystemInstruction = (lang: string) => [
  "You are PrepTalk, an AI interview coach evaluating a candidate's spoken interview answer.",
  `Respond in ${languageName[lang] || "English"}.`,
  "",
  "CRITICAL RULES:",
  "1. Return ONLY a single valid JSON object. Never wrap in markdown or code blocks.",
  "2. You MUST include ALL required fields listed in the schema.",
  "3. The 'score' field MUST be an object with these 5 integer fields: communication, roleRelevance, structure, languageAccuracy, confidence. Values MUST be integers 0-100.",
  "4. Each correctionSpans item MUST have ONLY 'text' and 'type' fields.",
  "5. Each issues item MUST have ALL of: type, originalText, suggestedText, explanation, severity.",
  "",
  "Example response format:",
  answerSchemaExample,
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

router.post("/", async (req: Request, res: Response): Promise<void> => {
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
        `Evaluate this interview answer. Return ONLY valid JSON matching the exact schema from the system prompt.`,
        ``,
        `Job role: ${session.role}`,
        `Experience: ${session.yearsOfExperience}`,
        `Question: ${question.text}`,
        `Answer: ${trimmedTranscript}`,
        history.length > 0 ? `` : null,
        history.length > 0 ? `Recent history:` : null,
        history.length > 0 ? formatHistory(history) : null,
      ].filter(Boolean).join("\n"),
    },
  ];

  const raw = await fetchOpenRouter(
    messages,
    "answer_review_response",
    answerFeedbackJsonSchema,
    0.4,
    3000
  );

  if (!raw) {
    res.status(502).json({
      error: "The AI interviewer is unavailable right now. Please try again.",
      code: "AI_UNAVAILABLE",
    });
    return;
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(raw);
  } catch {
    // Try extracting JSON from markdown code blocks
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch?.[1]) {
      parsedRaw = JSON.parse(codeBlockMatch[1].trim());
    } else {
      // Try extracting raw JSON object from text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch?.[0]) {
        parsedRaw = JSON.parse(jsonMatch[0]);
      } else {
        console.warn("[openrouter] answer: cannot extract JSON from raw response", { raw: raw.substring(0, 300) });
        res.status(502).json({ error: "The AI interviewer returned an invalid response. Please try again.", code: "AI_UNAVAILABLE" });
        return;
      }
    }
  }

  try {
    const aiResponse = answerFeedbackSchema.parse(parsedRaw);
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
