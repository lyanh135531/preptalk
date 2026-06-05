import type {
  AnswerInterviewResponse,
  AnswerPayload,
  ApiErrorCode,
  StartInterviewRequest,
  StartInterviewResponse,
  SuggestAnswerRequest,
  SuggestAnswerResponse
} from "@preptalk/shared";
import {
  apiErrorResponseSchema,
  answerInterviewResponseSchema,
  healthResponseSchema,
  startInterviewResponseSchema,
  suggestAnswerResponseSchema
} from "@preptalk/shared";
import type { ZodSchema } from "zod";

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly requestId: string | null;

  public constructor(message: string, code: ApiErrorCode, requestId: string | null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.requestId = requestId;
  }
}

export type HealthStatus = {
  readonly ok: boolean;
  readonly openRouterConfigured: boolean;
};

export const getHealthStatus = async (): Promise<HealthStatus> => {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new ApiError("PrepTalk is not ready. Please restart the app and try again.", "SERVER_ERROR", null);
  }

  const json: unknown = await response.json();
  return healthResponseSchema.parse(json);
};

export const startInterview = async (request: StartInterviewRequest): Promise<StartInterviewResponse> => {
  return sendJson("/api/interviews/start", request, startInterviewResponseSchema);
};

export const suggestAnswer = async (request: SuggestAnswerRequest): Promise<SuggestAnswerResponse> => {
  return sendJson("/api/interviews/suggest", request, suggestAnswerResponseSchema);
};

export const submitAnswer = async (payload: AnswerPayload): Promise<AnswerInterviewResponse> => {
  return sendJson("/api/interviews/answer", payload, answerInterviewResponseSchema);
};

const sendJson = async <TResponse>(
  url: string,
  body: object,
  schema: ZodSchema<TResponse>
): Promise<TResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const json: unknown = await response.json();
  return schema.parse(json);
};

const readApiError = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type");

  if (contentType !== null && contentType.includes("application/json")) {
    const body: unknown = await response.json();
    const validation = apiErrorResponseSchema.safeParse(body);

    if (validation.success) {
      throw new ApiError(validation.data.error, validation.data.code, validation.data.requestId ?? null);
    }
  }

  return "PrepTalk could not complete the request. Please try again.";
};
