import { useState } from "react";
import { AudioLines, Brain, Check, Ear, Loader2, Pencil, Plus, Power, Trash2, TriangleAlert } from "lucide-react";
import { useStudio, type EngineStatus, type Kind } from "../state/Studio";
import type { AiModel } from "../native/sdk";
import { formatBytes } from "../utils/format";
import { cn } from "../utils/cn";

const INFO: Record<
  Kind,
  { title: string; short: string; icon: typeof Brain; help: string[] }
> = {
  stt: {
    title: "Speech to text",
    short: "Ears",
    icon: Ear,
    help: [
      "Whisper (sherpa-onnx): pick the encoder, decoder and tokens files together, or the .tar.bz2 from the sherpa-onnx releases.",
      "For Persian use Whisper small or bigger. tiny and base understand little Persian.",
      "SenseVoice, Paraformer and transducer models work too (set the type in Settings).",
    ],
  },
  llm: {
    title: "Language model",
    short: "Brain",
    icon: Brain,
    help: [
      "A .gguf file (Hugging Face has thousands). Pick it from your phone's storage.",
      "To let it see images, pick its mmproj .gguf together with the model.",
      "Small models (1–4 billion parameters, Q4) run best on a phone.",
    ],
  },
  tts: {
    title: "Text to speech",
    short: "Voice",
    icon: AudioLines,
    help: [
      "A Piper voice from the sherpa-onnx releases (vits-piper-…tar.bz2), picked as it is. A Persian one is vits-piper-fa_IR-gyro-medium.",
      "Or pick the files yourself: the .onnx, tokens.txt and the espeak-ng-data folder as a .zip.",
      "Kokoro voices work too: add voices.bin.",
    ],
  },
};

export function Models() {
  const { native, importing } = useStudio();
  return (
    <div className="h-full space-y-4 overflow-y-auto overscroll-contain px-4 pb-8 pt-4">
      {!native && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Importing models needs the Android or iOS app.
        </div>
      )}
      {(["stt", "llm", "tts"] as Kind[]).map((kind) => (
        <Group key={kind} kind={kind} disabled={!native || importing !== null} />
      ))}
    </div>
  );
}

function Group({ kind, disabled }: { kind: Kind; disabled: boolean }) {
  const { models, engines, selected, addModel, importing, needsReload } = useStudio();
  const [helpOpen, setHelpOpen] = useState(false);
  const info = INFO[kind];
  const Icon = info.icon;
  const list = models[kind];
  const engine = engines[kind];
  const busy = importing?.kind === kind;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-label={info.title}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15">
          <Icon className="h-5 w-5 text-fuchsia-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{info.title}</h2>
          <p className="truncate text-xs text-white/40">{statusLine(engine, list)}</p>
        </div>
      </div>

      {needsReload(kind) && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          Settings changed: load the model again to apply them.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {list.map((model) => (
          <ModelRow
            key={model.id}
            kind={kind}
            model={model}
            engine={engine}
            chosen={selected[kind] === model.id}
          />
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => void addModel(kind)}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm font-medium text-white/80 active:bg-white/10 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {busy ? progressText(importing) : "Add from phone"}
        </button>
        <button
          onClick={() => setHelpOpen((o) => !o)}
          className="rounded-xl px-3 py-3 text-xs font-medium text-white/45 active:bg-white/10"
        >
          Which files?
        </button>
      </div>

      {helpOpen && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-white/[0.04] p-3 text-xs leading-relaxed text-white/55">
          {info.help.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ModelRow({
  kind,
  model,
  engine,
  chosen,
}: {
  kind: Kind;
  model: AiModel;
  engine: EngineStatus;
  chosen: boolean;
}) {
  const { loadModel, unloadModel, deleteModel, renameModelTo } = useStudio();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(model.name);
  const [confirming, setConfirming] = useState(false);

  const loaded = engine.modelId === model.id && engine.state === "ready";
  const loading = engine.modelId === model.id && engine.state === "loading";
  const failed = engine.modelId === model.id && engine.state === "error";

  return (
    <li
      className={cn(
        "rounded-xl border p-3",
        loaded ? "border-emerald-400/30 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.02]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              aria-label="Model name"
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setRenaming(false);
                  void renameModelTo(kind, model.id, name);
                }
              }}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none"
            />
          ) : (
            <p dir="auto" className="truncate text-sm font-medium text-white">
              {model.name}
            </p>
          )}
          <p className="mt-0.5 truncate text-[11px] text-white/35">
            {formatBytes(model.sizeBytes)} · {fileSummary(model)}
          </p>
          {loaded && engine.info && <p className="mt-0.5 text-[11px] text-emerald-300/80">{engine.info}</p>}
          {failed && <p className="mt-1 text-[11px] leading-snug text-red-300">{engine.message}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {renaming ? (
            <IconButton
              label="Save name"
              onClick={() => {
                setRenaming(false);
                void renameModelTo(kind, model.id, name);
              }}
            >
              <Check className="h-4 w-4" />
            </IconButton>
          ) : (
            <IconButton label="Rename" onClick={() => setRenaming(true)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton
            label={confirming ? "Tap again to delete" : "Delete"}
            danger={confirming}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                window.setTimeout(() => setConfirming(false), 3000);
              } else {
                void deleteModel(kind, model.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <button
        onClick={() => (loaded ? void unloadModel(kind) : void loadModel(kind, model.id))}
        disabled={loading}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition",
          loaded
            ? "bg-white/10 text-white/80 active:bg-white/15"
            : "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white",
          loading && "opacity-60",
        )}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
        {loading ? "Loading…" : loaded ? "Unload" : chosen ? "Load (your choice)" : "Load"}
      </button>
    </li>
  );
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg active:bg-white/10",
        danger ? "bg-red-500/20 text-red-300" : "text-white/45",
      )}
    >
      {children}
    </button>
  );
}

function statusLine(engine: EngineStatus, list: AiModel[]): string {
  if (engine.state === "loading") return "Loading…";
  if (engine.state === "ready") return `Ready · ${engine.info ?? ""}`.replace(/ · $/, "");
  if (engine.state === "error") return "Could not load";
  return list.length === 0 ? "No model yet" : "Not loaded";
}

function fileSummary(model: AiModel): string {
  const names = model.files.map((f) => f.name);
  const shown = names.slice(0, 2).join(", ");
  const more = names.length > 2 ? ` +${names.length - 2}` : "";
  const dirs = model.directories.length > 0 ? ` · ${model.directories.join(", ")}` : "";
  return `${shown}${more}${dirs}`;
}

function progressText(p: { stage: string; file?: string; index?: number; files?: number } | null): string {
  if (!p) return "Adding…";
  if (p.stage === "extracting") return `Unpacking ${p.file ?? ""}… (a big archive takes a while)`;
  if (p.stage === "moving") return `Adding ${p.index ?? 1}/${p.files ?? 1}…`;
  if (p.stage === "picking") return "Choose the files…";
  return "Adding…";
}
