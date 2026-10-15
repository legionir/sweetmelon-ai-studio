#!/usr/bin/env node
/**
 * Plugin report for the built app — a Node port of the core's
 * `sweetmelon detect`, so the plugin set can be checked without Dart/Flutter:
 *
 *   npm run detect                 # scans www/
 *   npm run detect -- --www www    # same, explicit
 *
 * It reads the same evidence the real detector reads: `NativeSDK.<plugin>.`
 * calls, a variable holding NativeSDK, `plugin: 'name'` and the
 * `sweetmelon:uses audio, storage` annotation. `mode: auto` in sweetmelon.yaml
 * turns exactly these plugins on at build time.
 *
 * Anything the scan cannot resolve (a plugin name built at run time) is
 * reported as a warning; the build fails on those with `strict: 'true'`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";

const SCAN_EXTENSIONS = new Set([
  ".html", ".htm", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte",
]);
const SKIPPED_NAMES = new Set(["native-sdk.js", "native-sdk.d.ts", "native-resilience.js"]);
/** Namespaces of the SDK that are not plugins. */
const NON_PLUGIN = new Set(["call", "batch", "on", "off", "info", "waitForReady"]);

const args = process.argv.slice(2);
const wwwIndex = args.indexOf("--www");
const wwwDir = wwwIndex >= 0 ? args[wwwIndex + 1] : "www";

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (SCAN_EXTENSIONS.has(extname(path).toLowerCase()) && !SKIPPED_NAMES.has(basename(path))) {
      files.push(path);
    }
  }
  return files;
}

/** `filePicker` -> `file_picker`, the key sweetmelon.yaml expects. */
function yamlKey(namespace) {
  return namespace.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

const evidence = new Map();
const dynamicUses = [];

function found(key, where) {
  const list = evidence.get(key) ?? [];
  if (list.length < 3 && !list.includes(where)) list.push(where);
  evidence.set(key, list);
}

let scanned = 0;
for (const path of walk(wwwDir)) {
  const text = readFileSync(path, "utf8");
  const where = relative(".", path).replaceAll("\\", "/");
  scanned++;

  const aliases = ["NativeSDK"];
  for (const match of text.matchAll(
    /(?:\b(?:var|let|const)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:window\.|globalThis\.)?NativeSDK\s*(?:;|,|\n|$)/g,
  )) {
    aliases.push(match[1]);
  }
  const sdkNamespace = new RegExp(
    `(?:${aliases.map((name) => name.replace(/[$]/g, "\\$")).join("|")})\\s*\\.\\s*([A-Za-z_]\\w*)\\s*\\.`,
    "g",
  );

  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const at = `${where}:${index + 1}`;

    for (const match of line.matchAll(sdkNamespace)) {
      if (!NON_PLUGIN.has(match[1])) found(yamlKey(match[1]), at);
    }
    for (const match of line.matchAll(/\bplugin['"]?\s*:\s*['"]([A-Za-z_]\w*)['"]/g)) {
      found(yamlKey(match[1]), at);
    }
    for (const match of line.matchAll(/sweetmelon:uses\s+([\w,\s]+)/g)) {
      for (const name of match[1].split(/[,\s]+/)) {
        if (name) found(name, at);
      }
    }
    if (/\bplugin['"]?\s*:\s*[A-Za-z_[(]/.test(line)) dynamicUses.push(`${at}  ${line.trim()}`);
    else if (/\bNative(?:SDK)?\s*\.\s*call\(\s*[A-Za-z_[(]/.test(line)) {
      dynamicUses.push(`${at}  ${line.trim()}`);
    }
  });
}

if (!scanned) {
  console.error(`No sources found in ${wwwDir}/ — run "npm run build" first.`);
  process.exit(1);
}

console.log(`Scanned ${scanned} file(s) in ${wwwDir}/`);
console.log("");
if (evidence.size === 0) {
  console.log("No plugin calls found.");
} else {
  const plugins = [...evidence.keys()].sort();
  console.log(`Plugins used (${plugins.length}):`);
  for (const plugin of plugins) {
    console.log(`  ${plugin.padEnd(14)} ${evidence.get(plugin).join(", ")}`);
  }
  console.log("");
  console.log("plugin_selection.include for sweetmelon.yaml:");
  console.log(`  [${plugins.join(", ")}]`);
}

if (dynamicUses.length > 0) {
  console.log("");
  console.log("Dynamic plugin names (list them in plugin_selection.include):");
  for (const use of dynamicUses) console.log(`  ${use}`);
  process.exit(1);
}
