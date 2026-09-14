# JavaScript Obfuscator - GitHub Action

Protect built JavaScript assets with JavaScript Obfuscator from any GitHub Actions workflow. Tags every run with the commit SHA, captures the BuildId and PolymorphismFingerprint as step outputs, writes the full API report for later symbolication, can run source-free release, migration, payment-page script/header evidence, runtime incident evidence, and PCI DSS v4 evidence workflows, and can produce source-map, VM proof, and AI-resistance evidence packets after protection.

## Quick start

```yaml
name: build-and-protect
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
      - id: protect
        uses: javascriptobfuscator-com/jso-github-action@v0.4
        with:
          input: dist
          output: dist-protected
          # No account needed: this runs the free preset on the anonymous tier
          # (5 runs per hour per IP). For regular CI, add a free account's key
          # (100 runs per hour); a paid key also unlocks standard, balanced and maximum:
          #   preset: balanced
          #   api-key: ${{ secrets.JSO_API_KEY }}
          #   api-password: ${{ secrets.JSO_API_PASSWORD }}
          report: ${{ runner.temp }}/jso-report.json
      - run: |
          echo "BuildId: ${{ steps.protect.outputs.build-id }}"
          echo "Fingerprint: ${{ steps.protect.outputs.polymorphism-fingerprint }}"
      - uses: actions/upload-artifact@v4
        with:
          name: protected-${{ steps.protect.outputs.build-id }}
          path: |
            dist-protected/
            ${{ runner.temp }}/jso-report.json
```

## Inputs

