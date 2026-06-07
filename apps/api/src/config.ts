import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, "../../..");

loadEnv({
  path: resolve(workspaceRoot, ".env")
});

const environmentSchema = z.object({
  OPENROUTER_API_KEY: z.string(),
  PORT: z.coerce.number().int().min(1).max(65535),
  CLIENT_ORIGIN: z.string().url(),
  OPENROUTER_CHAT_MODEL: z.string().default("nvidia/nemotron-3-super-120b-a12b:free")
});

const parsedEnvironment = environmentSchema.safeParse({
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  PORT: process.env["PORT"] ?? "4000",
  CLIENT_ORIGIN: process.env["CLIENT_ORIGIN"] ?? "http://localhost:5173",
  OPENROUTER_CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"]
});

if (!parsedEnvironment.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnvironment.error.message}`);
}

export const appConfig = {
  port: parsedEnvironment.data.PORT,
  clientOrigin: parsedEnvironment.data.CLIENT_ORIGIN,
  openRouter: {
    apiKey: parsedEnvironment.data.OPENROUTER_API_KEY,
    baseUrl: "https://openrouter.ai/api/v1",
    chatModel: parsedEnvironment.data.OPENROUTER_CHAT_MODEL,
    appTitle: "PrepTalk"
  },
  interview: {
    maxQuestions: 999999
  }
} as const;
