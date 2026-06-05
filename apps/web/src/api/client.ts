import type {
  AnswerInterviewResponse,
  AnswerPayload,
  StartInterviewRequest,
  StartInterviewResponse,
  SuggestAnswerRequest,
  SuggestAnswerResponse
} from "@preptalk/shared";
import {
  answerInterviewResponseSchema,
  startInterviewResponseSchema,
  suggestAnswerResponseSchema
} from "@preptalk/shared";
import type { ZodSchema } from "zod";

type ApiErrorBody = {
  readonly error?: string;
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
    const body = await response.json() as ApiErrorBody;
    return body.error ?? `Request failed with status ${String(response.status)}`;
  }

  const text = await response.text();
  return text.length > 0 ? text : `Request failed with status ${String(response.status)}`;
};
