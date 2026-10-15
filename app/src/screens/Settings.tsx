import { Choice, NumberField, Section, Slider, TextField, Toggle } from "../components/ui";
import { useStudio } from "../state/Studio";
import type { LlmSettings, SttSettings, TalkSettings, TtsSettings } from "../ai/settings";

/** Every knob of the three models. The ones fixed at load time say so. */
export function Settings() {
  const { settings, updateSettings, resetSettings, engines, needsReload } = useStudio();

  const llm = <K extends keyof LlmSettings>(key: K, value: LlmSettings[K]) =>
    updateSettings((s) => ({ ...s, llm: { ...s.llm, [key]: value } }));
  const stt = <K extends keyof SttSettings>(key: K, value: SttSettings[K]) =>
    updateSettings((s) => ({ ...s, stt: { ...s.stt, [key]: value } }));
  const tts = <K extends keyof TtsSettings>(key: K, value: TtsSettings[K]) =>
    updateSettings((s) => ({ ...s, tts: { ...s.tts, [key]: value } }));
  const talk = <K extends keyof TalkSettings>(key: K, value: TalkSettings[K]) =>
    updateSettings((s) => ({ ...s, talk: { ...s.talk, [key]: value } }));

  const L = settings.llm;
  const S = settings.stt;
  const T = settings.tts;
  const A = settings.talk;
  const reload = (kind: "llm" | "stt" | "tts") => (needsReload(kind) ? " · reload to apply" : "");
  const maxSpeaker = Math.max(0, (engines.tts.speakers ?? 1) - 1);

  return (
    <div className="h-full space-y-3 overflow-y-auto overscroll-contain px-4 pb-10 pt-4">
      <Section title="Conversation" hint="How talking works" defaultOpen onReset={() => resetSettings("talk")}>
        <Toggle
          label="Speak the answer"
          hint="Each sentence is spoken as soon as it is written."
          value={A.autoSpeak}
          onChange={(v) => talk("autoSpeak", v)}
        />
        <Toggle
          label="Load models when the app opens"
          hint="The models you chose last time."
          value={A.autoLoad}
          onChange={(v) => talk("autoLoad", v)}
        />
        <Toggle
          label="One question at a time"
          hint="The model forgets the earlier questions before each one: faster, and no memory."
          value={A.oneShot}
          onChange={(v) => talk("oneShot", v)}
        />
      </Section>

      <Section title="Language model: answers" hint="Applies to the next message" onReset={undefined}>
        <TextField
          label="System prompt"
          hint="Who the assistant is and how it should answer."
          rows={5}
          value={L.systemPrompt}
          onChange={(v) => llm("systemPrompt", v)}
        />
        <Slider
          label="Temperature"
          hint="Low: focused and repeatable. High: varied and creative."
          value={L.temperature}
          min={0}
          max={2}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => llm("temperature", v)}
        />
        <Slider
          label="Top P"
          hint="Only the most likely words that add up to this chance are considered."
          value={L.topP}
          min={0.05}
          max={1}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => llm("topP", v)}
        />
        <Slider
          label="Top K"
          hint="Only this many most likely words are considered. 0 turns it off."
          value={L.topK}
          min={0}
          max={200}
          step={1}
          onChange={(v) => llm("topK", v)}
        />
        <Slider
          label="Min P"
          hint="Drops words less likely than this fraction of the best one. 0 turns it off."
          value={L.minP}
          min={0}
          max={0.5}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => llm("minP", v)}
        />
        <Slider
          label="Repeat penalty"
          hint="Above 1 discourages repeating words. 1 turns it off."
          value={L.repeatPenalty}
          min={1}
          max={2}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => llm("repeatPenalty", v)}
        />
        <Slider
          label="Presence penalty"
          hint="Positive: moves to new topics. Negative: stays on topic."
          value={L.presencePenalty}
          min={-2}
          max={2}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => llm("presencePenalty", v)}
        />
        <Slider
          label="Longest answer"
          hint="Tokens (a token is a bit less than a word)."
          value={L.maxTokens}
          min={16}
          max={4096}
          step={16}
          onChange={(v) => llm("maxTokens", v)}
        />
        <NumberField
          label="Seed"
          hint="-1 = a new random seed every time. A fixed number gives the same answer to the same question."
          value={L.seed}
          min={-1}
          max={2147483647}
          onChange={(v) => llm("seed", v)}
        />
        <TextField
          label="Stop sequences"
          hint="One per line. The answer ends when the model writes one."
          rows={2}
          value={L.stop}
          onChange={(v) => llm("stop", v)}
        />
        <Toggle
          label="Let it think first"
          hint="For models that reason before answering. The thoughts are shown, not spoken."
          value={L.enableThinking}
          onChange={(v) => llm("enableThinking", v)}
        />
        {L.enableThinking && (
          <NumberField
            label="Thinking budget"
            hint="Most tokens it may think for. 0 = no limit."
            value={L.thinkingBudget}
            min={0}
            max={4096}
            onChange={(v) => llm("thinkingBudget", v)}
          />
        )}
      </Section>

      <Section
        title="Language model: loading"
        hint={`Fixed when the model loads${reload("llm")}`}
        onReset={() =>
          updateSettings((s) => ({
            ...s,
            llm: {
              ...s.llm,
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
            },
          }))
        }
      >
        <Slider
          label="Context size"
          hint="How much of the conversation it remembers (tokens). More uses more memory."
          value={L.contextSize}
          min={512}
          max={32768}
          step={512}
          onChange={(v) => llm("contextSize", v)}
        />
        <Choice
          label="Run on"
          hint="Auto lets the engine decide. GPU is experimental on Android."
          value={L.device}
          options={[
            { value: "auto", label: "Auto" },
            { value: "cpu", label: "CPU" },
            { value: "gpu", label: "GPU" },
          ]}
          onChange={(v) => llm("device", v)}
        />
        <NumberField
          label="Layers on the GPU"
          hint="999 = all that fit. 0 = none."
          value={L.gpuLayers}
          min={0}
          max={999}
          onChange={(v) => llm("gpuLayers", v)}
        />
        <NumberField
          label="Threads"
          hint="0 = automatic. About the number of fast cores."
          value={L.threads}
          min={0}
          max={32}
          onChange={(v) => llm("threads", v)}
        />
        <NumberField
          label="Threads for reading the prompt"
          hint="0 = same as Threads."
          value={L.threadsBatch}
          min={0}
          max={32}
          onChange={(v) => llm("threadsBatch", v)}
        />
        <NumberField
          label="Batch size"
          hint="0 = the engine's default (2048)."
          value={L.batchSize}
          min={0}
          max={8192}
          onChange={(v) => llm("batchSize", v)}
        />
        <NumberField
          label="Micro batch size"
          hint="0 = the engine's default (512)."
          value={L.microBatchSize}
          min={0}
          max={4096}
          onChange={(v) => llm("microBatchSize", v)}
        />
        <Choice
          label="Flash attention"
          value={L.flashAttention}
          options={[
            { value: "auto", label: "Auto" },
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) => llm("flashAttention", v)}
        />
        <Choice
          label="Memory cache precision"
          hint="Lower uses less memory for long conversations, with a little less quality."
          value={L.kvCacheType}
          options={[
            { value: "f16", label: "16-bit" },
            { value: "q8_0", label: "8-bit" },
            { value: "q4_0", label: "4-bit" },
          ]}
          onChange={(v) => llm("kvCacheType", v)}
        />
        <Toggle
          label="Map the file into memory"
          hint="Starts faster and uses less RAM. Turn off if loading fails."
          value={L.useMmap}
          onChange={(v) => llm("useMmap", v)}
        />
        <Toggle
          label="Lock it in memory"
          hint="Stops the phone from swapping the model out. Needs enough free RAM."
          value={L.useMlock}
          onChange={(v) => llm("useMlock", v)}
        />
        <TextField
          label="Chat template"
          hint="Leave empty to use the template inside the model."
          rows={3}
          value={L.chatTemplate}
          onChange={(v) => llm("chatTemplate", v)}
        />
      </Section>

      <Section
        title="Speech to text"
        hint={`Ears${reload("stt")}`}
        onReset={() => resetSettings("stt")}
      >
        <TextField
          label="Language"
          hint="Whisper language code: fa, en, ar, tr… Empty = detect it."
          value={S.language}
          placeholder="auto"
          onChange={(v) => stt("language", v)}
        />
        <Choice
          label="Task"
          hint="Translate turns the speech into English text."
          value={S.task}
          options={[
            { value: "transcribe", label: "Transcribe" },
            { value: "translate", label: "Translate to English" },
          ]}
          onChange={(v) => stt("task", v)}
        />
        <Slider
          label="Longest recording"
          hint="Seconds. The recording stops being kept after this."
          value={S.maxSeconds}
          min={5}
          max={300}
          step={5}
          onChange={(v) => stt("maxSeconds", v)}
        />
        <Choice
          label="Model type"
          hint="Auto decides from the files. SenseVoice and Paraformer look alike, so name them."
          value={S.type}
          options={[
            { value: "auto", label: "Auto" },
            { value: "whisper", label: "Whisper" },
            { value: "transducer", label: "Transducer" },
            { value: "sense_voice", label: "SenseVoice" },
            { value: "paraformer", label: "Paraformer" },
          ]}
          onChange={(v) => stt("type", v)}
        />
        <NumberField
          label="Threads"
          value={S.threads}
          min={1}
          max={16}
          onChange={(v) => stt("threads", v)}
        />
        <NumberField
          label="Tail paddings"
          hint="Silence added at the end so the last word is not cut. -1 = the model's default."
          value={S.tailPaddings}
          min={-1}
          max={2000}
          onChange={(v) => stt("tailPaddings", v)}
        />
        <Choice
          label="Decoding"
          hint="Beam search is slower and a bit more accurate (transducer models)."
          value={S.decodingMethod}
          options={[
            { value: "greedy_search", label: "Greedy" },
            { value: "modified_beam_search", label: "Beam search" },
          ]}
          onChange={(v) => stt("decodingMethod", v)}
        />
        <Toggle
          label="Write numbers and punctuation"
          hint="SenseVoice: inverse text normalisation."
          value={S.useItn}
          onChange={(v) => stt("useItn", v)}
        />
      </Section>

      <Section
        title="Text to speech"
        hint={`Voice${reload("tts")}`}
        onReset={() => resetSettings("tts")}
      >
        <Slider
          label="Speed"
          hint="How fast it talks. The voice stays the same."
          value={T.speed}
          min={0.5}
          max={2}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => tts("speed", v)}
        />
        <Slider
          label="Pitch"
          hint="Higher or lower voice, without changing the speed."
          value={T.pitch}
          min={0.6}
          max={1.6}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => tts("pitch", v)}
        />
        <Slider
          label="Volume"
          value={T.volume}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => tts("volume", v)}
        />
        <NumberField
          label="Speaker"
          hint={
            engines.tts.state === "ready"
              ? `This voice has ${engines.tts.speakers ?? 1} speaker(s): 0 to ${maxSpeaker}.`
              : "Voices with several speakers: the number of the speaker."
          }
          value={T.speakerId}
          min={0}
          max={maxSpeaker}
          onChange={(v) => tts("speakerId", v)}
        />
        <Slider
          label="Pause between sentences"
          hint="Silence added after each sentence (seconds, scaled)."
          value={T.silenceScale}
          min={0}
          max={1}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => tts("silenceScale", v)}
        />
        <p className="text-[11px] uppercase tracking-wider text-white/30">Fixed when the voice loads</p>
        <Slider
          label="Expressiveness (noise)"
          hint="More varied intonation, and more chance of odd sounds."
          value={T.noiseScale}
          min={0}
          max={1.5}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => tts("noiseScale", v)}
        />
        <Slider
          label="Rhythm variation (noise W)"
          hint="How much the length of the sounds varies."
          value={T.noiseScaleW}
          min={0}
          max={1.5}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => tts("noiseScaleW", v)}
        />
        <Slider
          label="Length scale"
          hint="Above 1 slows the voice down, below 1 speeds it up (built into the voice)."
          value={T.lengthScale}
          min={0.5}
          max={2}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => tts("lengthScale", v)}
        />
        <Choice
          label="Voice type"
          value={T.type}
          options={[
            { value: "auto", label: "Auto" },
            { value: "vits", label: "Piper / VITS" },
            { value: "kokoro", label: "Kokoro" },
          ]}
          onChange={(v) => tts("type", v)}
        />
        <NumberField
          label="Threads"
          value={T.threads}
          min={1}
          max={16}
          onChange={(v) => tts("threads", v)}
        />
      </Section>
    </div>
  );
}
