import type { ZodError } from "zod";

export class HttpRequestError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpRequestError";
    this.statusCode = statusCode;
  }
}

export class OpenRouterRequestError extends Error {
  public readonly statusCode: number | null;
  public readonly routeName: string;
  public readonly model: string;
  public readonly responseBody: string;

  public constructor(routeName: string, model: string, statusCode: number | null, responseBody: string) {
    super(`OpenRouter request failed for route ${routeName}, model ${model}, status ${String(statusCode)}, response body: ${responseBody}`);
    this.name = "OpenRouterRequestError";
    this.routeName = routeName;
    this.model = model;
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class OpenRouterValidationError extends Error {
  public readonly routeName: string;
  public readonly model: string;
  public readonly validationError: ZodError;

  public constructor(routeName: string, model: string, validationError: ZodError) {
    super(`OpenRouter returned invalid JSON for route ${routeName}, model ${model}: ${validationError.message}`);
    this.name = "OpenRouterValidationError";
    this.routeName = routeName;
    this.model = model;
    this.validationError = validationError;
  }
}
