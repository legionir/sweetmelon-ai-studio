// Unit tests of the pure logic: `npm test` (Node 22.18+ runs the .ts files as they are).
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanForSpeech, SentenceSplitter } from "../app/src/ai/speech.ts";
import {
  defaultSettings,
  llmChatOptions,
  llmLoadOptions,
  loadSignature,
  mergeSettings,
  sttLoadOptions,
  ttsLoadOptions,
  ttsSpeakOptions,
} from "../app/src/ai/settings.ts";

function feed(chunks) {
  const splitter = new SentenceSplitter();
  const out = [];
  for (const chunk of chunks) out.push(...splitter.push(chunk));
  out.push(...splitter.flush());
  return out;
}

test("a stream is split into sentences as they complete", () => {
  assert.deepEqual(feed(["Hello th", "ere. How ar", "e you? Fine!"]), ["Hello there.", "How are you?", "Fine!"]);
});

test("a sentence is not released until its stop is settled", () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.push("Wait."), [], "the stop may be followed by more");
  assert.deepEqual(s.push(" Next"), ["Wait."]);
  assert.deepEqual(s.flush(), ["Next"]);
});

test("a decimal point is not a sentence end", () => {
  assert.deepEqual(feed(["It costs 3.", "5 dollars. Cheap."]), ["It costs 3.5 dollars.", "Cheap."]);
});

test("Persian and Arabic stops end a sentence", () => {
  assert.deepEqual(feed(["سلام. حال شما چطور است؟ خوبم۔ ممنون"]), ["سلام.", "حال شما چطور است؟", "خوبم۔", "ممنون"]);
});

test("a new line ends a sentence", () => {
  assert.deepEqual(feed(["one\ntwo\n"]), ["one", "two"]);
});

test("a long stretch without a stop is cut at a comma or a space", () => {
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(", ");
  const parts = feed([words]);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 200), parts.map((p) => p.length).join(","));
  assert.equal(parts.join(" ").replace(/\s+/g, " ").includes("word59"), true);
});

test("nothing is lost: the pieces rejoin to the text", () => {
  const text = "First one. Second, longer one! Third? Last without a stop";
  assert.equal(feed([text]).join(" "), text);
});

test("flush returns the rest once", () => {
  const s = new SentenceSplitter();
  s.push("no stop");
  assert.deepEqual(s.flush(), ["no stop"]);
  assert.deepEqual(s.flush(), []);
});

test("markdown, links and emoji are not read aloud", () => {
  assert.equal(cleanForSpeech("**Bold** and `code` and [a link](http://x.y)"), "Bold and code and a link");
  assert.equal(cleanForSpeech("See https://example.com now"), "See now");
  assert.equal(cleanForSpeech("Hello 😀 there"), "Hello there");
  assert.equal(cleanForSpeech("```js\nlet x\n```"), "");
  assert.equal(cleanForSpeech("- item one\n- item two"), "item one item two");
  assert.equal(cleanForSpeech("***"), "");
});

test("settings stored by an older version get the new defaults", () => {
  const merged = mergeSettings({ llm: { temperature: 0.2 } });
  assert.equal(merged.llm.temperature, 0.2);
  assert.equal(merged.llm.topP, defaultSettings.llm.topP);
  assert.deepEqual(merged.tts, defaultSettings.tts);
  assert.deepEqual(mergeSettings(null), defaultSettings);
});

test("chat options: random seed, stop lines and the thinking budget", () => {
  const base = { ...defaultSettings.llm };
  assert.equal(llmChatOptions(base).params.seed, undefined);
  assert.equal(llmChatOptions({ ...base, seed: 7 }).params.seed, 7);
  assert.deepEqual(llmChatOptions({ ...base, stop: "User:\n\n  END \n" }).params.stop, ["User:", "END"]);
  assert.equal(llmChatOptions({ ...base, stop: "" }).params.stop, undefined);
  assert.equal(llmChatOptions({ ...base, enableThinking: false, thinkingBudget: 99 }).params.thinkingBudget, undefined);
  assert.equal(llmChatOptions({ ...base, enableThinking: true, thinkingBudget: 99 }).params.thinkingBudget, 99);
});

test("every sampling setting reaches the plugin", () => {
  const p = llmChatOptions({
    ...defaultSettings.llm,
    temperature: 0.3, topP: 0.5, topK: 10, minP: 0.05, repeatPenalty: 1.3, presencePenalty: 0.4, maxTokens: 99,
  }).params;
  assert.deepEqual(
    [p.temperature, p.topP, p.topK, p.minP, p.repeatPenalty, p.presencePenalty, p.maxTokens],
    [0.3, 0.5, 10, 0.05, 1.3, 0.4, 99],
  );
});

test("load options carry the load-time settings", () => {
  const o = llmLoadOptions("m-1", { ...defaultSettings.llm, contextSize: 8192, threads: 4, kvCacheType: "q8_0", chatTemplate: "  " });
  assert.equal(o.modelId, "m-1");
  assert.equal(o.contextSize, 8192);
  assert.equal(o.threads, 4);
  assert.equal(o.kvCacheType, "q8_0");
  assert.equal(o.chatTemplate, undefined, "a blank template means the model's own");

  const stt = sttLoadOptions("s-1", { ...defaultSettings.stt, language: " fa ", task: "translate" });
  assert.equal(stt.language, "fa");
  assert.equal(stt.task, "translate");

  const tts = ttsLoadOptions("t-1", { ...defaultSettings.tts, noiseScale: 0.5, lengthScale: 1.2 });
  assert.deepEqual([tts.noiseScale, tts.lengthScale], [0.5, 1.2]);
});

test("pitch is played as the rate and cancelled out of the speed", () => {
  const same = ttsSpeakOptions({ ...defaultSettings.tts, speed: 1, pitch: 1 });
  assert.equal(same.speed, 1);
  assert.equal(same.rate, 1);

  const higher = ttsSpeakOptions({ ...defaultSettings.tts, speed: 1.2, pitch: 1.5 });
  assert.equal(higher.rate, 1.5);
  // synthesised at speed / pitch, played at pitch: the speed the user asked for.
  assert.ok(Math.abs(higher.speed * higher.rate - 1.2) < 1e-9);

  const extreme = ttsSpeakOptions({ ...defaultSettings.tts, speed: 5, pitch: 9 });
  assert.ok(extreme.rate <= 2 && extreme.speed <= 3);
});

test("only a load-time setting changes the load signature", () => {
  const a = defaultSettings;
  const perMessage = { ...a, llm: { ...a.llm, temperature: 1.5, topP: 0.1, systemPrompt: "x" }, tts: { ...a.tts, speed: 2, pitch: 1.2, volume: 0.1 }, stt: { ...a.stt, maxSeconds: 5 } };
  for (const kind of ["llm", "stt", "tts"]) {
    assert.equal(loadSignature(kind, perMessage), loadSignature(kind, a), `${kind}: per-message settings must not ask for a reload`);
  }
  assert.notEqual(loadSignature("llm", { ...a, llm: { ...a.llm, contextSize: 8192 } }), loadSignature("llm", a));
  assert.notEqual(loadSignature("stt", { ...a, stt: { ...a.stt, language: "fa" } }), loadSignature("stt", a));
  assert.notEqual(loadSignature("tts", { ...a, tts: { ...a.tts, noiseScale: 0.1 } }), loadSignature("tts", a));
});
