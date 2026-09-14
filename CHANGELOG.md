# Change Log

## 0.4.1 - 2026-09-14

**Fixes the action failing to load on every runner.** Five input descriptions contained `${{ secrets.* }}` / `${{ github.* }}` expressions. The runner evaluates action metadata and has no `secrets` or `github` context there, so it rejected `action.yml` with "Unrecognized named-value: 'secrets'" before any step ran. Every release up to and including 0.4.0 was affected; the static checks passed because they parse the file without running it.

- The descriptions now name the secrets in plain text (for example "the JSO_API_KEY secret").
- The action checker now fails on any `${{ }}` in an input description, and on a `secrets`/`github` expression in an input default.
- A new `smoke` workflow runs the action itself on an ubuntu runner with no secrets on every push to main.

## 0.4.0 - 2026-09-14

Works on the free tier with no account. Upgrading from 0.3 changes one default.

- `api-key` and `api-password` are now optional. When both are unset the action runs on the anonymous free tier (20 files / 200 KB per request, 5 runs per hour per IP). Add a free account's key for 100 runs per hour, or a paid key for the paid presets.
- **`preset` now defaults to `free`** (was `balanced`). `standard`, `balanced` and `maximum` use plan-gated features (self compression, deep obfuscation, member renaming) and fail on a free or anonymous run, so the old default broke every first run without a paid key. Workflows that relied on the default and have a paid key should set `preset: balanced` explicitly.
- The optional `estimate` pre-flight only passes `--api-key`/`--api-password` when they are set; empty values made the CLI stop with "Missing value for --api-key".
- The action now lives at `javascriptobfuscator-com/jso-github-action`. The previous `richtexteditor/jso-github-action` address redirects.

## 0.3.0 - 2026-09-02

Migration preflight and release-evidence surface for teams replacing local JavaScript obfuscators.

- `release-check` + `release-check-report` inputs run `jso-protector --release-check --json` before protection and expose the report path as an output.
- `competitor-gap-report` + `competitor-gap-report-path` inputs run `jso-protector --competitor-gap-report --json` before protection so source-map, identifier-cache, runtime-defense, and lock parity assumptions can be uploaded as CI artifacts.
- `payment-script-inventory`, `runtime-inventory-snapshot`, and `script-inventory-audit-report` inputs run `jso-protector --script-inventory-audit --json` before protection so payment-page script drift can fail CI and produce a source-free audit artifact.
- The payment-page audit preflight now writes a GitHub step summary and emits workflow annotations for the first source-free audit findings.
- `runtime-incident-export` + `runtime-incident-evidence-report` inputs run `jso-protector --runtime-incident-evidence --json` before protection so Dashboard Monitoring incident exports can become source-free CI artifacts and active high/critical packets can fail release handoff until response starts.
- `source-map-evidence` + `source-map-evidence-report` inputs run `jso-protector --source-map-evidence --json` after protection so release reviewers can verify the manifest and source-map absence without receiving source code or source-map contents.
- `vm-proof-pack` + `vm-proof-pack-report` inputs run `jso-protector --vm-proof-pack --json` after protection so VM reviewers can receive a source-free proof packet from the saved API report.
- `ai-resistance-evidence` + `ai-resistance-evidence-report` inputs run `jso-protector --ai-resistance-evidence --json` after protection so release reviewers can receive current AI-resistance evidence without calling an AI provider. `ai-resistance-require-vm-proof` and `min-vm-functions` make VM-backed evidence a hard gate when needed.
- New outputs: `report-path`, `release-check-report`, `competitor-gap-report-path`, `migration-review-report`, `script-inventory-audit-report`, `payment-page-headers-report`, `runtime-incident-evidence-report`, `pci-dss-v4-report`, `pci-dss-v4-json-report`, `source-map-evidence-report`, `vm-proof-pack-report`, `ai-resistance-evidence-report`.

## 0.2.0 - 2026-05-28

Supply-chain integrity surface. All four pieces are opt-in; default behavior is unchanged.

- `ai-precheck` input - when `'true'`, runs `--ai-precheck` against the AI compat-check endpoint before the obfuscation API call. Aborts the build on error-level findings without consuming obfuscation quota.
- `ai-precheck-fail-on` - gate level: `error` (default), `warning`, or `never`.
- `estimate` input - `'true'` to fail-fast when the AI quota is exhausted before the build runs; `'warn'` to log without blocking; `'false'` (default) to skip.
- `watermark` + `watermark-key` inputs - embed an HMAC-SHA256 watermark in every protected file. The key is wired via `JSO_WATERMARK_KEY` env (not command-line args) so it doesn't appear in step logs.
- `sign-release-key` input - path to an Ed25519 private key (`.priv.pem` from `npx jso-protector --genkey-release <name>`). When set, the action writes a `.manifest.json.sig` alongside the manifest.
- `manifest` input - explicit manifest path (auto-derived from `output` when `sign-release-key` is also set).
- New outputs: `watermark-tag` (echo of the input), `release-sig-path` (artifact path for downstream upload steps).

## 0.1.0 - 2026-05-19

Initial release.

- Composite action wrapping `jso-protector` for any GitHub Actions workflow.
- Auto-tags every build with `${{ github.sha }}` as the release label so audit-log entries group by commit.
- Surfaces `build-id` and `polymorphism-fingerprint` as step outputs for downstream steps (artifact upload, runtime injection, crash-reporter wiring).
- Writes the full API report JSON to a path of the caller's choice for later stack-trace symbolication via `jso-symbolicate`.
- Pinnable `cli-version` for reproducible builds.
