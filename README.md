# Melon AI Studio

Hold a button, talk, and a local AI answers out loud. Everything runs **on the
phone**: speech recognition, the language model and the voice. Nothing is
downloaded by the app and nothing leaves the device.

Built with the [Sweetmelon core](https://github.com/legionir/sweetmelon) (v2.6.0)
and its `modelManager`, `llm` and `speechOffline` plugins.

```
hold → speechOffline.startListening → release → stopListening → text
     → llm.chat (tokens stream in) → sentence by sentence → speechOffline.speak
```

## The models

You bring them, from your phone's storage. **Models → Add from phone** opens the
file picker; the files (or an archive) become one model. The first model of each
kind is loaded for you.

| | What to pick | Where to find it |
|---|---|---|
| **Ears** (speech to text) | Whisper: the `*-encoder.onnx`, `*-decoder.onnx` and `*-tokens.txt` together, or the whole `sherpa-onnx-whisper-*.tar.bz2` | the sherpa-onnx releases ("asr-models") |
| **Brain** (language model) | a `.gguf` file (add its `mmproj` file too to let it see images) | Hugging Face |
| **Voice** (text to speech) | a Piper voice, as it is: `vits-piper-*.tar.bz2` | the sherpa-onnx releases ("tts-models") |

Archives (`.zip`, `.tar.gz`, `.tar.bz2`, `.tar.xz`) are unpacked by the app; a
big one takes a minute or more.

Persian: for the voice, `vits-piper-fa_IR-gyro-medium` works. For the ears use
Whisper **small** or bigger (tiny and base understand little Persian) and set
the language to `fa` in Settings.

## Settings

Everything the models offer is there (Settings tab). Settings marked *fixed when
the model loads* ask for a reload of the model (the Models tab says so).

- **Conversation**: speak the answer, load models at start, one question at a time.
- **Language model, answers** (each message): system prompt, temperature, top P,
  top K, min P, repeat penalty, presence penalty, longest answer, seed, stop
  sequences, thinking (and its budget).
- **Language model, loading**: context size, CPU/GPU, GPU layers, threads, batch
  sizes, flash attention, memory-cache precision, mmap, mlock, chat template.
- **Speech to text**: language, transcribe or translate, longest recording,
  model type (Whisper, transducer, SenseVoice, Paraformer), threads, tail
  paddings, decoding, number/punctuation formatting.
- **Text to speech**: speed, **pitch**, volume, speaker, pause between sentences;
  and at load: expressiveness (noise), rhythm variation (noise W), length scale,
  voice type, threads.

Pitch: the voice models have no pitch control. The app plays the sentence at
the playback rate `p` (which changes speed and pitch together) and synthesises
it at speed `speed / p`, so the two cancel in the speed and only the pitch moves.

## Develop

```bash
npm ci
npm run typecheck
npm test            # sentence splitting, settings → plugin arguments
npm run build       # → www/
npm run detect      # the plugins the build will switch on
npm run smoke       # the whole flow in a DOM, with a simulated bridge
npm run playground  # the same bridge, in a browser (npm run playground)
```

The simulated bridge (`tool/playground/native-sdk.js`) answers with canned text,
so the flow can be run without a phone. Real models need the Android or iOS app.

## Build the app

**Actions → Build app → Run workflow.** The workflow builds the web app, runs the
tests, then the Sweetmelon Action builds the APK (`legionir/sweetmelon@v2.6.0`).
GitHub lists a manually-run workflow only once its file is on the default
branch, so keep `main` as the default branch.
Change `application_id` in `sweetmelon.yaml` before publishing.

## Layout

```
app/src/native/   the only code that touches window.NativeSDK
app/src/ai/       settings, sentence splitting
app/src/state/    Studio.tsx: models, loading, the talk loop
app/src/screens/  Talk, Models, Settings
tool/             detect, smoke test, unit tests, simulated bridge
sweetmelon.yaml   core version and plugins
```
