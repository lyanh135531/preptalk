import cors from "cors";
import express from "express";
import type { ErrorRequestHandler, Request, Response } from "express";
import { ZodError } from "zod";

import { appConfig } from "./config.js";
import { HttpRequestError, OpenRouterRequestError, OpenRouterValidationError } from "./errors.js";
import { OpenRouterClient } from "./open-router-client.js";
import { createInterviewRouter } from "./routes/interviews.js";

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
      ok: true
    });
  });

  app.use("/api/interviews", createInterviewRouter({
    openRouterClient,
    maxQuestions: appConfig.interview.maxQuestions
  }));
  app.use(errorHandler);

  return app;
};

const errorHandler: ErrorRequestHandler = (error: unknown, _request: Request, response: Response, next): void => {
  void next;

  if (error instanceof HttpRequestError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  if (error instanceof OpenRouterRequestError) {
    response.status(502).json({
      error: error.message,
      routeName: error.routeName,
      model: error.model,
      statusCode: error.statusCode,
      responseBody: error.responseBody
    });
    return;
  }

  if (error instanceof OpenRouterValidationError) {
    response.status(502).json({
      error: error.message,
      routeName: error.routeName,
      model: error.model
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(500).json({
      error: error.message
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown server error";
  response.status(500).json({
    error: message
  });
};
