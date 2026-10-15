/**
 * -----------------------------------------------------------------------
 * SWEETMELON BRIDGE — low-level access to `window.NativeSDK`
 * -----------------------------------------------------------------------
 * `js/native-sdk.js` (injected by the Sweetmelon build from the core) defines
 * `window.NativeSDK`, which forwards every call to a Flutter plugin. In a plain
 * browser that file is a placeholder, `window.NativeSDK` stays undefined and the
 * app shows what it can without the models.
 *
 * Only the `native/` folder touches `window.NativeSDK`.
 */

export interface AiModelFile {
  name: string;
  path: string;
  size: number;
}

export interface AiModel {
  id: string;
  kind: string;
  name: string;
  dir: string;
  files: AiModelFile[];
  directories: string[];
  sizeBytes: number;
  createdAt: string;
}

export interface LlmLoadOptions {
  modelId?: string;
  contextSize?: number;
  device?: "auto" | "cpu" | "gpu";
  gpuLayers?: number;
  threads?: number;
  threadsBatch?: number;
  batchSize?: number;
  microBatchSize?: number;
  flashAttention?: "auto" | "on" | "off";
  useMmap?: boolean;
  useMlock?: boolean;
  kvCacheType?: "f16" | "q8_0" | "q4_0";
  chatTemplate?: string;
  systemPrompt?: string;
}

export interface LlmChatOptions {
  systemPrompt?: string;
  params?: {
    maxTokens?: number;
    temperature?: number;
    topK?: number;
    topP?: number;
    minP?: number;
    repeatPenalty?: number;
    presencePenalty?: number;
    seed?: number;
    stop?: string[];
    enableThinking?: boolean;
    thinkingBudget?: number;
  };
}

export interface RecognizerOptions {
  modelId: string;
  type?: string;
  language?: string;
  task?: string;
  threads?: number;
  tailPaddings?: number;
  decodingMethod?: string;
  useItn?: boolean;
}

export interface SynthesizerOptions {
  modelId: string;
  type?: string;
  threads?: number;
  noiseScale?: number;
  noiseScaleW?: number;
  lengthScale?: number;
  silenceScale?: number;
}

export interface SpeakOptions {
  id?: string;
  speed?: number;
  speakerId?: number;
  silenceScale?: number;
  volume?: number;
  rate?: number;
}

export interface SweetmelonSdk {
  waitForReady(timeoutMs?: number): Promise<unknown>;
  on(event: string, callback: (data: unknown) => void): void;
  off(event: string, callback: (data: unknown) => void): void;

  modelManager: {
    import(options: { kind: string; name?: string; extract?: boolean }): Promise<{
      imported: boolean;
      reason?: string;
      model?: AiModel;
    }>;
    list(kind?: string): Promise<{ models: AiModel[] }>;
    rename(id: string, name: string): Promise<{ model: AiModel }>;
    remove(id: string): Promise<{ removed: boolean }>;
  };

  llm: {
    load(options: LlmLoadOptions): Promise<{
      loaded: boolean;
      contextSize: number;
      backend: string;
      vision: boolean;
    }>;
    unload(): Promise<unknown>;
    chat(text: string, options?: LlmChatOptions): Promise<{
      started: boolean;
      requestId?: string;
      reason?: string;
    }>;
    stop(): Promise<unknown>;
    reset(options?: { keepSystemPrompt?: boolean }): Promise<unknown>;
    setSystemPrompt(text: string | null): Promise<unknown>;
  };

  speechOffline: {
    loadRecognizer(options: RecognizerOptions): Promise<{ loaded: boolean; type: string }>;
    unloadRecognizer(): Promise<unknown>;
    startListening(options?: { maxSeconds?: number }): Promise<{ started: boolean; reason?: string }>;
    stopListening(): Promise<{ text: string; audioSeconds?: number; decodeMs?: number }>;
    cancelListening(): Promise<unknown>;
    loadSynthesizer(options: SynthesizerOptions): Promise<{
      loaded: boolean;
      type: string;
      sampleRate: number;
      speakers: number;
    }>;
    unloadSynthesizer(): Promise<unknown>;
    speak(text: string, options?: SpeakOptions): Promise<{ queued: boolean; reason?: string }>;
    stopSpeaking(): Promise<unknown>;
    setVolume(volume: number): Promise<unknown>;
  };

  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<unknown>;
  };

  toast: {
    show(text: string, options?: { duration?: string }): Promise<unknown>;
  };

  haptic: {
    lightImpact(): Promise<unknown>;
  };

  safeArea: {
    getInsets(): Promise<{ padding?: { top?: number } }>;
  };

  backButton: {
    enableIntercept(): Promise<unknown>;
    minimizeApp(): Promise<unknown>;
  };
}

declare global {
  interface Window {
    NativeSDK?: SweetmelonSdk;
    Native?: { call?: unknown };
    /** Set by app/public/js/native-sdk.js, the dev-server placeholder. */
    __SWEETMELON_SDK_PLACEHOLDER__?: boolean;
  }
}

export function bridgePresent(): boolean {
  return typeof window !== "undefined" && Boolean(window.NativeSDK);
}

export function bridgeIsNative(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.NativeSDK) &&
    typeof window.Native?.call === "function"
  );
}

/** Resolves once the native side answers. False in a browser. */
export async function waitForBridge(timeoutMs = 2000): Promise<boolean> {
  if (!bridgePresent()) return false;
  if (bridgeIsNative()) return true;
  try {
    await window.NativeSDK?.waitForReady(timeoutMs);
  } catch {
    return false;
  }
  return bridgeIsNative();
}

/** The message of whatever the bridge rejected with (`{ code, message }`). */
export function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "Something went wrong";
}
