import { z } from "zod";

export const predefinedRoles = [
  "Backend Engineer .NET",
  "AI Engineer",
  "Mobile Engineer",
  "Frontend Engineer",
  "QA/Tester",
  "Product Manager",
  "Marketing Specialist",
  "Account Executive",
  "Data Analyst",
  "DevOps/Cloud Engineer",
  "UI/UX Designer"
] as const;

export const interviewLanguageSchema = z.enum([
  "vi",
  "en"
]);

export const feedbackSpanTypeSchema = z.enum([
  "grammar",
  "spelling",
  "word_choice",
  "clarity",
  "content_gap",
  "strong_point",
  "neutral"
]);

export const feedbackSeveritySchema = z.enum([
  "low",
  "medium",
  "high"
]);

export const interviewDecisionSchema = z.enum([
  "follow_up",
  "new_topic",
  "end"
]);

export const apiErrorCodeSchema = z.enum([
  "AI_UNAVAILABLE",
  "CONFIG_MISSING",
  "RATE_LIMITED",
  "INVALID_INPUT",
  "SERVER_ERROR"
]);

export const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(8),
  category: z.string().min(1),
  rationale: z.string().min(1)
});

export const interviewSessionSchema = z.object({
  id: z.string().min(1),
  candidateName: z.string().min(1),
  language: interviewLanguageSchema,
  role: z.string().min(2),
  yearsOfExperience: z.string().default("0-1 years"),
  createdAt: z.string().datetime(),
  currentQuestionNumber: z.number().int().min(1),
  maxQuestions: z.number().int().min(1)
});

export const feedbackSpanSchema = z.object({
  text: z.string(),
  type: feedbackSpanTypeSchema
});

export const feedbackIssueTypeSchema = z.enum([
  "grammar",
  "spelling",
  "word_choice",
  "clarity",
  "content_gap",
  "strong_point"
]);

export const feedbackIssueSchema = z.object({
  type: feedbackIssueTypeSchema,
  originalText: z.string().min(1),
  suggestedText: z.string().min(1),
  explanation: z.string().min(1),
  severity: feedbackSeveritySchema
});

export const scoreSchema = z.object({
  communication: z.number().int().min(0).max(100),
  roleRelevance: z.number().int().min(0).max(100),
  structure: z.number().int().min(0).max(100),
  languageAccuracy: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100)
});

export const answerFeedbackSchema = z.object({
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
  decision: interviewDecisionSchema,
  decisionReason: z.string().min(1)
});

export const interviewTurnSchema = z.object({
  id: z.string().min(1),
  question: questionSchema,
  transcript: z.string(),
  correctedAnswer: z.string(),
  feedback: answerFeedbackSchema,
  answeredAt: z.string().datetime()
});

export const startInterviewRequestSchema = z.object({
  candidateName: z.string().trim().min(1).max(80),
  language: interviewLanguageSchema,
  role: z.string().trim().min(2).max(120),
  yearsOfExperience: z.string().default("0-1 years")
});

export const startInterviewResponseSchema = z.object({
  session: interviewSessionSchema,
  question: questionSchema
});

export const suggestAnswerRequestSchema = z.object({
  session: interviewSessionSchema,
  question: questionSchema,
  history: z.array(interviewTurnSchema).max(12)
});

export const suggestAnswerResponseSchema = z.object({
  suggestedAnswer: z.string().min(12),
  speakingTips: z.array(z.string().min(1))
});

export const answerPayloadSchema = z.object({
  session: interviewSessionSchema,
  question: questionSchema,
  history: z.array(interviewTurnSchema).max(12),
  transcript: z.string().trim().min(1).max(12000)
});

export const answerInterviewResponseSchema = z.object({
  session: interviewSessionSchema,
  turn: interviewTurnSchema
});

export const nextQuestionRequestSchema = z.object({
  session: interviewSessionSchema,
  history: z.array(interviewTurnSchema).max(12)
});

export const nextQuestionResponseSchema = z.object({
  session: interviewSessionSchema,
  question: questionSchema.nullable()
});

export const storedInterviewSchema = z.object({
  session: interviewSessionSchema,
  currentQuestion: questionSchema.nullable(),
  pendingNextQuestion: questionSchema.nullable(),
  history: z.array(interviewTurnSchema),
  updatedAt: z.string().datetime()
});

export const apiErrorResponseSchema = z.object({
  error: z.string().min(1),
  code: apiErrorCodeSchema,
  requestId: z.string().min(1).optional()
});

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  openRouterConfigured: z.boolean()
});

export type InterviewLanguage = z.infer<typeof interviewLanguageSchema>;
export type FeedbackSpanType = z.infer<typeof feedbackSpanTypeSchema>;
export type FeedbackSeverity = z.infer<typeof feedbackSeveritySchema>;
export type InterviewDecision = z.infer<typeof interviewDecisionSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type Question = z.infer<typeof questionSchema>;
export type InterviewSession = z.infer<typeof interviewSessionSchema>;
export type FeedbackSpan = z.infer<typeof feedbackSpanSchema>;
export type FeedbackIssue = z.infer<typeof feedbackIssueSchema>;
export type Score = z.infer<typeof scoreSchema>;
export type AnswerFeedback = z.infer<typeof answerFeedbackSchema>;
export type InterviewTurn = z.infer<typeof interviewTurnSchema>;
export type StartInterviewRequest = z.infer<typeof startInterviewRequestSchema>;
export type StartInterviewResponse = z.infer<typeof startInterviewResponseSchema>;
export type SuggestAnswerRequest = z.infer<typeof suggestAnswerRequestSchema>;
export type SuggestAnswerResponse = z.infer<typeof suggestAnswerResponseSchema>;
export type AnswerPayload = z.infer<typeof answerPayloadSchema>;
export type AnswerInterviewResponse = z.infer<typeof answerInterviewResponseSchema>;
export type NextQuestionRequest = z.infer<typeof nextQuestionRequestSchema>;
export type NextQuestionResponse = z.infer<typeof nextQuestionResponseSchema>;
export type StoredInterview = z.infer<typeof storedInterviewSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
