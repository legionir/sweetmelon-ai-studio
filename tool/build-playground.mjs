#!/usr/bin/env node
/**
 * Builds the app with the simulated Sweetmelon bridge (tool/playground) into
 * playground/, so the plugin code paths can be tried in a plain browser:
 *
 *   npm run playground
 *
 * A real build never uses this: the Sweetmelon Action (or
 * `sweetmelon prepare`) injects the core's own js/native-sdk.js into www/.
 */
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({ configFile: path.join(root, "vite.playground.config.ts") });

const from = path.join(root, "tool", "playground", "native-sdk.js");
const to = path.join(root, "playground", "js", "native-sdk.js");
copyFileSync(from, to);
console.log("playground: simulated bridge copied to playground/js/native-sdk.js");
