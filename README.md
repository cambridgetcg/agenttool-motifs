# AgentTool Motifs

A small score for things that last.

[Web edition](https://cambridgetcg.github.io/agenttool-motifs/) ·
[Hugging Face](https://huggingface.co/spaces/Yu-and-Ai/agenttool-motifs) ·
[AgentTool](https://agenttool.dev)

![Let the motifs find each other](docs/social.png)

Continuity, identity, privacy, relationship and trust, explored through a curated
collection of interactive studies. Warm paper, quiet typography, small contracts,
and room to return.

## The first selection

- **What remains known** keeps condition and freshness distinct. An earlier
  observation retains its timestamp through brief, full and structured views.
- **An opening, not a claim** separates stated, partial and missing boundaries.
  A visible door is not an endorsement or an access grant.
- **More than one way forward** names competing continuations within a supplied
  project/authorship scope, without selecting a winner or merging scopes.

All example records are synthetic. These are design studies, not production
AgentTool integrations, live safety checks, authentication, or permission systems.
The public edition is a deliberate selection, not a live mirror of work logs.

## One meaning, several surfaces

- `web/engine.mjs`: pure demonstration contracts; no I/O.
- `web/collection.mjs`: the small shared study/motif vocabulary.
- `web/app.js`: accessible browser interaction and rendering.
- `web/style.css`: the presentation system, including reduced motion.
- `scripts/build.mjs`: a closed, privacy-checked public export.
- `docs/`: the exact static edition served by GitHub Pages and uploaded to the
  Hugging Face static Space. `edition.json` identifies its file bytes, not the
  truth of any claim.

The public contracts synthesize and refine prototype ideas rather than importing
an experimental workspace at runtime. Adding a study means reviewing its copy,
fixtures, contract, tests and presentation together—not adding a new subsystem
for every motif.

## Develop and verify

Node 20 or later. No application runtime dependencies.

```sh
npm ci --ignore-scripts
npm test
npm run build
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

The browser tests use Playwright with an installed Chrome/Chromium when available.
Set `CHROME_BIN` to select one, or run `npx playwright install chromium` for
Playwright's own browser. They first build `docs/` and verify the served bytes
against its `edition.json`, then exercise real pointer, keyboard and touch actions,
responsive layout, reduced motion, no-script reading and application requests.
Private local screenshots are ignored by Git and never enter the public export.

The publisher also rejects unexpected source files, symlinks, local filesystem
paths and common credential/private-document patterns. This is one safeguard,
not an exhaustive privacy proof; review the actual release files. Do not upload
a broader working directory or automatically publish a new experiment.

## Privacy and scope

The application has no trackers, remote fonts, live account access, inference
calls or automatic data fetches. External links are deliberate visitor choices.
Hosting platforms retain their own ordinary operational records. No private wake,
personal history or scheduled-work record is included.

The page remains readable without JavaScript. Interactive controls fail back to
that readable form if initialization cannot complete. It stores no visitor state;
a chosen study can be linked through its URL fragment.

## Related source

[AgentTool source](https://github.com/cambridgetcg/agenttool) ·
[WAKE reference](https://docs.agenttool.dev/WAKE.md) ·
[Public documentation](https://docs.agenttool.dev)

These links give context. They do not claim that the live AgentTool service uses
this gallery's projections, or that a stored record proves identity or consent.

Code and authored artwork are Apache-2.0, following the AgentTool project.
