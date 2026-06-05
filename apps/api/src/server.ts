import cors from "cors";
import express from "express";
import type { ErrorRequestHandler, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { ApiErrorCode, ApiErrorResponse } from "@preptalk/shared";

import { appConfig } from "./config.js";
import {
  HttpRequestError,
  OpenRouterRequestError,
  OpenRouterValidationError
} from "./errors.js";
import { OpenRouterClient } from "./open-router-client.js";
import { createInterviewRouter } from "./routes/interviews.js";
import { createTtsRouter } from "./routes/tts.js";

const openRouterClient = new OpenRouterClient(appConfig.openRouter);

export const createServer = () => {
  const app = express();

  app.use(cors({
    origin: appConfig.clientOrigin
  }));
  app.use(express.json({
    limit: "1mb"
  }));

  app.get("/api/health", (_request: Request, response: Response) => {
    response.json({
      ok: true,
      openRouterConfigured: appConfig.openRouter.apiKey.trim().length > 0
    });
  });

  app.use("/api/interviews", createInterviewRouter({
    openRouterClient,
    maxQuestions: appConfig.interview.maxQuestions
  }));
  app.use("/api/tts", createTtsRouter());
  app.use(errorHandler);

  return app;
};

const errorHandler: ErrorRequestHandler = (error: unknown, _request: Request, response: Response, next): void => {
  void next;
  const requestId = randomUUID();

  if (error instanceof HttpRequestError) {
    logHandledError(requestId, error.code, error);
    response.status(error.statusCode).json(createErrorResponse(getSafeErrorMessage(error.code), error.code, requestId));
    return;
  }

  if (error instanceof OpenRouterRequestError) {
    const code = classifyProviderError(error.statusCode, error.responseBody, "AI_UNAVAILABLE");
    logHandledError(requestId, code, error);
    response.status(getStatusCodeForError(code)).json(createErrorResponse(getSafeErrorMessage(code), code, requestId));
    return;
  }

  if (error instanceof OpenRouterValidationError) {
    logHandledError(requestId, "AI_UNAVAILABLE", error);
    response.status(502).json(createErrorResponse(getSafeErrorMessage("AI_UNAVAILABLE"), "AI_UNAVAILABLE", requestId));
    return;
  }

  if (error instanceof ZodError) {
    logHandledError(requestId, "SERVER_ERROR", error);
    response.status(500).json(createErrorResponse(getSafeErrorMessage("SERVER_ERROR"), "SERVER_ERROR", requestId));
    return;
  }

  logHandledError(requestId, "SERVER_ERROR", error);
  response.status(500).json(createErrorResponse(getSafeErrorMessage("SERVER_ERROR"), "SERVER_ERROR", requestId));
};

const createErrorResponse = (error: string, code: ApiErrorCode, requestId: string): ApiErrorResponse => ({
  error,
  code,
  requestId
});

const classifyProviderError = (
  statusCode: number | null,
  responseBody: string,
  defaultCode: ApiErrorCode
): ApiErrorCode => {
  if (statusCode === 401 || statusCode === 403 || responseBody.includes("API_KEY") || responseBody.includes("missing")) {
    return "CONFIG_MISSING";
  }

  if (statusCode === 402 || statusCode === 429 || responseBody.toLowerCase().includes("quota") || responseBody.toLowerCase().includes("rate")) {
    return "RATE_LIMITED";
  }

  return defaultCode;
};

const getStatusCodeForError = (code: ApiErrorCode): number => {
  if (code === "INVALID_INPUT") {
    return 400;
  }

  if (code === "CONFIG_MISSING") {
    return 503;
  }

  if (code === "RATE_LIMITED") {
    return 429;
  }

  return 502;
};

const getSafeErrorMessage = (code: ApiErrorCode): string => {
  if (code === "AI_UNAVAILABLE") {
    return "The AI interviewer is unavailable right now. Please try again.";
  }

  if (code === "CONFIG_MISSING") {
    return "A required service is not configured. Please check your local setup and restart the app.";
  }

  if (code === "RATE_LIMITED") {
    return "The service is temporarily rate limited. Please wait a moment and try again.";
  }

  if (code === "INVALID_INPUT") {
    return "Please check your input and try again.";
  }

  return "Something went wrong. Please try again.";
};

const logHandledError = (requestId: string, code: ApiErrorCode, error: unknown): void => {
  const baseFields = {
    requestId,
    code
  };

  if (error instanceof OpenRouterRequestError) {
    console.warn("api_provider_error", {
      ...baseFields,
      providerRoute: error.routeName,
      providerModel: error.model,
      statusCode: error.statusCode,
      responseBody: error.responseBody
    });
    return;
  }

  if (error instanceof OpenRouterValidationError) {
    console.warn("api_provider_validation_error", {
      ...baseFields,
      providerRoute: error.routeName,
      providerModel: error.model,
      issues: error.validationError.issues
    });
    return;
  }

  if (error instanceof HttpRequestError) {
    console.warn("api_request_error", {
      ...baseFields,
      statusCode: error.statusCode,
      message: error.message
    });
    return;
  }

  if (error instanceof Error) {
    console.error("api_unhandled_error", {
      ...baseFields,
      name: error.name,
      message: error.message
    });
    return;
  }

  console.error("api_unknown_error", {
    ...baseFields
  });
};
