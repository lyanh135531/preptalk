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
  vi: "vi-VN"
};

const ttsVoiceNameByLanguage: Record<InterviewLanguage, string> = {
  en: getEnvValue("VITE_TTS_EN_VOICE_NAME"),
  vi: getEnvValue("VITE_TTS_VI_VOICE_NAME")
};

const ttsRate = Number.parseFloat(getEnvValue("VITE_TTS_RATE"));
const ttsPitch = Number.parseFloat(getEnvValue("VITE_TTS_PITCH"));
const defaultTtsRate = 0.95;
const defaultTtsPitch = 1;

export const ensureSpeechRecognitionSupport = (): void => {
  if (getSpeechRecognitionConstructor() === null) {
    throw new Error("Speech recognition is not available in this browser. Please use the latest Chrome or Edge.");
  }
};

export const ensureSpeechSynthesisSupport = (): void => {
  if (!("speechSynthesis" in window)) {
    throw new Error("Text-to-speech is not available in this browser. Please use Microsoft Edge.");
  }
};

export const ensureMicrophoneAccess = async (): Promise<void> => {
  if (navigator.mediaDevices === undefined || navigator.mediaDevices.getUserMedia === undefined) {
    throw new Error("Microphone access is not available in this browser. Please use the latest Chrome or Edge.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true
  });

  for (const track of stream.getTracks()) {
    track.stop();
  }
};

export const startSpeechCapture = (language: InterviewLanguage): ActiveSpeechCapture => {
  const recognitionConstructor = getSpeechRecognitionConstructor();

  if (recognitionConstructor === null) {
    throw new Error("Speech recognition is not available in this browser. Please use the latest Chrome or Edge.");
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
    stop: () => new Promise<SpeechCaptureResult>((resolve, reject): void => {
      recognition.onend = (): void => {
        if (recognitionError !== null && finalTranscript.trim().length === 0 && latestInterimTranscript.trim().length === 0) {
          reject(new Error(`Speech recognition stopped: ${recognitionError}. Please try again.`));
          return;
        }

        resolve({
          transcript: `${finalTranscript} ${latestInterimTranscript}`.trim(),
          durationMs: Math.round(performance.now() - startedAt)
        });
      };

      recognition.stop();
    })
  };
};

export const speakText = async (text: string, language: InterviewLanguage): Promise<void> => {
  ensureSpeechSynthesisSupport();

  window.speechSynthesis.cancel();

  await new Promise<void>((resolve, reject): void => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguageByCode[language];
    utterance.rate = Number.isFinite(ttsRate) ? ttsRate : defaultTtsRate;
    utterance.pitch = Number.isFinite(ttsPitch) ? ttsPitch : defaultTtsPitch;
    utterance.voice = selectVoice(language);
    utterance.onend = (): void => resolve();
    utterance.onerror = (): void => reject(new Error("Could not play the question audio. Please try replaying it."));
    window.speechSynthesis.speak(utterance);
  });
};

export const stopSpeech = (): void => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

const collectTranscript = (event: SpeechRecognitionEvent): { readonly finalText: string; readonly interimText: string } => {
  const finalSegments: string[] = [];
  const interimSegments: string[] = [];

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
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
    interimText: interimSegments.join(" ").trim()
  };
};

const selectVoice = (language: InterviewLanguage): SpeechSynthesisVoice | null => {
  const targetLanguage = speechLanguageByCode[language].toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const configuredVoice = findConfiguredVoice(voices, ttsVoiceNameByLanguage[language]);

  if (configuredVoice !== null) {
    return configuredVoice;
  }

  const exactVoice = voices.find((voice: SpeechSynthesisVoice): boolean => {
    return voice.lang.toLowerCase() === targetLanguage && isMicrosoftVoice(voice);
  });

  if (exactVoice !== undefined) {
    return exactVoice;
  }

  const sameLanguageVoice = voices.find((voice: SpeechSynthesisVoice): boolean => voice.lang.toLowerCase() === targetLanguage);

  if (sameLanguageVoice !== undefined) {
    return sameLanguageVoice;
  }

  const languagePrefix = targetLanguage.split("-")[0];

  if (languagePrefix === undefined) {
    return null;
  }

  const microsoftLanguageVoice = voices.find((voice: SpeechSynthesisVoice): boolean => {
    return voice.lang.toLowerCase().startsWith(languagePrefix) && isMicrosoftVoice(voice);
  });

  if (microsoftLanguageVoice !== undefined) {
    return microsoftLanguageVoice;
  }

  return voices.find((voice: SpeechSynthesisVoice): boolean => voice.lang.toLowerCase().startsWith(languagePrefix)) ?? null;
};

const findConfiguredVoice = (voices: readonly SpeechSynthesisVoice[], voiceName: string): SpeechSynthesisVoice | null => {
  const configuredVoiceName = voiceName.trim().toLowerCase();

  if (configuredVoiceName.length === 0) {
    return null;
  }

  return voices.find((voice: SpeechSynthesisVoice): boolean => voice.name.toLowerCase() === configuredVoiceName) ?? null;
};

const isMicrosoftVoice = (voice: SpeechSynthesisVoice): boolean => {
  return voice.name.toLowerCase().includes("microsoft");
};

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

function getEnvValue(key: string): string {
  const environment = import.meta.env as Record<string, unknown>;
  const value = environment[key];

  if (typeof value !== "string") {
    return "";
  }

  return value;
}
