#!/usr/bin/env node
/**
 * Boots the app built with the simulated bridge in a DOM (jsdom) and walks the
 * whole flow: add three models, load them, talk, hear the answer, change a
 * setting.
 *
 *   npm run smoke
 *
 * It proves the app makes the right plugin calls, with the settings the user
 * set, in the right order. It does not run a model: the real plugins are tested
 * in the core.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = path.join(root, "playground");

const html = readFileSync(path.join(bundleDir, "index.html"), "utf8");
const sdk = readFileSync(path.join(bundleDir, "js", "native-sdk.js"), "utf8");

const OPEN = '<script type="module" crossorigin>';
const openAt = html.indexOf(OPEN);
const closeAt = html.indexOf("</script>", openAt);
if (openAt === -1 || closeAt === -1) {
  console.error("Could not find the module script in index.html — did the build change?");
  process.exit(1);
}
const bundle = html.slice(openAt + OPEN.length, closeAt);
const withoutBundle = html.slice(0, openAt) + html.slice(closeAt + "</script>".length);

/** Records every call to the plugins, with its arguments. */
const recorder = `
  window.__calls = [];
  ["modelManager", "llm", "speechOffline", "storage", "toast", "haptic"].forEach(function (plugin) {
    var target = window.NativeSDK[plugin];
    Object.keys(target).forEach(function (method) {
      var original = target[method];
      target[method] = function () {
        window.__calls.push({ plugin: plugin, method: method, args: Array.prototype.slice.call(arguments) });
        return original.apply(target, arguments);
      };
    });
  });
  window.__toasts = [];
  window.NativeSDK.on("test.toast", function (e) { window.__toasts.push(e.text); });
`;

const page = withoutBundle
  .replace('<script src="js/native-sdk.js"></script>', `<script>${sdk}</script><script>${recorder}</script>`)
  .replace("</body>", `<script>${bundle}</script></body>`);

const virtualConsole = new VirtualConsole();
const jsdomErrors = [];
virtualConsole.on("jsdomError", (error) => {
  if (/Not implemented/.test(error.message)) return;
  jsdomErrors.push(error.message);
});
virtualConsole.on("error", (message) => jsdomErrors.push(String(message)));

const dom = new JSDOM(page, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://app.test/",
  virtualConsole,
});
const { window } = dom;
const { document } = window;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const text = () => document.getElementById("root")?.textContent ?? "";
const calls = () => window.__calls ?? [];

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitFor(predicate, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await sleep(40);
  }
  return null;
}

const byLabel = (label) =>
  [...document.querySelectorAll("button, input, textarea")].find((el) => el.getAttribute("aria-label") === label);
const byText = (value) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(value));
const click = (el) => el?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const lastCall = (plugin, method) => calls().filter((c) => c.plugin === plugin && c.method === method).pop();

function pointer(el, type, y = 0) {
  const event = new window.Event(type, { bubbles: true });
  event.pointerId = 1;
  event.clientY = y;
  el.setPointerCapture = () => {};
  el.dispatchEvent(event);
}

// 1. The app mounts, in native mode, with the three tabs.
await waitFor(() => text().includes("Melon AI Studio"));
check("app mounts", text().includes("Melon AI Studio") && text().includes("Hold to talk") === false);
check("the header sits below the status bar", document.documentElement.style.getPropertyValue("--safe-top") === "30px");
check("empty state asks for models", text().includes("Add your models"));
check("talk is not possible yet", text().includes("Load a speech and a language model"));

// 2. Models tab: add one model of each kind from the phone.
click(byText("Models"));
await waitFor(() => text().includes("Speech to text"));
for (const [section, kind] of [["Speech to text", "stt"], ["Language model", "llm"], ["Text to speech", "tts"]]) {
  const group = document.querySelector(`section[aria-label="${section}"]`);
  const add = [...group.querySelectorAll("button")].find((b) => b.textContent?.includes("Add from phone"));
  click(add);
  await waitFor(() => calls().some((c) => c.plugin === "modelManager" && c.method === "import" && c.args[0].kind === kind));
  // The button is off while a model is being added: wait until it is free again.
  await waitFor(() => !text().includes("Adding"));
  await sleep(60);
}
await waitFor(() => calls().filter((c) => c.plugin === "llm" && c.method === "load").length === 1);
await sleep(200);
check(
  "importing asks for each kind",
  ["stt", "llm", "tts"].every((kind) => calls().some((c) => c.method === "import" && c.args[0].kind === kind)),
);
check(
  "the first model of each kind is loaded for the user",
  lastCall("speechOffline", "loadRecognizer") && lastCall("llm", "load") && lastCall("speechOffline", "loadSynthesizer"),
);
check("the models are listed with their size", text().includes("118 MB"));