| Input | Required | Default | Notes |
|---|---|---|---|
| `input` | yes | `dist` | Folder of built JS to protect. |
| `output` | yes | `dist-protected` | Where protected JS is written. |
| `preset` | no | `free` | `free` works with no account. `standard`, `balanced` and `maximum` use paid features and need a paid plan's key. |
| `config` | no | none | Path to `jso.config.json`. Overrides `input`/`output`/`preset`. |
| `local` | no | `false` | Protect on the runner instead of uploading source. **Windows runners only** — see below. |
| `local-exe` | no | none | Path to `cli/jso-local.exe` when `local: true`. |
| `api-key` | no | none | Leave unset for the anonymous free tier (5 runs per hour per IP). When set, always from a GitHub secret: `${{ secrets.JSO_API_KEY }}`. A free account gives 100 runs per hour; a paid key unlocks the paid presets. |
| `api-password` | no | none | Set together with `api-key`, from a GitHub secret: `${{ secrets.JSO_API_PASSWORD }}`. |
| `endpoint` | no | `https://javascriptobfuscator.com/HttpApi.ashx` | Override only for staging or self-hosted endpoints. |
| `label` | no | `${{ github.sha }}` | Tagged on the API request. Groups audit-log entries by commit. |
| `cli-version` | no | `latest` | Pin for reproducible builds: e.g. `0.1.1`. |
| `report` | no | tmpfile | If set, the full API report JSON is written here. Upload as a build artifact for later symbolication. |
| `release-check` | no | `false` | When `true`, runs `--release-check --json` before protection and writes a source-free CI preflight report. |
| `release-check-report` | no | tmpfile | Optional path for the release-check JSON report. |
| `competitor-gap-report` | no | `false` | When `true`, runs `--competitor-gap-report --json` before protection to surface migration parity gaps against common JavaScript obfuscators. |
| `competitor-gap-report-path` | no | tmpfile | Optional path for the competitor gap JSON report. Upload it when migrating from `javascript-obfuscator`, JS-Confuser, Jscrambler, or JSDefender. |
| `migration-review` | no | `false` | When `true`, runs `--migration-review` before protection to write one source-free owner checklist for accepted competitor-only fields. |
| `migration-review-report` | no | tmpfile | Optional path for the migration review JSON report. |
| `payment-script-inventory` | no | none | Path to the approved payment-page script inventory JSON/CSV. Set with `runtime-inventory-snapshot` to run the audit gate. |
| `runtime-inventory-snapshot` | no | none | Path to a saved `third-party-inventory` runtime snapshot JSON. Required when `payment-script-inventory` is set. |
| `script-inventory-audit-report` | no | tmpfile | Optional path for the source-free payment-page inventory audit JSON report. |
| `payment-page-har` | no | none | Path to a browser or synthetic-monitor HAR export for checkout pages. When set, the action writes a source-free payment-page security-header snapshot. |
| `payment-page-headers-baseline` | no | none | Path to the previous approved payment-page security-header JSON snapshot. Marks new HAR pages as `match`, `mismatch`, or `missing`. |
| `payment-page-url-pattern` | no | none | Optional JavaScript regular expression that keeps only matching HAR page URLs, such as `checkout|payment|wallet`. |
| `payment-page-headers-report` | no | tmpfile | Optional path for the source-free payment-page security-header JSON snapshot. |
| `source-map-evidence` | no | `false` | When `true`, verifies the protected manifest after protection and writes a source-free report proving no `.map` files or `sourceMappingURL` comments are exposed. |
| `source-map-evidence-report` | no | tmpfile | Optional path for the source-map evidence JSON report. |
| `runtime-incident-export` | no | none | Path to a Dashboard Monitoring runtime incident CSV/JSON export. When set, writes a source-free runtime incident evidence report and fails on active high/critical packets. |
| `runtime-incident-evidence-report` | no | tmpfile | Optional path for the runtime incident evidence JSON report. |
| `pci-dss-v4-evidence` | no | `false` | When `true`, assembles a source-free PCI DSS v4.0.1 evidence report after protection from the manifest plus optional payment-page, runtime, beacon, and SIEM evidence. |
| `pci-dss-v4-report` | no | tmpfile | Optional path for the PCI DSS v4 Markdown evidence report. |
| `pci-dss-v4-json-report` | no | tmpfile | Optional path for the PCI DSS v4 JSON evidence report. |
| `pci-dss-v4-organization` | no | none | Customer or account name to show in the PCI DSS v4 evidence report header. |
| `pci-dss-v4-root` | no | action `output` | Protected artifact root to re-hash for PCI DSS v4 evidence. Set this when `config` writes output somewhere else. |
| `pci-dss-v4-beacon-url` | no | none | Runtime Defense beacon URL to cite in PCI DSS v4 change-detection evidence. |
| `pci-dss-v4-siem` | no | none | Customer-owned alert destination to cite in PCI DSS v4 evidence: `splunk-hec`, `elasticsearch`, or `webhook`. |
| `pci-dss-v4-allow-unsigned` | no | `false` | Allows an unsigned manifest so the action can write an incomplete PCI report; the report still exits nonzero until signing evidence is present. |
| `vm-proof-pack` | no | `false` | When `true`, writes a source-free VM proof pack from the saved API report after protection and fails when required VM evidence is missing. |
| `vm-proof-pack-report` | no | tmpfile | Optional path for the VM proof pack JSON report. |
| `ai-resistance-evidence` | no | `false` | When `true`, writes a source-free AI-resistance evidence packet from the saved API report after protection. Does not call an AI provider. |
| `ai-resistance-evidence-report` | no | tmpfile | Optional path for the AI-resistance evidence JSON report. |
| `ai-resistance-require-vm-proof` | no | `false` | When `true`, makes AI-resistance evidence fail unless the saved API report also contains passing VM proof. |
| `min-vm-functions` | no | `1` | Minimum virtualized function count required by VM proof pack and AI-resistance gates. |
| `manifest` | no | none | Optional path to write the protection manifest JSON. Required when `sign-release-key` is set; also used by source-map and PCI evidence. |
| `ai-precheck` | no | `false` | When `true`, scans input files for AI compatibility risks before the obfuscation API call. |
| `ai-precheck-fail-on` | no | `error` | Gate level for `ai-precheck`: `error`, `warning`, or `never`. |
| `estimate` | no | `false` | When `true`, checks current quota before protection. Set to `warn` to report without blocking. |
| `watermark` | no | none | HMAC watermark tag to embed in protected files, commonly `${{ github.sha }}`. |
| `watermark-key` | no | none | HMAC secret for watermark verification. Required when `watermark` is set. |
| `sign-release-key` | no | none | Path to an Ed25519 private key used to sign the manifest and write a `.sig` attestation. |

## Outputs

