const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");
const actionPath = path.join(root, "action.yml");
const readmePath = path.join(root, "README.md");
const changelogPath = path.join(root, "CHANGELOG.md");
// Vendored into this repository so the suite runs standalone; in the monorepo
// the same checker lives at packages/polyglot-smoke/check-github-action.js.
const checkerPath = path.join(__dirname, "..", "ci", "check-github-action.js");

function read(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function extractTopLevelMapKeys(text, startKey, endKey) {
    const start = text.indexOf(`${startKey}:\n`);
    const end = text.indexOf(`\n${endKey}:\n`, start);
    assert.notEqual(start, -1, `missing ${startKey}: section`);
    assert.notEqual(end, -1, `missing ${endKey}: section after ${startKey}:`);
    return [...text.slice(start, end).matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)]
        .map((match) => match[1]);
}

function extractReadmeTableKeys(text, heading, nextHeading) {
    const start = text.indexOf(`## ${heading}`);
    const end = text.indexOf(`\n## ${nextHeading}`, start);
    assert.notEqual(start, -1, `missing README heading: ${heading}`);
    assert.notEqual(end, -1, `missing README heading after ${heading}: ${nextHeading}`);
    return new Set([...text.slice(start, end).matchAll(/^\| `([^`]+)` \|/gm)]
        .map((match) => match[1]));
}

test("shared GitHub Action checker passes", () => {
    const result = spawnSync(process.execPath, [checkerPath], {
        cwd: repoRoot,
        encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /check-github-action: PASS/);
});

test("README documents every action input and output", () => {
    const action = read(actionPath);
    const readme = read(readmePath);
    const actionInputs = extractTopLevelMapKeys(action, "inputs", "outputs");
    const actionOutputs = extractTopLevelMapKeys(action, "outputs", "runs");
    const readmeInputs = extractReadmeTableKeys(readme, "Inputs", "Outputs");
    const readmeOutputs = extractReadmeTableKeys(readme, "Outputs", "Preflight and Source-Free Evidence");

    for (const input of actionInputs) {
        assert.equal(readmeInputs.has(input), true, `README missing input: ${input}`);
    }
    for (const output of actionOutputs) {
        assert.equal(readmeOutputs.has(output), true, `README missing output: ${output}`);
    }
});

test("release notes mention every current evidence output", () => {
    const action = read(actionPath);
    const changelog = read(changelogPath);
    const actionOutputs = extractTopLevelMapKeys(action, "outputs", "runs");

    for (const output of actionOutputs.filter((name) => name.endsWith("-report") || name.endsWith("-path"))) {
        assert.match(changelog, new RegExp(`\\b${output}\\b`), `CHANGELOG missing output: ${output}`);
    }
});

test("GitHub Action package text files are free of known mojibake", () => {
    const badEncodingPattern = /(?:\u9225|\uFFFD|\u922B|\u9239|\u923A|\u95B3)/;
    for (const filePath of [actionPath, readmePath, changelogPath]) {
        assert.doesNotMatch(read(filePath), badEncodingPattern, `${path.basename(filePath)} contains mojibake`);
    }
});