// 3. Settings: change values, they reach the next calls.
click(byText("Settings"));
await waitFor(() => text().includes("Conversation"));
click([...document.querySelectorAll("section button")].find((b) => b.textContent?.includes("Language model: answers")));
await waitFor(() => byLabel("Temperature"));
const temperature = byLabel("Temperature");
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
setter.call(temperature, "1.25");
temperature.dispatchEvent(new window.Event("input", { bubbles: true }));
await sleep(100);
check("the slider shows its value", text().includes("1.25"));
click([...document.querySelectorAll("section button")].find((b) => b.textContent?.includes("Text to speech") && b.getAttribute("aria-expanded") !== null));
await waitFor(() => byLabel("Speed"));
const speed = byLabel("Speed");
setter.call(speed, "1.5");
speed.dispatchEvent(new window.Event("input", { bubbles: true }));
await sleep(100);
check("the speaker field knows the voice has 3 speakers", text().includes("0 to 2"));
await sleep(600);
check(
  "settings are saved through the storage plugin",
  calls().some((c) => c.plugin === "storage" && c.method === "set" && c.args[0] === "studio.settings"),
);

// 4. Talk: hold, speak, release → text → the model → spoken sentences.
click(byText("Talk"));
await waitFor(() => byLabel("Hold to talk"));
check("talk is possible now", text().includes("Hold to talk"));
const hold = byLabel("Hold to talk");
pointer(hold, "pointerdown", 500);
await waitFor(() => calls().some((c) => c.plugin === "speechOffline" && c.method === "startListening"));
await waitFor(() => text().includes("release to send"));
check("holding starts the recording", Boolean(lastCall("speechOffline", "startListening")));
check("the screen says it is listening", text().includes("release to send"));
await sleep(500);
pointer(hold, "pointerup", 500);
await waitFor(() => lastCall("llm", "chat"));
check("releasing stops the recording", Boolean(lastCall("speechOffline", "stopListening")));
const chat = lastCall("llm", "chat");
check("the recognised text goes to the model", chat?.args[0] === "what is the weather", String(chat?.args[0]));
check(
  "the sampling settings are sent with it",
  chat?.args[1]?.params?.temperature === 1.25 && chat?.args[1]?.params?.topP === 0.9 && chat?.args[1]?.params?.topK === 40,
  JSON.stringify(chat?.args[1]?.params),
);
await waitFor(() => text().includes("This is a test answer."));
check("the answer streams into the chat", text().includes("Hello there. I heard you. This is a test answer."));
await waitFor(() => calls().filter((c) => c.plugin === "speechOffline" && c.method === "speak").length >= 3);
const spoken = calls().filter((c) => c.plugin === "speechOffline" && c.method === "speak");
check(
  "each sentence is spoken as it completes",
  spoken.map((c) => c.args[0]).join("|") === "Hello there.|I heard you.|This is a test answer.",
  spoken.map((c) => c.args[0]).join("|"),
);
check("the voice settings are sent with each sentence", spoken[0]?.args[1]?.speed === 1.5 && spoken[0]?.args[1]?.rate === 1, JSON.stringify(spoken[0]?.args[1]));
await waitFor(() => text().includes("Hold to talk"));
check("it is ready to talk again", text().includes("Hold to talk"));

// 5. A quick tap is not a question; sliding up cancels.
const before = calls().filter((c) => c.plugin === "llm" && c.method === "chat").length;
pointer(hold, "pointerdown", 500);
await waitFor(() => calls().filter((c) => c.method === "startListening").length >= 2);
pointer(hold, "pointerup", 500);
await sleep(300);
check("a quick tap sends nothing", calls().filter((c) => c.plugin === "llm" && c.method === "chat").length === before);
check("and says why", window.__toasts.some((t) => /Hold the button/.test(t)));

pointer(hold, "pointerdown", 500);
await waitFor(() => calls().filter((c) => c.method === "startListening").length >= 3);
await sleep(500);
pointer(hold, "pointermove", 300);
await sleep(100);
pointer(hold, "pointerup", 300);
await sleep(300);
check("sliding up cancels the recording", Boolean(lastCall("speechOffline", "cancelListening")));
check("a cancelled recording sends nothing", calls().filter((c) => c.plugin === "llm" && c.method === "chat").length === before);

// 6. Typing works too.
const input = byLabel("Type a message");
setter.call(input, "hello");
input.dispatchEvent(new window.Event("input", { bubbles: true }));
await sleep(50);
click(byLabel("Send"));
await waitFor(() => calls().filter((c) => c.plugin === "llm" && c.method === "chat").length === before + 1);
check("a typed message goes to the model", lastCall("llm", "chat")?.args[0] === "hello");

check("no unexpected page errors", jsdomErrors.length === 0, jsdomErrors.slice(0, 2).join(" | "));

const failed = results.filter((result) => !result.ok);
console.log("");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
window.close();
process.exit(failed.length === 0 ? 0 : 1);