| Output | Description |
|---|---|
| `build-id` | `Report.BuildId` returned by the API. Inject this into your runtime as a global so crash reports carry the right release identifier. |
| `polymorphism-fingerprint` | Short SHA-256 fingerprint over the protected output. Two builds of the same input must produce different fingerprints when polymorphism is engaged. |
| `report-path` | Path to the saved full API report JSON written by the protection step. |
| `release-check-report` | Path to the source-free `--release-check --json` report when enabled. |
| `competitor-gap-report-path` | Path to the `--competitor-gap-report --json` parity report when enabled. |
| `migration-review-report` | Path to the source-free migration review JSON report when enabled. |
| `script-inventory-audit-report` | Path to the source-free payment-page script inventory audit JSON report when enabled. |
| `payment-page-headers-report` | Path to the source-free payment-page security-header JSON snapshot when enabled. |
| `source-map-evidence-report` | Path to the source-free source-map evidence JSON report when enabled. |
| `runtime-incident-evidence-report` | Path to the source-free runtime incident evidence JSON report when enabled. |
| `pci-dss-v4-report` | Path to the source-free PCI DSS v4 Markdown evidence report when enabled. |
| `pci-dss-v4-json-report` | Path to the source-free PCI DSS v4 JSON evidence report when enabled. |
| `vm-proof-pack-report` | Path to the source-free VM proof pack JSON report when enabled. |
| `ai-resistance-evidence-report` | Path to the source-free AI-resistance evidence JSON report when enabled. |
| `watermark-tag` | The watermark tag echoed back when watermarking is enabled. |
| `release-sig-path` | Path to the signed release attestation when `sign-release-key` is set. |

## Protecting without uploading source (`local: true`)

By default this action posts the selected JavaScript to the hosted API. When
policy forbids that, set `local: true` and the action protects on the runner
instead. Two prerequisites, both enforced rather than assumed:

- **A Windows runner.** `jso-local` ships inside the Windows desktop archive,
  so the step fails immediately with a clear message on Linux or macOS rather
  than after the build has already run.
- **The executable must be on the runner.** A previous step has to fetch and
  extract the desktop download; point `local-exe` (or `JSO_LOCAL_EXE`) at
  `cli/jso-local.exe`.

```yaml
jobs:
  protect:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build

      - name: Fetch the JSO desktop archive
        shell: bash
        run: |
          curl -sSL -o jso.zip "https://javascriptobfuscator.com/download/javascriptobfuscator.zip?v=3.4.2"
          unzip -q jso.zip -d jso

      - uses: javascriptobfuscator-com/jso-github-action@v0.4
        with:
          input: dist
          output: dist-protected
          local: true
          local-exe: jso/cli/jso-local.exe
          api-key: ${{ secrets.JSO_API_KEY }}
          api-password: ${{ secrets.JSO_API_PASSWORD }}
```

State the boundary accurately to reviewers: the source body never leaves the
runner, but a **source-free** plan/option check still calls the service,
because source-local protection is a paid capability. A build that requests VM
bytecode protection fails rather than silently producing weaker output.
Verify the archive against the published checksum in
`https://javascriptobfuscator.com/download/SHA256SUMS.txt` if your policy
requires it.

## Preflight and Source-Free Evidence

When a workflow is replacing `javascript-obfuscator`, JS-Confuser, Jscrambler, or JSDefender, enable the source-free preflight reports before the API-backed protection step. The release check validates config, file discovery, and credential wiring; the competitor gap report keeps parity and limitation groups visible; the migration review gives release owners one checklist for accepted competitor-only fields such as source maps, identifier caches, runtime self-defending, anti-debugging, integrity, seeds, and custom locks. Enable source-map evidence when reviewers need proof, after protection, that the shipped artifact matches the manifest and does not expose source maps.

```yaml
- id: protect
  uses: javascriptobfuscator-com/jso-github-action@v0.4
  with:
    config: jso.config.json
    api-key: ${{ secrets.JSO_API_KEY }}
    api-password: ${{ secrets.JSO_API_PASSWORD }}
    release-check: 'true'
    release-check-report: ${{ runner.temp }}/jso-release-check.json
    competitor-gap-report: 'true'
    competitor-gap-report-path: ${{ runner.temp }}/jso-competitor-gap.json
    migration-review: 'true'
    migration-review-report: ${{ runner.temp }}/jso-migration-review.json
    source-map-evidence: 'true'
    source-map-evidence-report: ${{ runner.temp }}/jso-source-map-evidence.json

- uses: actions/upload-artifact@v4
  with:
    name: jso-release-evidence
    path: |
      ${{ steps.protect.outputs.release-check-report }}
      ${{ steps.protect.outputs.competitor-gap-report-path }}
      ${{ steps.protect.outputs.migration-review-report }}
      ${{ steps.protect.outputs.source-map-evidence-report }}
```

