import type {
  LlmChatOptions,
  LlmLoadOptions,
  RecognizerOptions,
  SpeakOptions,
  SynthesizerOptions,
} from "../native/sdk";

/**
 * Every setting of the three models, with the defaults the plugins use.
 *
 * "Load" settings are fixed when a model is loaded (the model has to be loaded
 * again to change them); the others apply to the next message.
 */

export interface LlmSettings {
  // Behaviour
  systemPrompt: string;
  // Sampling (each message)
  temperature: number;
  topP: number;
  topK: number;
  minP: number;
  repeatPenalty: number;
  presencePenalty: number;
  maxTokens: number;
  /** -1 = a new random seed every time. */
  seed: number;
  /** One stop sequence per line. */
  stop: string;
  enableThinking: boolean;
  /** 0 = no limit. */
  thinkingBudget: number;
  // Load
  contextSize: number;
  device: "auto" | "cpu" | "gpu";
  gpuLayers: number;
  /** 0 = automatic. */
  threads: number;
  threadsBatch: number;
  batchSize: number;
  microBatchSize: number;
  flashAttention: "auto" | "on" | "off";
  kvCacheType: "f16" | "q8_0" | "q4_0";
  useMmap: boolean;
  useMlock: boolean;
  /** Empty = the template inside the model. */
  chatTemplate: string;
}

export interface SttSettings {
  // Per recording
  maxSeconds: number;
  // Load
  /** "auto" decides from the files; SenseVoice and Paraformer must be named. */
  type: "auto" | "whisper" | "transducer" | "sense_voice" | "paraformer";
  /** Whisper language code (`fa`, `en`, `ar`...). Empty = detect. */
  language: string;
  task: "transcribe" | "translate";
  threads: number;
  /** -1 = the model's default. */
  tailPaddings: number;
  decodingMethod: "greedy_search" | "modified_beam_search";
  useItn: boolean;
}

export interface TtsSettings {
  // Per sentence
  speed: number;
  /** 1 = the voice as it is. Changes the pitch, not the speed. */
  pitch: number;
  volume: number;
  speakerId: number;
  silenceScale: number;
  // Load
  type: "auto" | "vits" | "kokoro";
  threads: number;
  noiseScale: number;
  noiseScaleW: number;
  lengthScale: number;
}

export interface TalkSettings {
  /** Speak the answer while it is being written. */
  autoSpeak: boolean;
  /** Load the chosen models when the app opens. */
  autoLoad: boolean;
  /** Forget the conversation (the model's memory) before every question. */
  oneShot: boolean;
}

export interface StudioSettings {
  llm: LlmSettings;
  stt: SttSettings;
  tts: TtsSettings;
  talk: TalkSettings;
}

export const defaultLlm: LlmSettings = {
  systemPrompt:
    "You are a friendly voice assistant. Answer in the language the user speaks, in short, clear sentences, without lists or markdown.",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  minP: 0,
  repeatPenalty: 1.1,
  presencePenalty: 0,
  maxTokens: 512,
  seed: -1,
  stop: "",
  enableThinking: false,
  thinkingBudget: 0,
  contextSize: 4096,
  device: "auto",
  gpuLayers: 999,
  threads: 0,
  threadsBatch: 0,
  batchSize: 0,
  microBatchSize: 0,
  flashAttention: "auto",
  kvCacheType: "f16",
  useMmap: true,
  useMlock: false,
  chatTemplate: "",
};

export const defaultStt: SttSettings = {
  maxSeconds: 60,
  type: "auto",
  language: "",
  task: "transcribe",
  threads: 2,
  tailPaddings: -1,
  decodingMethod: "greedy_search",
  useItn: true,
};

export const defaultTts: TtsSettings = {
  speed: 1,
  pitch: 1,
  volume: 1,
  speakerId: 0,
  silenceScale: 0.2,
  type: "auto",
  threads: 2,
  noiseScale: 0.667,
  noiseScaleW: 0.8,
  lengthScale: 1,
};

export const defaultTalk: TalkSettings = {
  autoSpeak: true,
  autoLoad: true,
  oneShot: false,
};

