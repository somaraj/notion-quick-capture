# Releasing

Releases are built by GitHub Actions on Windows, macOS and Linux runners, so you can publish installers
for all three platforms from any machine.

## Cutting a release

1. Make sure `main` is green in CI.
2. Update `CHANGELOG.md`: move the **Unreleased** entries under a new version heading.
3. Bump the version and create the tag:
   ```sh
   npm version 1.1.0          # updates package.json + package-lock.json, commits, tags v1.1.0
   git push origin main --follow-tags
   ```
4. The [Release workflow](../.github/workflows/release.yml) checks that the tag matches `package.json`,
   creates a **draft** GitHub Release, and uploads from each OS:
   - Windows: `notion-quick-capture-setup-<version>.exe` + `latest.yml`
   - macOS: DMG and ZIP for `x64` and `arm64` + `latest-mac.yml`
   - Linux: AppImage and `.deb` + `latest-linux.yml`
5. Review the draft on the Releases page, edit the notes, and click **Publish**.
   Auto-update only sees published (non-draft) releases.

Keep the `latest*.yml` and `.blockmap` files attached — the auto-updater needs them.

## Testing a build locally

```sh
npm run package       # installer for your current OS in dist-electron/
```

On Windows, run `dist-electron/win-unpacked/Notion Quick Capture.exe` to try the packaged app without
installing. If you launch it from a VS Code terminal and it exits with `bad option`, clear the
`ELECTRON_RUN_AS_NODE` environment variable first (VS Code sets it for its integrated terminals).

## Development builds (every push)

The [CI workflow](../.github/workflows/ci.yml) runs on every push to any branch and on every pull request:

1. **Check** (Ubuntu): lint, typecheck, unit tests.
2. **Build** (Windows, macOS, Linux in parallel): build, UI smoke tests, then full unsigned installers
   (NSIS `.exe`; DMG + ZIP for x64 and arm64; AppImage + `.deb`).
3. The installers are uploaded as run artifacts named `notion-quick-capture-<OS>-<short sha>` and kept for
   14 days. Download them from the **Artifacts** section of the run summary.

Use these to test on platforms you don't own. They are not releases: they're unsigned, aren't attached to
a GitHub Release, and installed copies won't auto-update to them. Tags (`v*.*.*`) are skipped by CI and
handled by the release workflow instead.

## How auto-update works

- Installed apps check GitHub Releases at launch, every 6 hours, and after waking from sleep when the last
  check was more than an hour ago. They only see **published** releases, never drafts.
- Releases marked **pre-release** go only to users on the Beta channel (Settings → Updates). Tag them like
  `v1.1.0-beta.1`.
- **Windows** and the **Linux AppImage** download updates in the background and install silently on quit,
  or right away via "Restart to install" (tray, notification or Settings). **macOS** (until
  `MAC_RELEASES_SIGNED` is `true`) and **`.deb`** installs only check, and link to the release page.
- After updating, the app shows a one-time "Updated to vX" notification linking to the release notes.
  The notes come from the GitHub Release body, so write them for users.
- The repository must be **public**: the updater reads releases without a token.

Testing:

- In development, `NQC_DEV_UPDATES=1 npm run dev` reads `dev-app-update.yml` in the repo root. It needs a
  published release newer than the `package.json` version.
- Before trusting a new updater change end to end: install vX, publish vX+0.0.1, and confirm the update is
  detected → downloaded → "Restart to install" relaunches on the new version.

## Code signing (optional, recommended)

Unsigned builds work, but users see SmartScreen / Gatekeeper warnings (documented in the README), and
**macOS auto-update requires a signed app**. Signing is enabled by adding repository secrets
(Settings → Secrets and variables → Actions); the release workflow picks them up automatically.

### Windows

| Secret | Value |
|---|---|
| `WIN_CSC_LINK` | Base64-encoded `.pfx` code-signing certificate (or an HTTPS URL to it) |
| `WIN_CSC_KEY_PASSWORD` | Its password |

Note: many certificate authorities now issue code-signing keys only on hardware tokens or cloud HSMs.
For those (e.g. Azure Trusted Signing), configure electron-builder's `win.azureSignOptions` or a custom
`win.sign` script instead — see the [electron-builder docs](https://www.electron.build/code-signing-win).

### macOS

Requires an Apple Developer Program membership.

| Secret | Value |
|---|---|
| `MAC_CSC_LINK` | Base64-encoded "Developer ID Application" `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Its password |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID |
| `APPLE_TEAM_ID` | Your 10-character team ID |

After macOS releases are signed and notarized, set `MAC_RELEASES_SIGNED = true` in
`src/main/updater/autoUpdater.ts` to enable auto-update on macOS.

## Private builds with OAuth

Public releases deliberately ship **without** OAuth credentials. A Notion OAuth flow needs the
integration's client secret, and anything bundled in a desktop app can be extracted by its users.
Each user instead connects with their own internal integration token, so no shared secret exists.

If you operate your own public Notion integration and want "Sign in with Notion" in an internal build
that you do **not** distribute publicly:

1. In your Notion integration settings, add the redirect URI `http://localhost:21549/callback`.
2. Build with the credentials and the explicit opt-in flag:
   ```sh
   # PowerShell
   $env:NQC_EMBED_OAUTH="1"; $env:NOTION_OAUTH_CLIENT_ID="..."; $env:NOTION_OAUTH_CLIENT_SECRET="..."
   npm run package
   ```
   This writes `dist-main/oauth-credentials.json` into the app. Without `NQC_EMBED_OAUTH=1` the file is
   always removed.

Never add these credentials as secrets of the public release workflow.