When Dashboard Monitoring exports runtime incidents for a checkout, activation, or licensed-release scope, add the runtime incident evidence preflight. The action writes a source-free JSON packet with incident counts, BuildIDs, routing recommendation, response-window state, export SHA-256, and safe-sharing boundaries. Active high/critical packets fail the job until the packet is acknowledged and routed.

```yaml
- id: protect
  uses: javascriptobfuscator-com/jso-github-action@v0.4
  with:
    config: jso.config.json
    api-key: ${{ secrets.JSO_API_KEY }}
    api-password: ${{ secrets.JSO_API_PASSWORD }}
    runtime-incident-export: reports/runtime-incidents.json
    runtime-incident-evidence-report: ${{ runner.temp }}/runtime-incident-evidence.json

- uses: actions/upload-artifact@v4
  with:
    name: runtime-incident-evidence
    path: ${{ steps.protect.outputs.runtime-incident-evidence-report }}
```

When reviewers need VM or AI-resistance evidence, enable the post-protection packets. Both read the saved API report, not source code. The AI evidence packet does not call an AI provider; it summarizes current release evidence and keeps Resistance Score marked as planned.

```yaml
- id: protect
  uses: javascriptobfuscator-com/jso-github-action@v0.4
  with:
    config: jso.config.json
    api-key: ${{ secrets.JSO_API_KEY }}
    api-password: ${{ secrets.JSO_API_PASSWORD }}
    report: ${{ runner.temp }}/jso-report.json
    vm-proof-pack: 'true'
    vm-proof-pack-report: ${{ runner.temp }}/vm-proof-pack.json
    ai-resistance-evidence: 'true'
    ai-resistance-evidence-report: ${{ runner.temp }}/ai-resistance-evidence.json

- uses: actions/upload-artifact@v4
  with:
    name: reviewer-evidence
    path: |
      ${{ steps.protect.outputs.report-path }}
      ${{ steps.protect.outputs.vm-proof-pack-report }}
      ${{ steps.protect.outputs.ai-resistance-evidence-report }}
```

For checkout, wallet, subscription, activation, and license pages, add the
payment-page script inventory audit gate after your browser/runtime test has
written a `third-party-inventory` snapshot. If your browser or synthetic
monitor also saves a HAR file, pass it as `payment-page-har` so the same run
creates a payment-page security-header snapshot for CSP, HSTS, frame/referrer
policy, reporting endpoint, page/frame URL, and source HAR hash evidence. The
action writes both packets as source-free JSON artifacts, adds a concise GitHub
step summary, and emits workflow annotations for the first audit or header
findings so checkout owners can see the drift without opening the JSON first.
Add `payment-page-headers-baseline` when you keep an approved snapshot in the
evidence repo and want the CI run to call out security-header matches,
mismatches, or newly observed checkout pages.

```yaml
- id: protect
  uses: javascriptobfuscator-com/jso-github-action@v0.4
  with:
    config: jso.config.json
    api-key: ${{ secrets.JSO_API_KEY }}
    api-password: ${{ secrets.JSO_API_PASSWORD }}
    manifest: dist-protected/build.manifest.json
    watermark: ${{ github.sha }}
    watermark-key: ${{ secrets.JSO_WATERMARK_KEY }}
    sign-release-key: ${{ runner.temp }}/ci-key.priv.pem
    payment-script-inventory: reports/payment-script-inventory.json
    runtime-inventory-snapshot: reports/runtime-inventory.json
    script-inventory-audit-report: ${{ runner.temp }}/payment-script-inventory-audit.json
    payment-page-har: reports/checkout.har
    payment-page-headers-baseline: reports/payment-page-headers.baseline.json
    payment-page-url-pattern: checkout|payment|wallet
    payment-page-headers-report: ${{ runner.temp }}/payment-page-headers.json
    pci-dss-v4-evidence: 'true'
    pci-dss-v4-report: ${{ runner.temp }}/pci-dss-v4.md
    pci-dss-v4-json-report: ${{ runner.temp }}/pci-dss-v4.json
    pci-dss-v4-organization: Example Corp
    pci-dss-v4-beacon-url: https://javascriptobfuscator.com/v1/runtime/beacon.ashx
    pci-dss-v4-siem: splunk-hec

- uses: actions/upload-artifact@v4
  with:
    name: payment-page-evidence
    path: |
      ${{ steps.protect.outputs.script-inventory-audit-report }}
      ${{ steps.protect.outputs.payment-page-headers-report }}
      ${{ steps.protect.outputs.pci-dss-v4-report }}
      ${{ steps.protect.outputs.pci-dss-v4-json-report }}
```

