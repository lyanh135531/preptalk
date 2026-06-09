import { pipeline, env } from "@huggingface/transformers";

// Configure transformers.js to use browser cache (IndexedDB)
env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;

type InboundMessage =
  | { type: "load"; modelId: string }
  | { type: "transcribe"; audio: ArrayBuffer; language: string }
  | { type: "ping" };

type OutboundMessage =
  | { type: "loaded" }
  | { type: "loading"; progress: number }
  | { type: "result"; text: string }
  | { type: "error"; message: string }
  | { type: "pong" };

function post(msg: OutboundMessage) {
  self.postMessage(msg);
}

self.onmessage = async (event: MessageEvent<InboundMessage>) => {
  const { type } = event.data;

  if (type === "ping") {
    post({ type: "pong" });
    return;
  }

  if (type === "load") {
    try {
      const modelId = event.data.modelId;
      transcriber = await pipeline("automatic-speech-recognition", modelId, {
        device: "webgpu",
        progress_callback: ((progress: any) => {
          if (typeof progress?.progress === "number") {
            post({ type: "loading", progress: progress.progress });
          }
        }) as any,
      });
      post({ type: "loaded" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", message: `Failed to load model: ${message}` });
    }
    return;
  }

  if (type === "transcribe") {
    if (!transcriber) {
      post({ type: "error", message: "Model not loaded. Call load first." });
      return;
    }

    try {
      const { audio, language } = event.data;
      const float32 = new Float32Array(audio);
      const result = await transcriber(float32, {
        language,
        task: "transcribe",
        return_timestamps: false,
      });
      post({ type: "result", text: result?.text ?? "" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "error", message: `Transcription failed: ${message}` });
    }
    return;
  }
};
