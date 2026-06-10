import { Router, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import pdf from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục uploads (ngoài src, cùng cấp với src/)
const UPLOADS_DIR = path.join("/tmp", "preptalk", "uploads");
const CV_DIR = path.join(UPLOADS_DIR, "cv");

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(CV_DIR)) {
  fs.mkdirSync(CV_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// ── Config ──
const CONFIG = {
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"] ?? "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  CHAT_MODEL: process.env["OPENROUTER_CHAT_MODEL"] ?? "openai/gpt-oss-20b:free",
  APP_TITLE: "PrepTalk",
};

async function fetchOpenRouter(
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number
): Promise<string | null> {
  const body = {
    model: CONFIG.CHAT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" as const },
  };

  try {
    const res = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env["CLIENT_ORIGIN"] || "http://localhost:5173",
        "X-Title": CONFIG.APP_TITLE,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("cv_parse_openrouter_failed", { status: res.status, body: text });
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn("cv_parse_openrouter_error", { error: String(err) });
    return null;
  }
}

// ── Schemas ──

const cvAnalysisSchema = z.object({
  candidateName: z.string().default(""),
  skills: z.array(z.string()).default([]),
  experience: z.array(z.object({
    role: z.string().min(1),
    duration: z.string().default(""),
    highlights: z.array(z.string()).default([]),
  })).default([]),
  education: z.array(z.object({
    degree: z.string().default(""),
    school: z.string().default(""),
  })).default([]),
  summary: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});

const router = Router();

router.post("/",
  (req, res, next) => {
    upload.single("cv")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: `Upload error: ${err.message}`, code: "INVALID_INPUT" });
        return;
      }
      if (err) {
        res.status(400).json({ error: err.message, code: "INVALID_INPUT" });
        return;
      }
      next();
    });
  },
  async (req: any, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No PDF file uploaded. Please upload a CV in PDF format.", code: "INVALID_INPUT" });
        return;
      }

      // 1. Extract text from PDF
      const pdfData = await pdf(file.buffer);
      const pdfText = pdfData.text.trim();

      if (pdfText.length < 50) {
        res.status(422).json({
          error: "Could not extract enough text from the PDF. Please ensure your CV contains selectable text (not scanned images).",
          code: "INVALID_INPUT",
        });
        return;
      }

      // 2. Limit text to avoid token overflow
      const truncatedText = pdfText.slice(0, 8000);

      // 3. Send to OpenRouter for structured extraction
      const messages = [
        {
          role: "system",
          content: [
            "You are an expert HR analyst. Extract structured information from a CV/Resume.",
            "Return ONLY a JSON object with these fields:",
            "- candidateName: string (full name, empty if not found)",
            "- skills: string[] (technical skills, tools, technologies, soft skills)",
            "- experience: array of { role: string, duration: string, highlights: string[] }",
            "- education: array of { degree: string, school: string }",
            "- summary: string (2-3 sentence professional summary)",
            "- strengths: string[] (3-5 key strengths based on the CV)",
            "- gaps: string[] (2-3 potential gaps or areas lacking)",
            "",
            "If the CV is in Vietnamese, return field values in Vietnamese.",
            "If the CV is in English, return field values in English.",
            "Return ONLY valid JSON. No markdown, no explanations.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Extract structured data from this CV:",
            "",
            "---",
            truncatedText,
            "---",
          ].join("\n"),
        },
      ];

      const raw = await fetchOpenRouter(messages, 0.3, 2000);
      if (!raw) {
        res.status(502).json({
          error: "The AI could not parse your CV right now. Please try again.",
          code: "AI_UNAVAILABLE",
        });
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const cv = cvAnalysisSchema.parse(parsed);
        res.json({ cv });
      } catch {
        console.warn("cv_parse_invalid_ai_response", { raw: raw.substring(0, 300) });
        res.status(502).json({
          error: "The AI could not understand your CV format. Please try a different PDF.",
          code: "AI_UNAVAILABLE",
        });
      }
    } catch (error: unknown) {
      console.error("cv_parse_error", { error: String(error) });
      res.status(500).json({
        error: "Failed to parse CV. Please try again.",
        code: "SERVER_ERROR",
      });
    }
  }
);

router.post(
  "/save",
  (req, res, next) => {
    upload.single("cv")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: `Upload error: ${err.message}`, code: "INVALID_INPUT" });
        return;
      }
      if (err) {
        res.status(400).json({ error: err.message, code: "INVALID_INPUT" });
        return;
      }
      next();
    });
  },
  async (req: any, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No PDF file uploaded.", code: "INVALID_INPUT" });
        return;
      }

      // Lưu file vào uploads/cv/ với tên UUID
      const fileId = `${randomUUID()}.pdf`;
      const filePath = path.join(CV_DIR, fileId);
      fs.writeFileSync(filePath, file.buffer);

      // Parse CV như bình thường
      const pdfData = await pdf(file.buffer);
      const pdfText = pdfData.text.trim();

      if (pdfText.length < 50) {
        // Xóa file vừa lưu nếu không parse được
        fs.unlinkSync(filePath);
        res.status(422).json({
          error: "Could not extract enough text from the PDF.",
          code: "INVALID_INPUT",
        });
        return;
      }

      const truncatedText = pdfText.slice(0, 8000);

      const messages = [
        {
          role: "system",
          content: [
            "You are an expert HR analyst. Extract structured information from a CV/Resume.",
            "Return ONLY a JSON object with these fields:",
            "- candidateName: string (full name, empty if not found)",
            "- skills: string[] (technical skills, tools, technologies, soft skills)",
            "- experience: array of { role: string, duration: string, highlights: string[] }",
            "- education: array of { degree: string, school: string }",
            "- summary: string (2-3 sentence professional summary)",
            "- strengths: string[] (3-5 key strengths based on the CV)",
            "- gaps: string[] (2-3 potential gaps or areas lacking)",
            "",
            "If the CV is in Vietnamese, return field values in Vietnamese.",
            "If the CV is in English, return field values in English.",
            "Return ONLY valid JSON. No markdown, no explanations.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Extract structured data from this CV:",
            "",
            "---",
            truncatedText,
            "---",
          ].join("\n"),
        },
      ];

      const raw = await fetchOpenRouter(messages, 0.3, 2000);
      if (!raw) {
        fs.unlinkSync(filePath);
        res.status(502).json({
          error: "The AI could not parse your CV right now.",
          code: "AI_UNAVAILABLE",
        });
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const cv = cvAnalysisSchema.parse(parsed);
        res.json({
          cv,
          fileId,
          fileName: file.originalname,
        });
      } catch {
        fs.unlinkSync(filePath);
        console.warn("cv_parse_invalid_ai_response", { raw: raw.substring(0, 300) });
        res.status(502).json({
          error: "The AI could not understand your CV format.",
          code: "AI_UNAVAILABLE",
        });
      }
    } catch (error: unknown) {
      console.error("cv_save_error", { error: String(error) });
      res.status(500).json({
        error: "Failed to save and parse CV.",
        code: "SERVER_ERROR",
      });
    }
  }
);

// ── Serve CV file ──
router.get("/file/:fileId", (req: Request, res: Response): void => {
  const { fileId } = req.params;
  // Chỉ cho phép UUID.pdf format để tránh path traversal
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(fileId)) {
    res.status(400).json({ error: "Invalid file ID." });
    return;
  }
  const filePath = path.join(CV_DIR, fileId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(filePath);
});

export default router;