The PCI DSS v4 evidence report uses the protected manifest created by the
action, prefers the signed `.sig` envelope when `sign-release-key` is enabled,
and reuses the payment-page inventory audit, security-header snapshot, and
runtime incident export already supplied to the workflow. It is a source-free
review packet, not a Report on Compliance or a replacement for a QSA-led
assessment.

## Symbolicating crashes later

Save the report as a build artifact, then when a stack trace comes in from production:

```bash
npx jso-symbolicate --map jso-report.json --stack crash.txt
```

See the [stack-trace symbolication doc](https://javascriptobfuscator.com/docs/symbolication.aspx) for the full workflow.

## Supply-chain integrity (opt-in)

All four pieces are off by default. Add any combination to your workflow.

```yaml
- name: Protect with supply-chain integrity
  uses: javascriptobfuscator-com/jso-github-action@v0.4
  with:
    input: dist
    output: dist-protected
    manifest: dist-protected/build.manifest.json
    api-key: ${{ secrets.JSO_API_KEY }}
    api-password: ${{ secrets.JSO_API_PASSWORD }}

    # 1. Fail-fast if quota is exhausted before we burn obfuscation actions:
    estimate: 'true'

    # 2. AI scans every input file for obfuscation-breaking patterns
    #    (eval, Function ctor, framework reflection traps). Aborts the
    #    build on findings *without* consuming obfuscation quota.
    ai-precheck: 'true'
    ai-precheck-fail-on: 'error'

    # 3. Embed an HMAC-signed watermark in every output file.
    #    Tag is visible inside the output; only holders of the key can
    #    verify it. Forensics + anti-piracy.
    watermark: ${{ github.sha }}
    watermark-key: ${{ secrets.JSO_WATERMARK_KEY }}

    # 4. Ed25519-sign a release attestation alongside the manifest.
    #    Generate the keypair once with:
    #      npx jso-protector --genkey-release ci-key
    #    Commit ci-key.pub.pem; keep ci-key.priv.pem in a CI secret.
    sign-release-key: ${{ runner.temp }}/ci-key.priv.pem

    # 5. Produce source-free evidence that the protected release has no
    #    source-map files or sourceMappingURL comments.
    source-map-evidence: 'true'
    source-map-evidence-report: ${{ runner.temp }}/jso-source-map-evidence.json

- name: Publish signed manifest as a build artifact
  if: steps.protect.outputs.release-sig-path != ''
  uses: actions/upload-artifact@v4
  with:
    name: release-attestation
    path: |
      ${{ steps.protect.outputs.release-sig-path }}
      ${{ steps.protect.outputs.source-map-evidence-report }}
```

Downstream verifiers (CD pipeline, post-deploy job, customer audit):

```bash
# Single-file watermark check:
npx jso-protector --verify-watermark dist-protected/app.js \
    --watermark-key "$JSO_WATERMARK_KEY"

# Bulk tree scan (CDN audit):
npx jso-protector --scan-watermarks dist-protected/ \
    --watermark-key "$JSO_WATERMARK_KEY"

# Verify the release attestation + re-hash all files on disk:
npx jso-protector --verify-release dist-protected/build.manifest.json.sig \
    --public-key ci-key.pub.pem \
    --verify-root dist-protected/
```

The watermark + release attestation wire formats are documented at [Docs/WireFormat.aspx#watermark](https://javascriptobfuscator.com/docs/wireformat.aspx#watermark) so any-language verifier can interoperate.

## Security

- API credentials must come from GitHub secrets; never paste them into the workflow YAML.
- Endpoint is HTTPS by default; the action refuses to read credentials from process environment if you've overridden it to HTTP.
- The action installs `jso-protector` with `--no-save` so no `package.json` is mutated.

## License

UNLICENSED. Free companion to the JSO service. An active JSO account is required to make API calls.
