#!/usr/bin/env node
"use strict";

// Lints packages/jso-github-action/action.yml for structural integrity.
// Runs as part of `npm run verify` so an editor or linter that touches the
// action's YAML can't silently break it before publishing to the Marketplace.
//
// Checks:
//   1. Parses as YAML (no syntax errors)
//   2. Required top-level keys: name, description, inputs, outputs, runs
//   3. `runs.using == "composite"` and `runs.steps` is a non-empty array
//   4. Every step has either `uses` OR `run` (not both, not neither)
//   5. Every `${{ steps.X.outputs.Y }}` reference resolves to a step
//      whose `id == X` (catches typos like `steps.release_check` vs
//      `steps.release-check`)
//   6. Every `${{ inputs.X }}` reference resolves to a declared input
//   7. Every input has a `description` (Marketplace requirement)
//   8. Every output has a `description` and a `value` (Marketplace requirement)
//   9. No `id:` collisions across steps
//
// Exit 0 if clean, 1 otherwise.

const fs   = require("node:fs");
const path = require("node:path");

// Vendored from the monorepo's packages/polyglot-smoke so this repository's
// tests run standalone. In the monorepo the action lives one directory over;
// here action.yml sits at the repository root.
const ACTION_YML = path.resolve(__dirname, "..", "action.yml");

if (!fs.existsSync(ACTION_YML)) {
    console.error("check-github-action: action.yml not found at " + ACTION_YML);
    process.exit(2);
}

const text = fs.readFileSync(ACTION_YML, "utf8");

// ---- minimal YAML parser via a third-party? -----------------------------
// We avoid pulling in js-yaml. The structure we need is shallow enough that
// a hand-rolled scanner works: indented top-level keys + lists of step maps.
// To stay robust we exec node's built-in yaml support if present, else fall
// back to a small parser that handles the ~50-line shapes this file uses.

// Load js-yaml. The eslint plugin already depends on it, so we reach into
// that package's node_modules rather than adding it as a polyglot-smoke
// dependency. If a future repo layout breaks this path, fall back to the
// hand-rolled parser below.
let action;
const jsYamlCandidates = [
    // This repository ships js-yaml as a devDependency, so a plain
    // `npm install` here is enough to make the checker verify rather than skip.
    path.resolve(__dirname, "..", "node_modules", "js-yaml"),
    path.resolve(__dirname, "..", "eslint-plugin-jso-protector", "node_modules", "js-yaml"),
    path.resolve(__dirname, "node_modules", "js-yaml"),
];
let jsYaml = null;
for (const p of jsYamlCandidates) {
    if (fs.existsSync(p)) { jsYaml = require(p); break; }
}
if (jsYaml) {
    action = jsYaml.load(text);
} else {
    console.error("check-github-action: js-yaml not found at any expected path; falling back to minimal parser (may be incomplete)");
    action = parseActionYmlMinimal(text);

    // The hand-rolled parser cannot handle this action.yml - it is ~1100 lines
    // with multi-line run blocks - and js-yaml lives in an installed
    // node_modules, so a fresh clone reaches here before `npm install`. When
    // the fallback comes back with no steps it has not found a defect, it has
    // failed to read the file, and reporting four confident FAILs for that
    // sends the reader hunting for problems that do not exist. Skip instead,
    // matching how verify-package-closure skips a missing csc.
    const parsedNothing = !action || !action.runs || !Array.isArray(action.runs.steps) || action.runs.steps.length === 0;
    if (parsedNothing) {
        console.log("check-github-action: SKIPPED -- js-yaml is unavailable and the fallback parser could not read action.yml.");
        console.log("check-github-action: nothing was verified. Run `npm install` in packages/eslint-plugin-jso-protector (it depends on js-yaml), then re-run.");
        process.exit(0);
    }
}

let failures = 0;
function fail(msg) { console.error("  FAIL: " + msg); failures++; }
function ok(msg)   { console.log  ("  ok:   " + msg); }

// 1. Required top-level keys
for (const k of ["name", "description", "inputs", "outputs", "runs"]) {
    if (!(k in action)) fail("missing top-level key: " + k);
}

// 2. runs.using + runs.steps
if (action.runs) {
    if (action.runs.using !== "composite") fail("runs.using must be 'composite' (got " + JSON.stringify(action.runs.using) + ")");
    if (!Array.isArray(action.runs.steps) || action.runs.steps.length === 0) fail("runs.steps must be a non-empty array");
}

