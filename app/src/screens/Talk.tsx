import { useEffect, useRef, useState } from "react";
import { Brain, Loader2, Mic, MicOff, Send, Square, Trash2 } from "lucide-react";
import { useStudio, type ChatMessage, type EngineStatus, type Kind } from "../state/Studio";
import { cn } from "../utils/cn";

const TALK_LABEL = {
  idle: "Hold to talk",
  listening: "Listening… release to send",
  transcribing: "Understanding…",
  thinking: "Thinking…",
  speaking: "Speaking…",
} as const;

export function Talk({ onOpenModels }: { onOpenModels: () => void }) {
  const { messages, talk, canTalk, engines, stopAll, clearChat, sendText, native } = useStudio();
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);

  // Keep the newest words in view while the answer streams in.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const busy = talk === "thinking" || talk === "speaking";

  const submit = () => {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    void sendText(text);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Chip kind="stt" label="Ears" engine={engines.stt} onClick={onOpenModels} />
        <Chip kind="llm" label="Brain" engine={engines.llm} onClick={onOpenModels} />
        <Chip kind="tts" label="Voice" engine={engines.tts} onClick={onOpenModels} />
        <span className="flex-1" />
        {messages.length > 0 && (
          <button
            onClick={() => void clearChat()}
            aria-label="Clear the conversation"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 active:bg-white/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={list} className="selectable min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-2">
        {messages.length === 0 && <Empty native={native} canTalk={canTalk} onOpenModels={onOpenModels} />}
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
      </div>

      <div className="shrink-0 border-t border-white/5 bg-[#0a0a12]/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-4 flex items-center gap-2">
          <input
            aria-label="Type a message"
            dir="auto"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="…or type"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-400/50"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || engines.llm.state !== "ready"}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fuchsia-500 text-white disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="w-12" />
          <HoldButton />
          <div className="flex w-12 justify-center">
            {busy && (
              <button
                onClick={() => void stopAll()}
                aria-label="Stop"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-white/80 active:bg-white/10"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-white/45" aria-live="polite">
          {canTalk ? TALK_LABEL[talk] : "Load a speech and a language model to talk"}
        </p>
      </div>
    </div>
  );
}

/** The big button: held while speaking, slid up to cancel. */
function HoldButton() {
  const { talk, level, canTalk, startTalk, finishTalk, cancelTalk } = useStudio();
  const [cancelling, setCancelling] = useState(false);
  const origin = useRef(0);
  const listening = talk === "listening";
  const working = talk === "transcribing";

  return (
    <button
      aria-label="Hold to talk"
      disabled={working}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = e.clientY;
        setCancelling(false);
        void startTalk();
      }}
      onPointerMove={(e) => {
        if (talk === "listening") setCancelling(origin.current - e.clientY > 90);
      }}
      onPointerUp={() => {
        if (cancelling) void cancelTalk();
        else void finishTalk();
        setCancelling(false);
      }}
      onPointerCancel={() => {
        void cancelTalk();
        setCancelling(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "none" }}
      className="relative flex h-24 w-24 items-center justify-center"
    >
      {listening && (
        <>
          <span className="pulse-ring absolute inset-0 rounded-full bg-fuchsia-500/40" />
          <span
            className="absolute inset-0 rounded-full bg-fuchsia-500/30 transition-transform"
            style={{ transform: `scale(${1 + level * 0.6})` }}
          />
        </>
      )}
      <span
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition",
          cancelling
            ? "bg-red-500 shadow-red-500/40"
            : canTalk
              ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-fuchsia-500/30"
              : "bg-white/10 text-white/40 shadow-none",
          listening && "scale-110",
        )}
      >
        {working ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : cancelling ? (
          <MicOff className="h-8 w-8" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </span>
    </button>
  );
}

function Chip({
  kind,
  label,
  engine,
  onClick,
}: {
  kind: Kind;
  label: string;
  engine: EngineStatus;
  onClick: () => void;
}) {
  const dot =
    engine.state === "ready"
      ? "bg-emerald-400"
      : engine.state === "loading"
        ? "animate-pulse bg-amber-400"
        : engine.state === "error"
          ? "bg-red-400"
          : "bg-white/25";
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${engine.state}`}
      data-kind={kind}
      className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 active:bg-white/10"
    >
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </button>
  );
}

function Empty({ native, canTalk, onOpenModels }: { native: boolean; canTalk: boolean; onOpenModels: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5">
        <Brain className="h-8 w-8 text-fuchsia-300/70" />
      </div>
      <h2 className="text-lg font-semibold text-white">
        {canTalk ? "Press and hold the button" : "Add your models"}
      </h2>
      <p className="max-w-xs text-sm leading-relaxed text-white/45">
        {!native
          ? "The models run on the phone, so this needs the Android or iOS app."
          : canTalk
            ? "Speak, let go, and the answer is spoken back. Everything stays on this phone."
            : "Speech recognition, a language model and a voice. Pick the files from your phone: nothing is downloaded."}
      </p>
      {!canTalk && native && (
        <button
          onClick={onOpenModels}
          className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Open Models
        </button>
      )}
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
          mine
            ? "rounded-br-md bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white"
            : "rounded-bl-md bg-white/[0.07] text-white/90",
          message.error && "border border-red-400/30 bg-red-500/10 text-red-200",
        )}
      >
        {message.thinking && (
          <p dir="auto" className="mb-2 border-l-2 border-white/15 pl-2 text-xs italic text-white/40">
            {message.thinking}
          </p>
        )}
        <p dir="auto" className="whitespace-pre-wrap break-words">
          {message.text}
          {message.pending && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
        </p>
        {(message.stats || message.stopped) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/30">
            {message.stopped && <span>stopped</span>}
            {message.stats && <span>{message.stats}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
