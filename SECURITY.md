# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through
[GitHub Security Advisories](https://github.com/somaraj/notion-quick-capture/security/advisories/new).

Include steps to reproduce, the affected version and OS, and the impact you expect. You should get an
acknowledgement within a few days. Please give us a reasonable time to release a fix before disclosing.

## Security model

- **Credentials**: Notion tokens are encrypted with Electron `safeStorage` (Windows DPAPI, macOS Keychain,
  libsecret/KWallet on Linux) and stored in the user's profile. On Linux without a secret service, Electron
  falls back to a weak built-in key; the app logs a warning in that case.
- **No embedded secrets**: official builds contain no API keys or OAuth client secrets. Each user supplies
  their own internal integration token, so one user's token can never be used to reach another user's data.
- **Process isolation**: renderers run with `sandbox`, `contextIsolation`, no `nodeIntegration`, a strict
  Content-Security-Policy, and blocked navigation, pop-ups and `<webview>`. All IPC inputs are validated
  with Zod; config writes from the renderer are restricted to an allow-list.
- **Network**: the app only contacts `api.notion.com` and GitHub (update checks). External links are opened
  in the system browser and limited to `http`, `https` and `mailto`.
- **Local data**: queued offline captures are stored unencrypted in a local SQLite file until sent.
