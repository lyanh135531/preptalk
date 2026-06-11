import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: any = null;

self.onmessage = async (event:	MessageEvent<{ type: string; data?: any }>) => {
  const { type } = event.data;

  if (type === "load") {
    try {
      transcriber = await pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-base",
        {
          device: "webgpu",
        } as any
      );
      self.postMessage({ type: "loaded" });
    } catch (loadError) {
      self.postMessage({
        type: "error",
        error: loadError instanceof Error ? loadError.message : String(loadError),
      });
    }
  }

  if (type === "transcribe") {
    if (!transcriber) {
      self.postMessage({ type: "error", error: "Model not loaded" });
      return;
    }
    try {
      const { audio, language } = event.data as unknown as { audio: ArrayBuffer; language: string };
      const float32 = new Float32Array(audio);
      const result = await transcriber(float32, {
        language,
        task: "transcribe",
        return_timestamps: false,
      });
      self.postMessage({ type: "result", text: result?.text ?? "" });
    } catch (transcribeError) {
      self.postMessage({
        type: "error",
        error:
          transcribeError instanceof Error
            ? transcribeError.message
            : String(transcribeError),
      });
    }
  }
};