// 3. Per-step shape
const stepIds = new Set();
const stepShapes = action.runs && Array.isArray(action.runs.steps) ? action.runs.steps : [];
for (let i = 0; i < stepShapes.length; i++) {
    const s = stepShapes[i] || {};
    if (s.id) {
        if (stepIds.has(s.id)) fail("duplicate step id: " + s.id);
        stepIds.add(s.id);
    }
    const has = (k) => Object.prototype.hasOwnProperty.call(s, k);
    if (has("uses") && has("run"))  fail("step " + (i + 1) + " (" + (s.name || s.id || "?") + ") has both `uses` and `run`");
    if (!has("uses") && !has("run")) fail("step " + (i + 1) + " (" + (s.name || s.id || "?") + ") has neither `uses` nor `run`");
}

// 4. inputs: every input has a description
for (const [name, def] of Object.entries(action.inputs || {})) {
    if (!def || typeof def !== "object") { fail("inputs." + name + ": malformed"); continue; }
    if (!def.description) fail("inputs." + name + ": missing description (Marketplace requirement)");
}

// 5. outputs: every output has a description AND a value
for (const [name, def] of Object.entries(action.outputs || {})) {
    if (!def || typeof def !== "object") { fail("outputs." + name + ": malformed"); continue; }
    if (!def.description) fail("outputs." + name + ": missing description");
    if (!def.value)       fail("outputs." + name + ": missing value (`${{ steps.X.outputs.Y }}`)");
}

// 6. ${{ steps.X.outputs.Y }} references resolve
//    Scan the whole text for the pattern; verify X is a known step id.
const stepRefRe = /\$\{\{\s*steps\.([A-Za-z0-9_-]+)\.outputs\.[A-Za-z0-9_-]+\s*\}\}/g;
const seenRefs = new Set();
let m;
while ((m = stepRefRe.exec(text)) !== null) {
    const refId = m[1];
    if (seenRefs.has(refId)) continue;
    seenRefs.add(refId);
    if (!stepIds.has(refId)) fail("references ${{ steps." + refId + ".outputs.* }} but no step has id: " + refId);
}

// 7. ${{ inputs.X }} references resolve
const inputRefRe = /\$\{\{\s*inputs\.([A-Za-z0-9_-]+)\s*\}\}/g;
const seenInputs = new Set();
const declaredInputs = new Set(Object.keys(action.inputs || {}));
while ((m = inputRefRe.exec(text)) !== null) {
    const refId = m[1];
    if (seenInputs.has(refId)) continue;
    seenInputs.add(refId);
    if (!declaredInputs.has(refId)) fail("references ${{ inputs." + refId + " }} but no input declared with name: " + refId);
}

// ---- report -------------------------------------------------------------
const inputCount  = Object.keys(action.inputs  || {}).length;
const outputCount = Object.keys(action.outputs || {}).length;
const stepCount   = stepShapes.length;

console.log("check-github-action: " + ACTION_YML);
console.log("  inputs:  " + inputCount);
console.log("  outputs: " + outputCount);
console.log("  steps:   " + stepCount + " (" + stepIds.size + " with id)");

if (failures === 0) {
    console.log("check-github-action: PASS");
    process.exit(0);
}
console.error("check-github-action: " + failures + " failure(s)");
process.exit(1);


