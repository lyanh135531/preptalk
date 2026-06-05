import type { InterviewLanguage, InterviewTurn, Question } from "@preptalk/shared";

type StartPromptInput = {
  readonly candidateName: string;
  readonly language: InterviewLanguage;
  readonly role: string;
};

type SuggestPromptInput = {
  readonly language: InterviewLanguage;
  readonly role: string;
  readonly question: Question;
  readonly history: readonly InterviewTurn[];
};

type AnswerReviewPromptInput = {
  readonly candidateName: string;
  readonly language: InterviewLanguage;
  readonly role: string;
  readonly question: Question;
  readonly transcript: string;
  readonly history: readonly InterviewTurn[];
  readonly currentQuestionNumber: number;
  readonly maxQuestions: number;
};

const languageNameByCode: Record<InterviewLanguage, string> = {
  vi: "Vietnamese",
  en: "English"
};

export const buildStartMessages = (input: StartPromptInput) => [
  {
    role: "system" as const,
    content: buildSystemInstruction(input.language)
  },
  {
    role: "user" as const,
    content: [
      `Candidate: ${input.candidateName}`,
      `Interview language: ${languageNameByCode[input.language]}`,
      `Target role: ${input.role}`,
      "Create the first interview question.",
      "The first question must be practical, role-specific, concise, and suitable for a spoken interview.",
      "Do not include greetings. Do not include explanations outside the JSON response."
    ].join("\n")
  }
];

export const buildSuggestMessages = (input: SuggestPromptInput) => [
  {
    role: "system" as const,
    content: buildSystemInstruction(input.language)
  },
  {
    role: "user" as const,
    content: [
      `Interview language: ${languageNameByCode[input.language]}`,
      `Target role: ${input.role}`,
      `Current question: ${input.question.text}`,
      "History:",
      formatHistory(input.history),
      "Write a natural speakable answer the candidate can practice aloud.",
      "Keep it realistic for an interview. Avoid sounding memorized.",
      "Return only JSON."
    ].join("\n")
  }
];

export const buildAnswerReviewMessages = (input: AnswerReviewPromptInput) => [
  {
    role: "system" as const,
    content: buildSystemInstruction(input.language)
  },
  {
    role: "user" as const,
    content: [
      `Candidate: ${input.candidateName}`,
      `Interview language: ${languageNameByCode[input.language]}`,
      `Target role: ${input.role}`,
      `Question ${String(input.currentQuestionNumber)} of ${String(input.maxQuestions)}: ${input.question.text}`,
      `Transcript from speech-to-text: ${input.transcript}`,
      "Previous interview history:",
      formatHistory(input.history),
      "Review only what the candidate actually said in the transcript.",
      "Correct spelling, grammar, wording, clarity, and role-content issues without inventing experience the candidate did not mention.",
      "For pronunciation, provide transcript-based hints only. Do not claim phoneme-level scoring.",
      "Use correctionSpans to reconstruct the corrected answer in order. Use neutral spans for unchanged text.",
      "All score fields must be integer percentages from 0 to 100, not 0 to 5 ratings.",
      "Decide whether the next question should be a follow-up, a new topic, or end.",
      input.currentQuestionNumber >= input.maxQuestions
        ? "This is the final allowed question. decision must be end."
        : "If decision is end, it means the interview is completed.",
      "Return only JSON."
    ].join("\n")
  }
];

export const buildNextQuestionMessages = (input: {
  readonly language: InterviewLanguage;
  readonly role: string;
  readonly history: readonly InterviewTurn[];
  readonly decision: string;
}) => [
  {
    role: "system" as const,
    content: buildSystemInstruction(input.language)
  },
  {
    role: "user" as const,
    content: [
      `Interview language: ${languageNameByCode[input.language]}`,
      `Target role: ${input.role}`,
      "Previous interview history:",
      formatHistory(input.history),
      `The previous question evaluation decided that the next step should be a: ${input.decision}`,
      input.decision === "follow_up"
        ? "Create a follow-up question digging deeper into the candidate's last answer."
        : "Create a new question on a different topic relevant to the target role.",
      "The question must be practical, concise, and suitable for a spoken interview.",
      "Do not include greetings. Return only JSON matching the schema."
    ].join("\n")
  }
];

const buildSystemInstruction = (language: InterviewLanguage): string => [
  "You are PrepTalk, a senior interview coach and professional interviewer.",
  `Respond in ${languageNameByCode[language]}.`,
  "Be direct, specific, and practical.",
  "Use structured JSON exactly matching the requested schema.",
  "Do not use markdown.",
  "Do not include private chain-of-thought or hidden reasoning."
].join("\n");

const formatHistory = (history: readonly InterviewTurn[]): string => {
  if (history.length === 0) {
    return "No previous answers.";
  }

  return history
    .map((turn: InterviewTurn, index: number) => [
      `${String(index + 1)}. Question: ${turn.question.text}`,
      `Transcript: ${turn.transcript}`,
      `Corrected answer: ${turn.correctedAnswer}`,
      `Key improvements: ${turn.feedback.improvements.join("; ")}`
    ].join("\n"))
    .join("\n\n");
};
