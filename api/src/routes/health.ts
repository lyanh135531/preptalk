import { Router, Request, Response } from "express";

const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
};

const router = Router();

router.get("/", (_req: Request, res: Response): void => {
  res.json({
    ok: true,
    openRouterConfigured: CONFIG.OPENROUTER_API_KEY.trim().length > 0,
  });
});

export default router;
