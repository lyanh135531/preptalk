import type {
  AnswerFeedback,
  AnswerInterviewResponse,
  InterviewSession,
  InterviewTurn,
  Question,
  StartInterviewResponse,
  SuggestAnswerResponse
} from "@preptalk/shared";
import {
  answerFeedbackSchema,
  answerInterviewResponseSchema,
  answerPayloadSchema,
  questionSchema,
  startInterviewRequestSchema,
  startInterviewResponseSchema,
  suggestAnswerRequestSchema,
  suggestAnswerResponseSchema
} from "@preptalk/shared";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";

import { HttpRequestError } from "../errors.js";
import {
  answerFeedbackJsonSchema,
  startInterviewJsonSchema,
  suggestAnswerJsonSchema
} from "../json-schemas.js";
import type { OpenRouterClient } from "../open-router-client.js";
import {
  buildAnswerReviewMessages,
  buildStartMessages,
  buildSuggestMessages
} from "../prompts.js";

type InterviewRouterConfig = {
  readonly openRouterClient: OpenRouterClient;
  readonly maxQuestions: number;
};

const startAiResponseSchema = z.object({
  question: questionSchema
});

const answerReviewAiResponseSchema = answerFeedbackSchema.omit({
  transcript: true
}).extend({
  nextQuestion: questionSchema.nullable()
}).superRefine((value, context) => {
  if (value.decision !== "end" && value.nextQuestion === null) {
    context.addIssue({
      code: "custom",
      message: "nextQuestion is required when decision is follow_up or new_topic",
      path: [
        "nextQuestion"
      ]
    });
  }
});

export const createInterviewRouter = (config: InterviewRouterConfig): Router => {
  const router = Router();

  router.post("/start", async (request: Request, response: Response<StartInterviewResponse>) => {
    const parsedBody = startInterviewRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpRequestError(400, parsedBody.error.message);
    }

    const aiResponse = await config.openRouterClient.chatJson({
      routeName: "interview_start",
      messages: buildStartMessages(parsedBody.data),
      responseSchemaName: "interview_start_response",
      responseJsonSchema: startInterviewJsonSchema,
      validationSchema: startAiResponseSchema,
      temperature: 0.7,
      maxTokens: 700
    });

    const session: InterviewSession = {
      id: randomUUID(),
      candidateName: parsedBody.data.candidateName,
      language: parsedBody.data.language,
      role: parsedBody.data.role,
      createdAt: new Date().toISOString(),
      currentQuestionNumber: 1,
      maxQuestions: config.maxQuestions
    };

    const payload: StartInterviewResponse = {
      session,
      question: normalizeQuestion(aiResponse.question)
    };

    response.json(startInterviewResponseSchema.parse(payload));
  });

  router.post("/suggest", async (request: Request, response: Response<SuggestAnswerResponse>) => {
    const parsedBody = suggestAnswerRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new HttpRequestError(400, parsedBody.error.message);
    }

    const aiResponse = await config.openRouterClient.chatJson({
      routeName: "suggest_answer",
      messages: buildSuggestMessages({
        language: parsedBody.data.session.language,
        role: parsedBody.data.session.role,
        question: parsedBody.data.question,
        history: parsedBody.data.history
      }),
      responseSchemaName: "suggest_answer_response",
      responseJsonSchema: suggestAnswerJsonSchema,
      validationSchema: suggestAnswerResponseSchema,
      temperature: 0.6,
      maxTokens: 900
    });

    response.json(suggestAnswerResponseSchema.parse(aiResponse));
  });

  router.post("/answer", async (request: Request, response: Response<AnswerInterviewResponse>) => {
    const payload = parseAnswerPayload(request);
    const transcript = payload.transcript.trim();

    if (transcript.length === 0) {
      throw new HttpRequestError(422, "No speech was detected. Please answer again and speak clearly.");
    }

    const aiResponse = await config.openRouterClient.chatJson({
      routeName: "review_answer",
      messages: buildAnswerReviewMessages({
        candidateName: payload.session.candidateName,
        language: payload.session.language,
        role: payload.session.role,
        question: payload.question,
        transcript,
        history: payload.history,
        currentQuestionNumber: payload.session.currentQuestionNumber,
        maxQuestions: payload.session.maxQuestions
      }),
      responseSchemaName: "answer_review_response",
      responseJsonSchema: answerFeedbackJsonSchema,
      validationSchema: answerReviewAiResponseSchema,
      temperature: 0.4,
      maxTokens: 1800
    });

    const isFinalQuestion = payload.session.currentQuestionNumber >= payload.session.maxQuestions;
    const feedback: AnswerFeedback = answerFeedbackSchema.parse({
      ...aiResponse,
      transcript,
      decision: isFinalQuestion ? "end" : aiResponse.decision
    });
    const nextQuestion = isFinalQuestion ? null : normalizeNullableQuestion(aiResponse.nextQuestion);
    const nextQuestionNumber = nextQuestion === null
      ? payload.session.currentQuestionNumber
      : payload.session.currentQuestionNumber + 1;

    const session: InterviewSession = {
      ...payload.session,
      currentQuestionNumber: nextQuestionNumber
    };

    const turn: InterviewTurn = {
      id: randomUUID(),
      question: payload.question,
      transcript,
      correctedAnswer: feedback.correctedAnswer,
      feedback,
      answeredAt: new Date().toISOString()
    };

    const responsePayload: AnswerInterviewResponse = {
      session,
      turn,
      nextQuestion
    };

    response.json(answerInterviewResponseSchema.parse(responsePayload));
  });

  return router;
};

const parseAnswerPayload = (request: Request) => {
  const validation = answerPayloadSchema.safeParse(request.body);

  if (!validation.success) {
    throw new HttpRequestError(400, validation.error.message);
  }

  return validation.data;
};

const normalizeQuestion = (question: Question): Question => ({
  ...question,
  id: question.id.trim().length > 0 ? question.id : randomUUID()
});

const normalizeNullableQuestion = (question: Question | null): Question | null => {
  if (question === null) {
    return null;
  }

  return normalizeQuestion(question);
};
