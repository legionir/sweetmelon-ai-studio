/**
 * -----------------------------------------------------------------------
 * PLUGIN WRAPPERS — the plugins of the core this app uses
 * -----------------------------------------------------------------------
 * Every call is written as `window.NativeSDK.<plugin>.<method>(...)`, because
 * `plugin_selection: mode auto` finds the plugins by scanning the built app for
 * exactly that text (`sweetmelon detect`). Keep the literals: no aliases, no
 * dynamic property access, or the plugin is left out of the build.
 */
import type {
  AiModel,
  LlmChatOptions,
  LlmLoadOptions,
  RecognizerOptions,
  SpeakOptions,
  SynthesizerOptions,
} from "./sdk";

function missing(): never {
  throw new Error("This needs the Android/iOS build of the app.");
}

// ── storage ──

export async function storeGet<T>(key: string, fallback: T): Promise<T> {
  if (window.NativeSDK) {
    try {
      const value = await window.NativeSDK.storage.get(key);
      if (value !== null && value !== undefined) return value as T;
    } catch {
      /* plugin missing in this build: use localStorage */
    }
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  if (window.NativeSDK) {
    try {
      await window.NativeSDK.storage.set(key, value);
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

// ── feedback ──

export function notify(text: string, duration: "short" | "long" = "short"): void {
  if (window.NativeSDK) {
    void window.NativeSDK.toast.show(text, { duration }).catch(() => {});
    return;
  }
  window.dispatchEvent(new CustomEvent("studio:toast", { detail: text }));
}

export function hapticTap(): void {
  if (!window.NativeSDK) return;
  void window.NativeSDK.haptic.lightImpact().catch(() => {});
}

/**
 * `safe_area` plugin — height of the status bar as `--safe-top`. Never smaller
 * than 24 px: a read of 0 right after the app comes back must not push the page
 * under the bar.
 */
export async function applySafeArea(): Promise<void> {
  if (!window.NativeSDK) return;
  let top = 0;
  try {
    const insets = await window.NativeSDK.safeArea.getInsets();
    top = Math.round(insets?.padding?.top ?? 0);
  } catch {
    /* keep the default */
  }
  document.documentElement.style.setProperty("--safe-top", `${Math.max(top, 24)}px`);
}

/** `back_button` plugin — Android back is in-app navigation. */
export async function interceptBackButton(onPressed: () => void): Promise<() => void> {
  if (!window.NativeSDK) return () => {};
  try {
    await window.NativeSDK.backButton.enableIntercept();
    window.NativeSDK.on("backButton.pressed", onPressed);
    return () => window.NativeSDK?.off("backButton.pressed", onPressed);
  } catch {
    return () => {};
  }
}

export async function minimizeApp(): Promise<void> {
  if (!window.NativeSDK) return;
  try {
    await window.NativeSDK.backButton.minimizeApp();
  } catch {
    /* ignore */
  }
}

// ── events ──

/** Subscribes to a plugin event. Returns the function that unsubscribes. */
export function onEvent<T>(event: string, callback: (data: T) => void): () => void {
  if (!window.NativeSDK) return () => {};
  const handler = (data: unknown) => callback(data as T);
  window.NativeSDK.on(event, handler);
  return () => window.NativeSDK?.off(event, handler);
}

// ── model_manager ──

export async function listModels(kind?: string): Promise<AiModel[]> {
  if (!window.NativeSDK) return [];
  const result = await window.NativeSDK.modelManager.list(kind);
  return result.models ?? [];
}

/** Opens the file picker; the files (or an archive) become one model. */
export async function importModel(kind: string): Promise<AiModel | null> {
  if (!window.NativeSDK) return missing();
  const result = await window.NativeSDK.modelManager.import({ kind });
  return result.imported ? (result.model ?? null) : null;
}

export async function renameModel(id: string, name: string): Promise<AiModel> {
  if (!window.NativeSDK) return missing();
  return (await window.NativeSDK.modelManager.rename(id, name)).model;
}

export async function removeModel(id: string): Promise<void> {
  if (!window.NativeSDK) return missing();
  await window.NativeSDK.modelManager.remove(id);
}

// ── llm ──

export async function llmLoad(options: LlmLoadOptions) {
  if (!window.NativeSDK) return missing();
  return window.NativeSDK.llm.load(options);
}

export async function llmUnload(): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.llm.unload();
}

export async function llmChat(text: string, options: LlmChatOptions) {
  if (!window.NativeSDK) return missing();
  return window.NativeSDK.llm.chat(text, options);
}

export async function llmStop(): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.llm.stop().catch(() => {});
}

export async function llmReset(): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.llm.reset({ keepSystemPrompt: true }).catch(() => {});
}

export async function llmSetSystemPrompt(text: string | null): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.llm.setSystemPrompt(text).catch(() => {});
}

// ── speech_offline: recognition ──

export async function sttLoad(options: RecognizerOptions) {
  if (!window.NativeSDK) return missing();
  return window.NativeSDK.speechOffline.loadRecognizer(options);
}

export async function sttUnload(): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.speechOffline.unloadRecognizer();
}

export async function sttStart(maxSeconds: number) {
  if (!window.NativeSDK) return missing();
  return window.NativeSDK.speechOffline.startListening({ maxSeconds });
}

export async function sttStop() {
  if (!window.NativeSDK) return missing();
  return window.NativeSDK.speechOffline.stopListening();
}

export async function sttCancel(): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.speechOffline.cancelListening().catch(() => {});
}

// ── speech_offline: synthesis ──

export async function ttsLoad(options: SynthesizerOptions) {
  if (!window.NativeSDK) return missing();
  return window.NativeSDK.speechOffline.loadSynthesizer(options);
}

export async function ttsUnload(): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.speechOffline.unloadSynthesizer();
}

export async function ttsSpeak(text: string, options: SpeakOptions) {
  if (!window.NativeSDK) return missing();
  return window.NativeSDK.speechOffline.speak(text, options);
}

export async function ttsStop(): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.speechOffline.stopSpeaking().catch(() => {});
}

export async function ttsSetVolume(volume: number): Promise<void> {
  if (!window.NativeSDK) return;
  await window.NativeSDK.speechOffline.setVolume(volume).catch(() => {});
}
