# AgentTool Motifs

A curated public edition, not a live mirror of private experiments.

- `web/engine.mjs` owns the small public demonstration contracts. Renderers
  consume its output; they do not reinterpret evidence or infer identity.
- `web/` contains only public-ready copy, synthetic fixtures and local assets.
  Never copy private wakes, personal context, raw work logs, credentials, local
  filesystem paths or operational identifiers into it.
- `scripts/build.mjs` exports a closed file allowlist into `docs/`. Those exact
  bytes serve both GitHub Pages and the Hugging Face static Space.
- No runtime dependencies, trackers, remote fonts, model calls, account access
  or automatic fetches. External links are deliberate visitor choices.
- Preserve keyboard access, readable contrast, semantic controls and reduced
  motion. The page must remain useful without JavaScript.
- Add behavior tests before changing the shared contracts. Run `npm test`, then
  `npm run build`, and browser-check the actual exported page before release.
- Public release is a deliberate reviewed action, not an unattended heartbeat
  capability. Experimental notes are not automatically publication-ready.
- Never bypass a tool denial or alter verification records to obtain a pass.