export const defaultSettings: StudioSettings = {
  llm: defaultLlm,
  stt: defaultStt,
  tts: defaultTts,
  talk: defaultTalk,
};

/** Merges what was stored over the defaults, so a new setting gets its default. */
export function mergeSettings(stored: Partial<StudioSettings> | null | undefined): StudioSettings {
  return {
    llm: { ...defaultLlm, ...(stored?.llm ?? {}) },
    stt: { ...defaultStt, ...(stored?.stt ?? {}) },
    tts: { ...defaultTts, ...(stored?.tts ?? {}) },
    talk: { ...defaultTalk, ...(stored?.talk ?? {}) },
  };
}

// ── what the plugins are called with ──

/** The settings fixed at load time: a change needs a reload to apply. */
export function llmLoadOptions(modelId: string, s: LlmSettings): LlmLoadOptions {
  return {
    modelId,
    contextSize: s.contextSize,
    device: s.device,
    gpuLayers: s.gpuLayers,
    threads: s.threads,
    threadsBatch: s.threadsBatch,
    batchSize: s.batchSize,
    microBatchSize: s.microBatchSize,
    flashAttention: s.flashAttention,
    kvCacheType: s.kvCacheType,
    useMmap: s.useMmap,
    useMlock: s.useMlock,
    chatTemplate: s.chatTemplate.trim() || undefined,
    systemPrompt: s.systemPrompt.trim() || undefined,
  };
}

export function llmChatOptions(s: LlmSettings): LlmChatOptions {
  const stop = s.stop
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    systemPrompt: s.systemPrompt,
    params: {
      maxTokens: s.maxTokens,
      temperature: s.temperature,
      topK: s.topK,
      topP: s.topP,
      minP: s.minP,
      repeatPenalty: s.repeatPenalty,
      presencePenalty: s.presencePenalty,
      seed: s.seed >= 0 ? s.seed : undefined,
      stop: stop.length > 0 ? stop : undefined,
      enableThinking: s.enableThinking,
      thinkingBudget: s.enableThinking && s.thinkingBudget > 0 ? s.thinkingBudget : undefined,
    },
  };
}

export function sttLoadOptions(modelId: string, s: SttSettings): RecognizerOptions {
  return {
    modelId,
    type: s.type,
    language: s.language.trim(),
    task: s.task,
    threads: s.threads,
    tailPaddings: s.tailPaddings,
    decodingMethod: s.decodingMethod,
    useItn: s.useItn,
  };
}

export function ttsLoadOptions(modelId: string, s: TtsSettings): SynthesizerOptions {
  return {
    modelId,
    type: s.type,
    threads: s.threads,
    noiseScale: s.noiseScale,
    noiseScaleW: s.noiseScaleW,
    lengthScale: s.lengthScale,
    silenceScale: s.silenceScale,
  };
}

/**
 * The model has no pitch control, but the playback rate changes speed and pitch
 * together. To change only the pitch by a factor p: play at rate p and
 * synthesise at speed / p, so the two cancel out in the speed.
 */
export function ttsSpeakOptions(s: TtsSettings): SpeakOptions {
  const pitch = Math.min(2, Math.max(0.5, s.pitch));
  return {
    speed: Math.min(3, Math.max(0.3, s.speed / pitch)),
    rate: pitch,
    speakerId: s.speakerId,
    silenceScale: s.silenceScale,
  };
}

/** A string that changes when a load-time setting changes. */
export function loadSignature(kind: "llm" | "stt" | "tts", settings: StudioSettings): string {
  if (kind === "llm") {
    const s = settings.llm;
    return JSON.stringify([
      s.contextSize, s.device, s.gpuLayers, s.threads, s.threadsBatch, s.batchSize,
      s.microBatchSize, s.flashAttention, s.kvCacheType, s.useMmap, s.useMlock, s.chatTemplate,
    ]);
  }
  if (kind === "stt") {
    const s = settings.stt;
    return JSON.stringify([s.type, s.language, s.task, s.threads, s.tailPaddings, s.decodingMethod, s.useItn]);
  }
  const s = settings.tts;
  return JSON.stringify([s.type, s.threads, s.noiseScale, s.noiseScaleW, s.lengthScale]);
}
