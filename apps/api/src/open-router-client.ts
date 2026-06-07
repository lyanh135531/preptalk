import { z } from "zod";
import type { ZodSchema } from "zod";

import { OpenRouterRequestError, OpenRouterValidationError } from "./errors.js";
import type { JsonSchema } from "./json-schemas.js";

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  readonly role: ChatRole;
  readonly content: string;
};

type OpenRouterClientConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly chatModel: string;
  readonly appTitle: string;
};

type ChatJsonRequest<TResponse> = {
  readonly routeName: string;
  readonly messages: readonly ChatMessage[];
  readonly responseSchemaName: string;
  readonly responseJsonSchema: JsonSchema;
  readonly validationSchema: ZodSchema<TResponse>;
  readonly temperature: number;
  readonly maxTokens: number;
};

const chatCompletionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string()
      })
    })
  ).min(1)
});

export class OpenRouterClient {
  private readonly config: OpenRouterClientConfig;

  public constructor(config: OpenRouterClientConfig) {
    this.config = config;
  }

  public async chatJson<TResponse>(request: ChatJsonRequest<TResponse>): Promise<TResponse> {
    const body = {
      model: this.config.chatModel,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.responseSchemaName,
          strict: true,
          schema: request.responseJsonSchema
        }
      }
    };

    const json = await this.fetchJsonWithRetry(
      "/chat/completions",
      request.routeName,
      this.config.chatModel,
      body
    );

    const completion = chatCompletionSchema.parse(json);
    const firstChoice = completion.choices[0];

    if (firstChoice === undefined) {
      throw new OpenRouterRequestError(request.routeName, this.config.chatModel, null, "OpenRouter returned no chat choices.");
    }

    const content = firstChoice.message.content;

    try {
      const parsedContent: unknown = JSON.parse(content);
      return request.validationSchema.parse(parsedContent);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        console.warn("openrouter_invalid_json_schema", {
          routeName: request.routeName,
          model: this.config.chatModel,
          issues: error.issues
        });

        const retryJson = await this.fetchJsonWithRetry(
          "/chat/completions",
          request.routeName,
          this.config.chatModel,
          body
        );
        const retryCompletion = chatCompletionSchema.parse(retryJson);
        const retryFirstChoice = retryCompletion.choices[0];

        if (retryFirstChoice === undefined) {
          throw new OpenRouterRequestError(request.routeName, this.config.chatModel, null, "OpenRouter returned no chat choices on retry.");
        }

        const retryContent = retryFirstChoice.message.content;
        const retryParsedContent: unknown = JSON.parse(retryContent);
        const retryResult = request.validationSchema.safeParse(retryParsedContent);

        if (!retryResult.success) {
          throw new OpenRouterValidationError(request.routeName, this.config.chatModel, retryResult.error);
        }

        return retryResult.data;
      }

      if (error instanceof SyntaxError) {
        throw new OpenRouterRequestError(request.routeName, this.config.chatModel, null, `Invalid JSON content: ${error.message}`);
      }

      throw error;
    }
  }

  private async fetchJsonWithRetry(route: string, routeName: string, model: string, body: object): Promise<unknown> {
    const response = await this.fetchWithRetry(
      route,
      routeName,
      model,
      {
        method: "POST",
        headers: this.createJsonHeaders(),
        body: JSON.stringify(body)
      }
    );

    const json: unknown = await response.json();
    return json;
  }

  private async fetchWithRetry(route: string, routeName: string, model: string, init: RequestInit): Promise<Response> {
    if (this.config.apiKey.trim().length === 0) {
      throw new OpenRouterRequestError(routeName, model, null, "OPENROUTER_API_KEY is missing. Add it to C:\\Project\\preptalk\\.env and restart the API server.");
    }

    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${this.config.baseUrl}${route}`, init);

        if (response.ok) {
          return response;
        }

        const responseBody = await response.text();
        const retryable = response.status === 429 || response.status >= 500;

        console.warn("openrouter_request_failed", {
          routeName,
          model,
          statusCode: response.status,
          retryable,
          attempt
        });

        if (!retryable || attempt === maxAttempts) {
          throw new OpenRouterRequestError(routeName, model, response.status, responseBody);
        }
      } catch (error: unknown) {
        if (error instanceof OpenRouterRequestError) {
          throw error;
        }

        if (attempt === maxAttempts) {
          const responseBody = error instanceof Error ? error.message : "Unknown network error";
          throw new OpenRouterRequestError(routeName, model, null, responseBody);
        }

        console.warn("openrouter_network_failed", {
          routeName,
          model,
          attempt
        });
      }
    }

    throw new OpenRouterRequestError(routeName, model, null, "Retry loop exited unexpectedly");
  }

  private createJsonHeaders(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-OpenRouter-Title": this.config.appTitle
    };
  }
}
