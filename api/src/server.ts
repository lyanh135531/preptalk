import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import answerRouter from "./routes/answer.js";
import cvParseRouter from "./routes/cv-parse.js";
import healthRouter from "./routes/health.js";
import jdAnalyzeRouter from "./routes/jd-analyze.js";
import matchRouter from "./routes/match.js";
import nextRouter from "./routes/next.js";
import startRouter from "./routes/start.js";
import suggestRouter from "./routes/suggest.js";
import ttsRouter from "./routes/tts.js";

const PORT = Number.parseInt(process.env["PORT"] || "4000", 10);
const CLIENT_ORIGIN = process.env["CLIENT_ORIGIN"] || "*";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Middleware ──
app.use(cors({
  origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "2mb" }));

// ── API Routes (trước static) ──
app.use("/api/health", healthRouter);
app.use("/api/tts", ttsRouter);
app.use("/api/cv/parse", cvParseRouter);
app.use("/api/jd/analyze", jdAnalyzeRouter);
app.use("/api/cv-jd/match", matchRouter);
app.use("/api/interviews/start", startRouter);
app.use("/api/interviews/suggest", suggestRouter);
app.use("/api/interviews/answer", answerRouter);
app.use("/api/interviews/next", nextRouter);

// ── Static Uploads ──
const uploadsDir = path.resolve(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsDir));

// ── Static Frontend ──
const distCandidates = [
  "/app/webapp/dist",                                // Docker production (absolute)
  path.resolve(__dirname, "../webapp/dist"),          // Docker production (relative)
  path.resolve(__dirname, "../../apps/web/dist"),     // Dev local
];

let distPath: string | null = null;
for (const candidate of distCandidates) {
  if (fs.existsSync(path.join(candidate, "index.html"))) {
    distPath = candidate;
    break;
  }
}

if (distPath) {
  app.use(express.static(distPath, {
    etag: true,
    lastModified: true,
    maxAge: "1d",
    setHeaders(res: express.Response, filePath: string) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (/\.[a-f0-9]{8,}\.(js|css)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  console.log(`   Frontend: ${distPath}`);
} else {
  console.log("   Frontend: ⚠️  No dist found (API-only mode)");
}

// SPA fallback — Express 4 wildcard, must be last
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  if (distPath) {
    res.sendFile(path.join(distPath, "index.html"));
  } else {
    res.status(404).send("Not found");
  }
});

// ── Start ──
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 PrepTalk server running on http://0.0.0.0:${PORT}`);
  console.log(`   Client origin: ${CLIENT_ORIGIN}`);
  console.log(`   OpenRouter: ${process.env["OPENROUTER_API_KEY"] ? "✓ configured" : "⚠️  NOT configured"}`);
});
