/**
 * -----------------------------------------------------------------------
 * SIMULATED SWEETMELON BRIDGE — for `npm run playground` and the smoke test
 * -----------------------------------------------------------------------
 * Stands in for the core's `assets/www/js/native-sdk.js` so the app can run in a
 * browser as if the AI plugins were there:
 *
 *   modelManager  `import` adds a fake model of the kind asked for
 *   llm           `chat` streams a canned answer as `llm.token` events
 *   speechOffline `startListening` / `stopListening` return a canned sentence,
 *                 `speak` fires the `speechOffline.speak` events
 *
 * Never ship this file: a Sweetmelon build injects the real SDK.
 */
(function (global) {
  "use strict";

  var listeners = {};
  var store = {};
  var models = [];
  var counter = 0;
  var llmLoaded = false;
  var sttLoaded = false;
  var ttsLoaded = false;
  var listening = false;
  var cancelled = false;

  function emit(event, data) {
    (listeners[event] || []).slice().forEach(function (callback) {
      try { callback(data); } catch (error) { console.error("[bridge] listener failed", error); }
    });
  }

  function later(ms, fn) { return new Promise(function (resolve) { setTimeout(function () { resolve(fn()); }, ms); }); }

  var ANSWER = ["Hello there. ", "I heard you. ", "This is a test answer."];

  var sdk = {
    on: function (event, callback) { (listeners[event] = listeners[event] || []).push(callback); },
    off: function (event, callback) {
      listeners[event] = (listeners[event] || []).filter(function (c) { return c !== callback; });
    },
    info: function () { return { initialized: true }; },
    waitForReady: function () { return Promise.resolve({ initialized: true }); },

    modelManager: {
      list: function (kind) {
        return Promise.resolve({ models: models.filter(function (m) { return !kind || m.kind === kind; }) });
      },
      import: function (options) {
        counter++;
        var kind = options.kind;
        var names = { llm: "tiny-chat-q4.gguf", stt: "whisper-small", tts: "vits-piper-fa_IR" };
        emit("modelManager.progress", { id: "x", stage: "moving", file: names[kind], index: 1, files: 1 });
        return later(10, function () {
          var model = {
            id: kind + "-model-" + counter,
            kind: kind,
            name: options.name || names[kind],
            dir: "/models/" + kind + "/" + counter,
            files: [{ name: names[kind], path: "/models/" + kind + "/" + counter + "/" + names[kind], size: 123456789 }],
            directories: kind === "tts" ? ["espeak-ng-data"] : [],
            sizeBytes: 123456789,
            createdAt: new Date().toISOString(),
          };
          models.push(model);
          return { imported: true, model: model };
        });
      },
      rename: function (id, name) {
        var model = models.filter(function (m) { return m.id === id; })[0];
        model.name = name;
        return Promise.resolve({ model: model });
      },
      remove: function (id) {
        models = models.filter(function (m) { return m.id !== id; });
        return Promise.resolve({ removed: true });
      },
    },

    llm: {
      load: function () { llmLoaded = true; return Promise.resolve({ loaded: true, contextSize: 4096, backend: "CPU", vision: false }); },
      unload: function () { llmLoaded = false; return Promise.resolve({ unloaded: true }); },
      chat: function (text, options) {
        if (!llmLoaded) return Promise.resolve({ started: false, reason: "not_loaded" });
        var requestId = "r" + (++counter);
        var all = "";
        ANSWER.forEach(function (piece, i) {
          setTimeout(function () {
            all += piece;
            emit("llm.token", { requestId: requestId, text: piece, thinking: "", index: i + 1 });
          }, 20 * (i + 1));
        });
        setTimeout(function () {
          emit("llm.done", { requestId: requestId, text: all, stopped: false, usage: { completionTokens: 12, durationMs: 1000 } });
        }, 20 * (ANSWER.length + 1));
        return Promise.resolve({ started: true, requestId: requestId });
      },
      stop: function () { return Promise.resolve({ stopped: true }); },
      reset: function () { return Promise.resolve({ reset: true }); },
      setSystemPrompt: function () { return Promise.resolve({ set: true }); },
    },

    speechOffline: {
      loadRecognizer: function () { sttLoaded = true; return Promise.resolve({ loaded: true, type: "whisper" }); },
      unloadRecognizer: function () { sttLoaded = false; return Promise.resolve({ unloaded: true }); },
      startListening: function () {
        if (!sttLoaded) return Promise.resolve({ started: false, reason: "not_loaded" });
        listening = true;
        cancelled = false;
        emit("speechOffline.level", { level: 0.4 });
        return Promise.resolve({ started: true });
      },
      stopListening: function () {
        listening = false;
        return later(10, function () { return { text: cancelled ? "" : "what is the weather", audioSeconds: 1.2, decodeMs: 40 }; });
      },
      cancelListening: function () { listening = false; cancelled = true; return Promise.resolve({ cancelled: true }); },
      loadSynthesizer: function () { ttsLoaded = true; return Promise.resolve({ loaded: true, type: "vits", sampleRate: 22050, speakers: 3 }); },
      unloadSynthesizer: function () { ttsLoaded = false; return Promise.resolve({ unloaded: true }); },
      speak: function (text, options) {
        if (!ttsLoaded) return Promise.resolve({ queued: false, reason: "not_loaded" });
        var id = options && options.id;
        setTimeout(function () { emit("speechOffline.speak", { id: id, state: "started", text: text }); }, 5);
        setTimeout(function () {
          emit("speechOffline.speak", { id: id, state: "finished" });
          emit("speechOffline.speak", { state: "idle" });
        }, 40);
        return Promise.resolve({ queued: true, id: id });
      },
      stopSpeaking: function () { return Promise.resolve({ stopped: true }); },
      setVolume: function (v) { return Promise.resolve({ volume: v }); },
    },

    storage: {
      get: function (key) { return Promise.resolve(key in store ? store[key] : null); },
      set: function (key, value) { store[key] = value; try { global.localStorage.setItem("bridge_" + key, JSON.stringify(value)); } catch (e) {} return Promise.resolve(true); },
    },
    toast: { show: function (text) { emit("test.toast", { text: text }); return Promise.resolve({ shown: true }); } },
    haptic: { lightImpact: function () { return Promise.resolve({ vibrated: true }); } },
    safeArea: { getInsets: function () { return Promise.resolve({ padding: { top: 30 } }); } },
    backButton: {
      enableIntercept: function () { return Promise.resolve({ intercepting: true }); },
      minimizeApp: function () { return Promise.resolve({ minimized: true }); },
    },
  };

  global.Native = {
    call: function (request) {
      var plugin = sdk[request.plugin];
      if (!plugin || typeof plugin[request.method] !== "function") {
        return Promise.reject(new Error("Unsupported call: " + request.plugin + "." + request.method));
      }
      return plugin[request.method](request.args || {});
    },
    on: sdk.on,
    off: sdk.off,
    info: sdk.info,
  };
  global.NativeSDK = sdk;
})(window);
