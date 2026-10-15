import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  hapticTap,
  importModel,
  listModels,
  llmChat,
  llmLoad,
  llmReset,
  llmStop,
  llmUnload,
  notify,
  onEvent,
  removeModel,
  renameModel,
  sttCancel,
  sttLoad,
  sttStart,
  sttStop,
  sttUnload,
  storeGet,
  storeSet,
  ttsLoad,
  ttsSetVolume,
  ttsSpeak,
  ttsStop,
  ttsUnload,
} from "../native/bridge";
import { bridgeIsNative, errorText, waitForBridge, type AiModel } from "../native/sdk";
import {
  defaultSettings,
  llmChatOptions,
  llmLoadOptions,
  loadSignature,
  mergeSettings,
  sttLoadOptions,
  ttsLoadOptions,
  ttsSpeakOptions,
  type StudioSettings,
} from "../ai/settings";
import { cleanForSpeech, SentenceSplitter } from "../ai/speech";

export type Kind = "llm" | "stt" | "tts";
export const KINDS: Kind[] = ["llm", "stt", "tts"];

export type TalkState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

export interface EngineStatus {
  state: "empty" | "loading" | "ready" | "error";
  modelId?: string;
  message?: string;
  /** One line about the loaded model (context size, sample rate...). */
  info?: string;
  /** Voices in the loaded TTS model. */
  speakers?: number;
  /** The load settings it was loaded with: a different value means "reload". */
  signature?: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  pending?: boolean;
  stopped?: boolean;
  error?: boolean;
  stats?: string;
}

export interface ImportProgress {
  kind: Kind;
  stage: string;
  file?: string;
  index?: number;
  files?: number;
}

interface StudioValue {
  native: boolean;
  ready: boolean;
  settings: StudioSettings;
  updateSettings: (change: (current: StudioSettings) => StudioSettings) => void;
  resetSettings: (part: keyof StudioSettings) => void;
  models: Record<Kind, AiModel[]>;
  selected: Partial<Record<Kind, string>>;
  engines: Record<Kind, EngineStatus>;
  importing: ImportProgress | null;
  /** The load settings changed since the model was loaded. */
  needsReload: (kind: Kind) => boolean;
  addModel: (kind: Kind) => Promise<void>;
  loadModel: (kind: Kind, id: string) => Promise<void>;
  unloadModel: (kind: Kind) => Promise<void>;
  deleteModel: (kind: Kind, id: string) => Promise<void>;
  renameModelTo: (kind: Kind, id: string, name: string) => Promise<void>;
  // Talking
  messages: ChatMessage[];
  talk: TalkState;
  level: number;
  canTalk: boolean;
  startTalk: () => Promise<void>;
  finishTalk: () => Promise<void>;
  cancelTalk: () => Promise<void>;
  sendText: (text: string) => Promise<void>;
  stopAll: () => Promise<void>;
  clearChat: () => Promise<void>;
}

const StudioContext = createContext<StudioValue | null>(null);

const SETTINGS_KEY = "studio.settings";
const SELECTED_KEY = "studio.selected";

const emptyEngines = (): Record<Kind, EngineStatus> => ({
  llm: { state: "empty" },
  stt: { state: "empty" },
  tts: { state: "empty" },
});

