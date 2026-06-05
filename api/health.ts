import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"] ?? "";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const CHAT_MODEL = process.env["OPENROUTER_CHAT_MODEL"] ?? "nvidia/nemotron-3-super-120b-a12b:free";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.json({
    ok: true,
    openRouterConfigured: OPENROUTER_API_KEY.trim().length > 0,
  });
}