// ---- minimal action.yml structural parser -------------------------------
//
// We avoid a YAML dependency because js-yaml isn't a runtime dep of either
// polyglot-smoke or jso-protector. The shapes we need:
//
//   inputs:
//     foo:
//       description: "..."
//       required: false
//       default: ""
//
//   outputs:
//     bar:
//       description: "..."
//       value: ${{ ... }}
//
//   runs:
//     using: "composite"
//     steps:
//       - name: "..."
//         id: my-id
//         run: |
//           ...
//         shell: bash
//
// Parser strategy: line-oriented, indentation-based. Treat 2-space indent
// as the unit. Strip comments. Recognize:
//   key: value     (scalar)
//   key:           (map starts on next indented lines)
//   - key: value   (list item starting a map)
//   - value        (list scalar)
//
// Block scalars (`|` / `>`) get joined or discarded — we only need to know
// they exist, not their content.
function parseActionYmlMinimal(src) {
    const lines = src.split(/\r?\n/);
    const root  = {};

    // Stack of (indent, container, lastKey, lastList). lastList is set when
    // the container is a list; appending happens to that list.
    const stack = [{ indent: -1, container: root, lastKey: null, list: null }];

    function frame() { return stack[stack.length - 1]; }
    function popTo(indent) {
        // Pop frames whose recorded "expected child indent" is STRICTLY
        // greater than the new line's indent. The top frame's `indent`
        // field stores the indent at which its children appear, so a
        // line at that exact indent is still a child of that frame and
        // must not pop it.
        while (stack.length > 1 && frame().indent > indent) stack.pop();
    }
    function setOnTop(key, val) {
        const f = frame();
        if (f.list) {
            const last = f.list[f.list.length - 1];
            last[key] = val;
        } else {
            f.container[key] = val;
        }
        f.lastKey = key;
    }
    function getTopChild(key) {
        const f = frame();
        if (f.list) {
            const last = f.list[f.list.length - 1];
            return last[key];
        }
        return f.container[key];
    }

    for (let raw of lines) {
        // Strip trailing CR + line comments (but not `#` inside quoted strings).
        // For action.yml, lines starting with optional whitespace + `#` are pure comments.
        if (/^\s*#/.test(raw) || /^\s*$/.test(raw)) continue;

        const indentMatch = raw.match(/^( *)/);
        const indent = indentMatch[1].length;
        let body = raw.slice(indent);

        // Inline comment strip (best-effort, doesn't handle # inside strings perfectly).
        // Only strip when preceded by whitespace.
        body = body.replace(/\s+#.*$/, "");

        // List-item form: `- foo: bar` or `- foo:` or `- "literal"`
        if (body.startsWith("- ") || body === "-") {
            // Pop frames deeper than this indent.
            popTo(indent);
            const f = frame();
            // The container we're appending to must be a list (set on the
            // parent when the parent key had a `:`-only line and the next
            // non-empty line was a list item).
            if (!f.list) {
                // Convert: f.container[f.lastKey] should become an array.
                if (f.lastKey == null) continue;
                const arr = [];
                f.container[f.lastKey] = arr;
                f.list = arr;
            }
            const item = {};
            f.list.push(item);
            // Process the body after `- `
            const inner = body.slice(2).trim();
            if (inner) {
                const colon = inner.indexOf(":");
                if (colon >= 0) {
                    const k = inner.slice(0, colon).trim();
                    const v = inner.slice(colon + 1).trim();
                    if (v === "" || v === "|" || v === ">") {
                        item[k] = v === "" ? null : "<block>";
                    } else {
                        item[k] = stripQuotes(v);
                    }
                    // Push a new frame so the next deeper indents go into this item.
                    stack.push({ indent: indent + 2, container: item, lastKey: k, list: null });
                } else {
                    // Pure scalar list item — rare in action.yml
                    f.list[f.list.length - 1] = stripQuotes(inner);
                }
            } else {
                stack.push({ indent: indent + 2, container: item, lastKey: null, list: null });
            }
            continue;
        }

        // Key: form
        popTo(indent);
        const colon = body.indexOf(":");
        if (colon < 0) continue;
        const key = body.slice(0, colon).trim();
        const val = body.slice(colon + 1).trim();
        if (val === "" || val === "|" || val === ">") {
            // Map / block scalar starts on next deeper line
            const f = frame();
            if (f.list) {
                const last = f.list[f.list.length - 1];
                last[key] = val === "" ? {} : "<block>";
                stack.push({ indent: indent + 2, container: last[key], lastKey: key, list: null });
            } else {
                f.container[key] = val === "" ? {} : "<block>";
                if (val === "") {
                    stack.push({ indent: indent + 2, container: f.container[key], lastKey: key, list: null });
                }
                f.lastKey = key;
            }
        } else {
            setOnTop(key, stripQuotes(val));
        }
    }
    return root;
}

function stripQuotes(s) {
    if (s.length >= 2 && (
        (s[0] === '"' && s[s.length - 1] === '"') ||
        (s[0] === "'" && s[s.length - 1] === "'")
    )) {
        return s.slice(1, -1);
    }
    return s;
}