export function StudioProvider({ children }: { children: ReactNode }) {
  const [native, setNative] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<StudioSettings>(defaultSettings);
  const [models, setModels] = useState<Record<Kind, AiModel[]>>({ llm: [], stt: [], tts: [] });
  const [selected, setSelected] = useState<Partial<Record<Kind, string>>>({});
  const [engines, setEngines] = useState<Record<Kind, EngineStatus>>(emptyEngines);
  const [importing, setImporting] = useState<ImportProgress | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [talk, setTalk] = useState<TalkState>("idle");
  const [level, setLevel] = useState(0);

  // Mirrors for the event handlers, which outlive a render.
  const settingsRef = useRef(settings);
  const enginesRef = useRef(engines);
  const talkRef = useRef(talk);
  const hydrated = useRef(false);
  const holding = useRef(false);
  const listeningSince = useRef(0);
  const requestId = useRef<string | null>(null);
  const assistantId = useRef<number | null>(null);
  const generating = useRef(false);
  const splitter = useRef(new SentenceSplitter());
  const speakCounter = useRef(0);
  const speaking = useRef(new Set<string>());
  const messageCounter = useRef(0);
  const importKind = useRef<Kind | null>(null);

  settingsRef.current = settings;
  enginesRef.current = engines;
  talkRef.current = talk;

  const setTalkState = useCallback((state: TalkState) => {
    talkRef.current = state;
    setTalk(state);
  }, []);

  const patchEngine = useCallback((kind: Kind, status: EngineStatus) => {
    setEngines((current) => {
      const next = { ...current, [kind]: status };
      enginesRef.current = next;
      return next;
    });
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const [llm, stt, tts] = await Promise.all([listModels("llm"), listModels("stt"), listModels("tts")]);
      setModels({ llm, stt, tts });
      return { llm, stt, tts };
    } catch (error) {
      notify(errorText(error));
      return null;
    }
  }, []);

  // ── loading models ──

  const loadModel = useCallback(
    async (kind: Kind, id: string) => {
      const current = settingsRef.current;
      patchEngine(kind, { state: "loading", modelId: id });
      try {
        let info = "";
        let speakers: number | undefined;
        if (kind === "llm") {
          const r = await llmLoad(llmLoadOptions(id, current.llm));
          info = `${r.contextSize} tokens · ${r.backend}${r.vision ? " · sees images" : ""}`;
        } else if (kind === "stt") {
          const r = await sttLoad(sttLoadOptions(id, current.stt));
          info = r.type.replace("_", " ");
        } else {
          const r = await ttsLoad(ttsLoadOptions(id, current.tts));
          info = `${r.type} · ${Math.round(r.sampleRate / 1000)} kHz`;
          speakers = r.speakers;
          void ttsSetVolume(current.tts.volume);
        }
        patchEngine(kind, {
          state: "ready",
          modelId: id,
          info,
          speakers,
          signature: loadSignature(kind, current),
        });
        setSelected((s) => {
          const next = { ...s, [kind]: id };
          void storeSet(SELECTED_KEY, next);
          return next;
        });
      } catch (error) {
        const message = errorText(error);
        patchEngine(kind, { state: "error", modelId: id, message });
        notify(message, "long");
      }
    },
    [patchEngine],
  );

  const unloadModel = useCallback(
    async (kind: Kind) => {
      try {
        if (kind === "llm") await llmUnload();
        else if (kind === "stt") await sttUnload();
        else await ttsUnload();
      } catch (error) {
        notify(errorText(error));
      }
      patchEngine(kind, { state: "empty" });
    },
    [patchEngine],
  );

  // ── starting up ──

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const isNative = await waitForBridge();
      const stored = await storeGet<Partial<StudioSettings> | null>(SETTINGS_KEY, null);
      const chosen = await storeGet<Partial<Record<Kind, string>>>(SELECTED_KEY, {});
      if (cancelled) return;

      const merged = mergeSettings(stored);
      settingsRef.current = merged;
      setSettings(merged);
      setSelected(chosen);
      setNative(isNative && bridgeIsNative());
      hydrated.current = true;

      const found = isNative ? await refreshModels() : null;
      setReady(true);
      if (!found || !merged.talk.autoLoad) return;

      // One at a time: loading two models together doubles the peak memory.
      for (const kind of ["stt", "tts", "llm"] as Kind[]) {
        const id = chosen[kind];
        if (id && found[kind].some((m) => m.id === id) && !cancelled) {
          await loadModel(kind, id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadModel, refreshModels]);

  // Save the settings a moment after the last change.
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => void storeSet(SETTINGS_KEY, settings), 400);
    return () => window.clearTimeout(timer);
  }, [settings]);

  // The volume applies to what is playing, not only to the next sentence.
  useEffect(() => {
    if (engines.tts.state === "ready") void ttsSetVolume(settings.tts.volume);
  }, [settings.tts.volume, engines.tts.state]);

  const updateSettings = useCallback((change: (current: StudioSettings) => StudioSettings) => {
    setSettings((current) => change(current));
  }, []);

  const resetSettings = useCallback((part: keyof StudioSettings) => {
    setSettings((current) => ({ ...current, [part]: defaultSettings[part] }));
  }, []);

  const needsReload = useCallback(
    (kind: Kind) => {
      const engine = engines[kind];
      return engine.state === "ready" && engine.signature !== loadSignature(kind, settings);
    },
    [engines, settings],
  );

  // ── the model files ──

  const addModel = useCallback(
    async (kind: Kind) => {
      if (importKind.current) return;
      importKind.current = kind;
      setImporting({ kind, stage: "picking" });
      try {
        const model = await importModel(kind);
        if (!model) return;
        await refreshModels();
        notify(`Added ${model.name}`);
        // The first model of a kind is chosen and loaded for the user.
        if (enginesRef.current[kind].state === "empty") await loadModel(kind, model.id);
      } catch (error) {
        notify(errorText(error), "long");
      } finally {
        importKind.current = null;
        setImporting(null);
      }
    },
    [loadModel, refreshModels],
  );

  const deleteModel = useCallback(
    async (kind: Kind, id: string) => {
      if (enginesRef.current[kind].modelId === id) await unloadModel(kind);
      try {
        await removeModel(id);
      } catch (error) {
        notify(errorText(error));
      }
      setSelected((s) => {
        if (s[kind] !== id) return s;
        const next = { ...s };
        delete next[kind];
        void storeSet(SELECTED_KEY, next);
        return next;
      });
      await refreshModels();
    },
    [refreshModels, unloadModel],
  );

  const renameModelTo = useCallback(
    async (_kind: Kind, id: string, name: string) => {
      try {
        await renameModel(id, name);
        await refreshModels();
      } catch (error) {
        notify(errorText(error));
      }
    },
    [refreshModels],
  );

  // ── talking ──

  const appendMessage = useCallback((message: Omit<ChatMessage, "id">): number => {
    const id = ++messageCounter.current;
    setMessages((list) => [...list, { ...message, id }]);
    return id;
  }, []);

  const patchMessage = useCallback((id: number, change: (m: ChatMessage) => ChatMessage) => {
    setMessages((list) => list.map((m) => (m.id === id ? change(m) : m)));
  }, []);

  const speakSentences = useCallback((sentences: string[]) => {
    if (!settingsRef.current.talk.autoSpeak) return;
    if (enginesRef.current.tts.state !== "ready") return;
    for (const raw of sentences) {
      const text = cleanForSpeech(raw);
      if (!text) continue;
      const id = `s${++speakCounter.current}`;
      speaking.current.add(id);
      void ttsSpeak(text, { id, ...ttsSpeakOptions(settingsRef.current.tts) }).then(
        (result) => {
          if (!result.queued) speaking.current.delete(id);
        },
        (error) => {
          speaking.current.delete(id);
          notify(errorText(error));
        },
      );
    }
  }, []);

  /** Back to idle once the model is done and nothing is left to say. */
  const settle = useCallback(() => {
    if (generating.current || speaking.current.size > 0) return;
    if (talkRef.current === "thinking" || talkRef.current === "speaking") setTalkState("idle");
  }, [setTalkState]);

  useEffect(() => {
    const offs = [
      onEvent<{ requestId: string; text: string; thinking: string }>("llm.token", (e) => {
        if (e.requestId !== requestId.current || assistantId.current === null) return;
        patchMessage(assistantId.current, (m) => ({
          ...m,
          text: m.text + e.text,
          thinking: e.thinking ? (m.thinking ?? "") + e.thinking : m.thinking,
        }));
        if (e.text) {
          if (talkRef.current === "thinking") setTalkState("speaking");
          speakSentences(splitter.current.push(e.text));
        }
      }),
      onEvent<{
        requestId: string;
        text: string;
        stopped: boolean;
        usage?: { completionTokens?: number; durationMs?: number; timeToFirstTokenMs?: number } | null;
      }>("llm.done", (e) => {
        if (e.requestId !== requestId.current) return;
        generating.current = false;
        const usage = e.usage;
        const seconds = (usage?.durationMs ?? 0) / 1000;
        const stats =
          usage?.completionTokens && seconds > 0
            ? `${usage.completionTokens} tokens · ${(usage.completionTokens / seconds).toFixed(1)} tok/s`
            : undefined;
        if (assistantId.current !== null) {
          patchMessage(assistantId.current, (m) => ({ ...m, pending: false, stopped: e.stopped, stats }));
        }
        if (!e.stopped) speakSentences(splitter.current.flush());
        splitter.current.reset();
        settle();
      }),
      onEvent<{ requestId: string; message: string }>("llm.error", (e) => {
        if (e.requestId !== requestId.current) return;
        generating.current = false;
        if (assistantId.current !== null) {
          patchMessage(assistantId.current, (m) => ({
            ...m,
            pending: false,
            error: true,
            text: m.text || e.message,
          }));
        }
        notify(e.message, "long");
        splitter.current.reset();
        setTalkState("idle");
      }),
      onEvent<{ id?: string; state: string }>("speechOffline.speak", (e) => {
        if (e.state === "started" && talkRef.current !== "listening") setTalkState("speaking");
        if ((e.state === "finished" || e.state === "error") && e.id) {
          speaking.current.delete(e.id);
          settle();
        }
        if (e.state === "idle") settle();
      }),
      onEvent<{ level: number }>("speechOffline.level", (e) => setLevel(e.level)),
      onEvent<{ id: string; stage: string; file?: string; index?: number; files?: number }>(
        "modelManager.progress",
        (e) => {
          const kind = importKind.current;
          if (kind) setImporting({ kind, stage: e.stage, file: e.file, index: e.index, files: e.files });
        },
      ),
    ];
    return () => offs.forEach((off) => off());
  }, [patchMessage, settle, setTalkState, speakSentences]);

  const stopAll = useCallback(async () => {
    holding.current = false;
    generating.current = false;
    speaking.current.clear();
    splitter.current.reset();
    await Promise.all([llmStop(), ttsStop(), sttCancel()]);
    if (assistantId.current !== null) {
      patchMessage(assistantId.current, (m) => ({ ...m, pending: false, stopped: true }));
    }
    setLevel(0);
    setTalkState("idle");
  }, [patchMessage, setTalkState]);

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      if (enginesRef.current.llm.state !== "ready") {
        notify("Load a language model first (Models tab).");
        return;
      }
      if (generating.current) await stopAll();

      appendMessage({ role: "user", text });
      const answer = appendMessage({ role: "assistant", text: "", pending: true });
      assistantId.current = answer;
      splitter.current.reset();
      speaking.current.clear();
      setTalkState("thinking");
      generating.current = true;

      try {
        if (settingsRef.current.talk.oneShot) await llmReset();
        const started = await llmChat(text, llmChatOptions(settingsRef.current.llm));
        if (!started.started) {
          throw new Error(started.reason === "busy" ? "The model is still answering." : "The model is not loaded.");
        }
        requestId.current = started.requestId ?? null;
      } catch (error) {
        generating.current = false;
        patchMessage(answer, (m) => ({ ...m, pending: false, error: true, text: errorText(error) }));
        setTalkState("idle");
      }
    },
    [appendMessage, patchMessage, setTalkState, stopAll],
  );

  const canTalk = engines.stt.state === "ready" && engines.llm.state === "ready";

  const startTalk = useCallback(async () => {
    if (enginesRef.current.stt.state !== "ready" || enginesRef.current.llm.state !== "ready") {
      notify("Load a speech-to-text model and a language model first (Models tab).", "long");
      return;
    }
    if (talkRef.current === "listening" || talkRef.current === "transcribing") return;
    if (talkRef.current !== "idle") await stopAll();

    holding.current = true;
    hapticTap();
    try {
      const started = await sttStart(settingsRef.current.stt.maxSeconds);
      if (!started.started) {
        holding.current = false;
        notify(
          started.reason === "permission_denied"
            ? "Allow the microphone in the phone's settings."
            : "Could not start listening.",
          "long",
        );
        return;
      }
      listeningSince.current = Date.now();
      setTalkState("listening");
      // Let go before the recording began: stop it again.
      if (!holding.current) await finishTalkRef.current();
    } catch (error) {
      holding.current = false;
      notify(errorText(error), "long");
    }
  }, [setTalkState, stopAll]);

  const finishTalk = useCallback(async () => {
    holding.current = false;
    if (talkRef.current !== "listening") return;

    const held = Date.now() - listeningSince.current;
    setLevel(0);
    if (held < 400) {
      await sttCancel();
      setTalkState("idle");
      notify("Hold the button while you speak.");
      return;
    }

    setTalkState("transcribing");
    try {
      const result = await sttStop();
      const text = (result.text ?? "").trim();
      if (!text) {
        setTalkState("idle");
        notify("I did not catch that.");
        return;
      }
      await sendText(text);
    } catch (error) {
      setTalkState("idle");
      notify(errorText(error), "long");
    }
  }, [sendText, setTalkState]);

  // startTalk needs finishTalk, which needs sendText: break the loop with a ref.
  const finishTalkRef = useRef(finishTalk);
  finishTalkRef.current = finishTalk;

  const cancelTalk = useCallback(async () => {
    holding.current = false;
    setLevel(0);
    if (talkRef.current === "listening") {
      await sttCancel();
      setTalkState("idle");
    }
  }, [setTalkState]);

  const clearChat = useCallback(async () => {
    await stopAll();
    setMessages([]);
    assistantId.current = null;
    requestId.current = null;
    await llmReset();
  }, [stopAll]);

  const value = useMemo<StudioValue>(
    () => ({
      native,
      ready,
      settings,
      updateSettings,
      resetSettings,
      models,
      selected,
      engines,
      importing,
      needsReload,
      addModel,
      loadModel,
      unloadModel,
      deleteModel,
      renameModelTo,
      messages,
      talk,
      level,
      canTalk,
      startTalk,
      finishTalk,
      cancelTalk,
      sendText,
      stopAll,
      clearChat,
    }),
    [
      native, ready, settings, updateSettings, resetSettings, models, selected, engines, importing,
      needsReload, addModel, loadModel, unloadModel, deleteModel, renameModelTo, messages, talk,
      level, canTalk, startTalk, finishTalk, cancelTalk, sendText, stopAll, clearChat,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used within a StudioProvider");
  return value;
}
