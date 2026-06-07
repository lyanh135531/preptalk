import type { VercelRequest, VercelResponse } from "@vercel/node";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const mapVoiceNameToShortName = (voiceName: string, lang: string): string => {
  const name = voiceName.trim();

  if (/^[a-z]{2,3}-[a-zA-Z]{2,4}-.+Neural$/i.test(name)) return name;

  const lowerName = name.toLowerCase();

  if (lowerName.includes("hoaimy") || lowerName.includes("hoai my")) return "vi-VN-HoaiMyNeural";
  if (lowerName.includes("namminh") || lowerName.includes("nam minh")) return "vi-VN-NamMinhNeural";

  if (lowerName.includes("aria")) return "en-US-AriaNeural";
  if (lowerName.includes("ava")) return "en-US-AvaNeural";
  if (lowerName.includes("andrew")) return "en-US-AndrewNeural";
  if (lowerName.includes("emma")) return "en-US-EmmaNeural";
  if (lowerName.includes("brian")) return "en-US-BrianNeural";
  if (lowerName.includes("christopher")) return "en-US-ChristopherNeural";
  if (lowerName.includes("eric")) return "en-US-EricNeural";
  if (lowerName.includes("guy")) return "en-US-GuyNeural";
  if (lowerName.includes("jenny")) return "en-US-JennyNeural";
  if (lowerName.includes("michelle")) return "en-US-MichelleNeural";
  if (lowerName.includes("roger")) return "en-US-RogerNeural";
  if (lowerName.includes("steffan")) return "en-US-SteffanNeural";

  if (lang === "vi") return "vi-VN-HoaiMyNeural";
  return "en-US-BrianNeural";
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const text = req.query["text"];
  const lang = req.query["lang"];
  const voice = req.query["voice"];

  if (typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Text query parameter is required" });
    return;
  }

  const language = typeof lang === "string" ? lang : "en";
  const requestedVoice = typeof voice === "string" ? voice : "";
  const voiceShortName = mapVoiceNameToShortName(requestedVoice, language);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceShortName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");

    audioStream.on("data", (chunk: Buffer) => {
      res.write(chunk);
    });

    audioStream.on("end", () => {
      res.end();
    });

    audioStream.on("error", (error: Error) => {
      console.error("TTS Stream Error:", error);
      if (!res.headersSent) {
        res.status(502).json({ error: "TTS generation failed" });
      } else {
        res.end();
      }
    });
  } catch (error: unknown) {
    console.error("TTS Service Error:", error);
    res.status(502).json({ error: "Failed to connect to Microsoft Speech service" });
  }
}
