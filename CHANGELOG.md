# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-31

First public release.

### Added
- Global shortcut capture panel for Notion pages and databases, with dynamic property forms.
- Markdown body converted to Notion blocks via markdown-it: headings, nested lists and to-dos, quotes, code, tables, images, dividers, inline formatting and links.
- Live-formatting note editor (Milkdown): Markdown shortcuts, `/` block menu, selection toolbar, and rich paste from web pages.
- Per-capture destination switcher in the panel header (Ctrl/Cmd+K), with recent destinations first.
- Unfinished notes are kept when the panel closes and across restarts; Discard with Undo.
- "Open in Notion" link after saving; pending offline captures shown in the panel footer.
- Resizable capture panel (size remembered); wider 600px default.
- Large databases show their most useful properties first, with "+ N more" for the rest.
- Offline queue with automatic background sync; tray menu to sync now or discard failed captures.
- Sign-in with a Notion internal integration token, encrypted with the OS keychain.
- Light/dark/system themes, configurable panel position, width and font size.
- Automatic updates from GitHub Releases: background download with silent install on quit or via
  "Restart to install" (Windows, Linux AppImage). macOS and `.deb` builds check for updates and link to the
  release page. Settings → Updates shows status, progress and release notes, with a manual check,
  an automatic-download toggle and a Beta channel; the tray menu has "Check for Updates…".
- Installers for Windows (NSIS), macOS (DMG/ZIP, Intel and Apple silicon) and Linux (AppImage, deb).

[Unreleased]: https://github.com/somaraj/notion-quick-capture/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/somaraj/notion-quick-capture/releases/tag/v1.0.0
