# Changelog

This file records user-visible changes made by this product fork. Upstream T3 Code changes are recorded when they are integrated, not when they first appear upstream.

The project follows semantic versioning after its first public release.

## Unreleased

### Added

- A standalone, web-first coding workspace with general chats that can start outside a project and move into a project later.
- Runtime, account, model, execution-mode, skill, command, plugin, and MCP capability views driven by installed provider adapters.
- Streamed chat state, queued approvals, cancellation, usage limits, redacted diagnostics, terminal and diff surfaces, and one-writer workspace protection.
- Fork-owned provider qualification, unsigned Windows beta artifact, and seeded browser-capture workflows for a one-to-three-user local beta.

### Changed

- Product data now has an explicit owner and workspace scope under an isolated configurable root.
- Provider sessions expose correlated run and trace identifiers and disclose unsupported resume behavior.
- The streaming composer uses compositor-safe motion and honors reduced-motion preferences.

### Fixed

- Beta browser captures now stop the server before SQLite fixture seeding, probe Vite through `localhost`, and pass capture arguments without an extra separator.

### Removed

- Active release workflows that depended on upstream-owned runners, signing identities, relays, Expo accounts, or publishing credentials.

### Security

- Provider event content logging is disabled by default, provider secrets stay behind the local secret-store boundary, and diagnostics exclude credentials and conversation content by default.
