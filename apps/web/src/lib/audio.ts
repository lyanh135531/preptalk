import type { InterviewLanguage } from "@preptalk/shared";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionAlternative = {
  readonly transcript: string;
};

type SpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly 0: SpeechRecognitionAlternative;
};

type SpeechRecognitionEvent = Event & {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionErrorEvent = Event & {
  readonly error: string;
};

type SpeechWindow = Window & {
  readonly SpeechRecognition?: SpeechRecognitionConstructor;
  readonly webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export type SpeechCaptureResult = {
  readonly transcript: string;
  readonly durationMs: number;
};

export type ActiveSpeechCapture = {
  readonly stop: () => Promise<SpeechCaptureResult>;
};

const speechLanguageByCode: Record<InterviewLanguage, string> = {
  en: "en-US",
  vi: "vi-VN",
};

const ttsVoiceNameByLanguage: Record<InterviewLanguage, string> = {
  en: getEnvValue("VITE_TTS_EN_VOICE_NAME"),
  vi: getEnvValue("VITE_TTS_VI_VOICE_NAME"),
};

export const ensureSpeechRecognitionSupport = (): void => {
  if (getSpeechRecognitionConstructor() === null) {
    throw new Error(
      "Speech recognition is not available in this browser. Please use the latest Chrome or Edge.",
    );
  }
};

export const ensureMicrophoneAccess = async (): Promise<void> => {
  if (
    navigator.mediaDevices === undefined ||
    navigator.mediaDevices.getUserMedia === undefined
  ) {
    throw new Error(
      "Microphone access is not available in this browser. Please use the latest Chrome or Edge.",
    );
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  for (const track of stream.getTracks()) {
    track.stop();
  }
};

export const startSpeechCapture = (
  language: InterviewLanguage,
): ActiveSpeechCapture => {
  const recognitionConstructor = getSpeechRecognitionConstructor();

  if (recognitionConstructor === null) {
    throw new Error(
      "Speech recognition is not available in this browser. Please use the latest Chrome or Edge.",
    );
  }

  const recognition = new recognitionConstructor();
  const startedAt = performance.now();
  let finalTranscript = "";
  let latestInterimTranscript = "";
  let recognitionError: string | null = null;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = speechLanguageByCode[language];

  recognition.onresult = (event: SpeechRecognitionEvent): void => {
    const nextTranscript = collectTranscript(event);
    finalTranscript = `${finalTranscript} ${nextTranscript.finalText}`.trim();
    latestInterimTranscript = nextTranscript.interimText;
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
    recognitionError = event.error;
  };

  recognition.start();

  return {
    stop: () =>
      new Promise<SpeechCaptureResult>((resolve, reject): void => {
        recognition.onend = (): void => {
          if (
            recognitionError !== null &&
            finalTranscript.trim().length === 0 &&
            latestInterimTranscript.trim().length === 0
          ) {
            reject(
              new Error(
                `Speech recognition stopped: ${recognitionError}. Please try again.`,
              ),
            );
            return;
          }

          resolve({
            transcript: `${finalTranscript} ${latestInterimTranscript}`.trim(),
            durationMs: Math.round(performance.now() - startedAt),
          });
        };

        recognition.stop();
      }),
  };
};

let activeAudio: HTMLAudioElement | null = null;

const ttsCache = new Map<string, string>();

const getCacheKey = (text: string, language: InterviewLanguage, voiceName: string): string => {
  return `${language}:${voiceName}:${text}`;
};

export const speakText = async (
  text: string,
  language: InterviewLanguage,
): Promise<void> => {
  stopSpeech();

  const voiceName = ttsVoiceNameByLanguage[language] || "";
  const cacheKey = getCacheKey(text, language, voiceName);

  const cachedUrl = ttsCache.get(cacheKey);
  if (cachedUrl) {
    await playAudioUrl(cachedUrl);
    return;
  }

  try {
    const response = await fetch(
      `/api/tts?text=${encodeURIComponent(text)}&lang=${language}&voice=${encodeURIComponent(voiceName)}`,
    );
    if (response.ok) {
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);

      if (ttsCache.size >= 20) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) {
          const oldUrl = ttsCache.get(firstKey);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          ttsCache.delete(firstKey);
        }
      }
      ttsCache.set(cacheKey, audioUrl);

      await playAudioUrl(audioUrl);
      return;
    }
  } catch {
    // Server TTS unavailable — fall through to browser speechSynthesis
  }

  // Fallback: browser speechSynthesis (works everywhere)
  await speakTextBrowser(text, language);
};

const speakTextBrowser = (text: string, language: InterviewLanguage): Promise<void> => {
  if (!("speechSynthesis" in window)) {
    throw new Error("Text-to-speech is not available in this browser.");
  }

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "vi" ? "vi-VN" : "en-US";
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const langCode = language === "vi" ? "vi" : "en";
      const match = voices.find((v) => v.lang.startsWith(langCode));
      if (match) utterance.voice = match;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Text-to-speech error: ${event.error}`));

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
};

const playAudioUrl = async (audioUrl: string): Promise<void> => {
  const audio = new Audio(audioUrl);
  activeAudio = audio;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
      reject(new Error("Audio playback failed or stream is invalid."));
    };
    audio.play().catch((playError: unknown) => {
      if (activeAudio === audio) activeAudio = null;
      reject(playError instanceof Error ? playError : new Error(String(playError)));
    });
  });
};

export const stopSpeech = (): void => {
  if (activeAudio !== null) {
    activeAudio.pause();
    activeAudio = null;
  }
};

const collectTranscript = (
  event: SpeechRecognitionEvent,
): { readonly finalText: string; readonly interimText: string } => {
  const finalSegments: string[] = [];
  const interimSegments: string[] = [];

  for (
    let index = event.resultIndex;
    index < event.results.length;
    index += 1
  ) {
    const result = event.results[index];

    if (result === undefined) {
      continue;
    }

    if (result.isFinal) {
      finalSegments.push(result[0].transcript);
    } else {
      interimSegments.push(result[0].transcript);
    }
  }

  return {
    finalText: finalSegments.join(" ").trim(),
    interimText: interimSegments.join(" ").trim(),
  };
};

const getSpeechRecognitionConstructor =
  (): SpeechRecognitionConstructor | null => {
    const speechWindow = window as SpeechWindow;
    return (
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition ??
      null
    );
  };

function getEnvValue(key: string): string {
  const environment = import.meta.env as Record<string, unknown>;
  const value = environment[key];

  if (typeof value !== "string") {
    return "";
  }

  return value;
}
