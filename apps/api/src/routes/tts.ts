import { Router } from "express";
import type { Request, Response } from "express";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

import { HttpRequestError } from "../errors.js";

export const createTtsRouter = (): Router => {
  const router = Router();

  router.get("/", (request: Request, response: Response, next): void => {
    const text = request.query["text"];
    const lang = request.query["lang"];
    const voice = request.query["voice"];

    if (typeof text !== "string" || text.trim().length === 0) {
      next(new HttpRequestError(400, "Text query parameter is required", "INVALID_INPUT"));
      return;
    }

    const language = typeof lang === "string" ? lang : "en";
    const requestedVoice = typeof voice === "string" ? voice : "";
    const voiceShortName = mapVoiceNameToShortName(requestedVoice, language);

    const tts = new MsEdgeTTS();
    tts.setMetadata(voiceShortName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
      .then(() => {
        const { audioStream } = tts.toStream(text);

        response.setHeader("Content-Type", "audio/mpeg");
        response.setHeader("Transfer-Encoding", "chunked");

        audioStream.on("data", (chunk: Buffer) => {
          response.write(chunk);
        });

        audioStream.on("end", () => {
          response.end();
        });

        audioStream.on("error", (error: Error) => {
          console.error("TTS Stream Error:", error);
          if (!response.headersSent) {
            response.status(502).json({ error: "TTS generation failed" });
          } else {
            response.end();
          }
        });
      })
      .catch((error: unknown) => {
        console.error("TTS Service Error:", error);
        next(new HttpRequestError(502, "Failed to connect to Microsoft Speech service", "AI_UNAVAILABLE"));
      });
  });

  return router;
};

const mapVoiceNameToShortName = (voiceName: string, lang: string): string => {
  const name = voiceName.trim();

  // If the user specifies a short name directly (e.g. en-US-AvaNeural)
  if (/^[a-z]{2,3}-[a-zA-Z]{2,4}-.+Neural$/i.test(name)) {
    return name;
  }

  const lowerName = name.toLowerCase();

  // Vietnamese voices
  if (lowerName.includes("hoaimy") || lowerName.includes("hoai my")) {
    return "vi-VN-HoaiMyNeural";
  }
  if (lowerName.includes("namminh") || lowerName.includes("nam minh")) {
    return "vi-VN-NamMinhNeural";
  }

  // English voices
  if (lowerName.includes("aria")) {
    return "en-US-AriaNeural";
  }
  if (lowerName.includes("ava")) {
    return "en-US-AvaNeural";
  }
  if (lowerName.includes("andrew")) {
    return "en-US-AndrewNeural";
  }
  if (lowerName.includes("emma")) {
    return "en-US-EmmaNeural";
  }
  if (lowerName.includes("brian")) {
    return "en-US-BrianNeural";
  }
  if (lowerName.includes("christopher")) {
    return "en-US-ChristopherNeural";
  }
  if (lowerName.includes("eric")) {
    return "en-US-EricNeural";
  }
  if (lowerName.includes("guy")) {
    return "en-US-GuyNeural";
  }
  if (lowerName.includes("jenny")) {
    return "en-US-JennyNeural";
  }
  if (lowerName.includes("michelle")) {
    return "en-US-MichelleNeural";
  }
  if (lowerName.includes("roger")) {
    return "en-US-RogerNeural";
  }
  if (lowerName.includes("steffan")) {
    return "en-US-SteffanNeural";
  }

  // Default fallbacks based on language code
  if (lang === "vi") {
    return "vi-VN-HoaiMyNeural";
  }
  return "en-US-BrianNeural";
};

