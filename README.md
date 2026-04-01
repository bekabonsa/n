# n

Hosted TizenBrew wrapper for a Nuvio TV test build.

## Update from source

This repo has two parts:

- `app/`: thin TizenBrew launcher
- `site/`: hosted web build opened by the launcher through a static HTML host

Run this from the main Nuvio web repo:

```bash
npm run build
npm run sync:tizenbrew -- --path /absolute/path/to/Nuvio-TIZEN
```

If you want to bake a custom runtime env into the hosted build:

```bash
npm run sync:tizenbrew -- --path /absolute/path/to/Nuvio-TIZEN --env-source /absolute/path/to/nuvio.env.js
```

## Install in TizenBrew

Add this GitHub module in TizenBrew:

```text
bekabonsa/n
```

For deterministic testing, use a commit-pinned module string instead:

```text
bekabonsa/n@<commit>
```

## Hosting Rule

Do not point the launcher at jsDelivr GitHub file URLs for `site/index.html`.

- Bad: `https://cdn.jsdelivr.net/gh/owner/repo/site/index.html`
- Good: `https://rawcdn.githack.com/owner/repo/<commit>/site/index.html`

The jsDelivr GitHub file endpoint can serve HTML as `text/plain`, which causes the Samsung TV launcher to appear and then black screen before the hosted app boots.
