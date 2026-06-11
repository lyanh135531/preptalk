import { AudioCapture, listMicrophones } from "./audio-capture";

export type TranscriptCallback = (text: string) => void;
export type ErrorCallback = (error: string) => void;
export type LevelCallback = (level: number) => void;

export type WhisperTranscriberOptions = {
  readonly language: "en" | "vi";
  readonly onTranscript?: TranscriptCallback;
  readonly onError?: ErrorCallback;
  readonly onLevel?: LevelCallback;
  readonly onLoading?: (progress: number) => void;
  readonly onReady?: () => void;
};

export class WhisperTranscriber {
  private worker: Worker | null = null;
  private capture: AudioCapture;
  private options: WhisperTranscriberOptions;
  private _isModelLoaded = false;
  private _isRecording = false;
  private pendingResolve: ((text: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;

  constructor(options: WhisperTranscriberOptions) {
    this.options = options;
    this.capture = new AudioCapture();
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isModelLoaded(): boolean {
    return this._isModelLoaded;
  }

  async loadModel(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(
        new URL("../app/whisper-worker.ts", import.meta.url),
        { type: "module" }
      );

      this.worker.onmessage = (event) => {
        const { type, text, error } = event.data;

        if (type === "loaded") {
          this._isModelLoaded = true;
          this.options.onReady?.();
          resolve();
        }

        if (type === "error") {
          const err = new Error(error);
          this.options.onError?.(error);
          if (this.pendingReject) {
            this.pendingReject(err);
            this.pendingReject = null;
            this.pendingResolve = null;
          }
          // Only reject the load promise if model isn't loaded yet
          if (!this._isModelLoaded) {
            reject(err);
          }
        }

        if (type === "result") {
          this.options.onTranscript?.(text);
          if (this.pendingResolve) {
            this.pendingResolve(text);
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        }
      };

      this.worker.onerror = (err) => {
        reject(new Error(`Worker error: ${err.message}`));
      };

      this.worker.postMessage({ type: "load" });
    });
  }

  async startRecording(deviceId?: string): Promise<void> {
    if (this._isRecording) return;
    this._isRecording = true;
    const opts: { deviceId?: string; onLevel?: (level: number) => void } = {};
    if (deviceId) opts.deviceId = deviceId;
    if (this.options.onLevel) opts.onLevel = this.options.onLevel;
    await this.capture.start(opts);
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    if (this._isRecording) {
      this.capture.stop();
      this._isRecording = false;
    }
  }

  /**
   * Transcribe a Float32Array audio buffer.
   * The caller is responsible for stopping the AudioCapture first.
   */
  transcribeFloat32Array(audio: Float32Array, language: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Model not loaded"));
        return;
      }
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.worker.postMessage({
        type: "transcribe",
        audio: audio.buffer,
        language,
      });
    });
  }

  stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this._isRecording) {
        reject(new Error("Not recording"));
        return;
      }
      this._isRecording = false;
      const audio = this.capture.stop();
      if (audio.length < 16000) {
        reject(new Error("Audio too short. Please speak longer."));
        return;
      }
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.worker?.postMessage({
        type: "transcribe",
        audio: audio.buffer,
        language: this.options.language,
      });
    });
  }
}

export { listMicrophones };
