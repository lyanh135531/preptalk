import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"] ?? "";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.json({
    ok: true,
    openRouterConfigured: OPENROUTER_API_KEY.trim().length > 0,
  });
}
