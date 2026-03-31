# Nuvio-TIZEN

Hosted TizenBrew wrapper for a Nuvio TV test build.

## Update from source

This repo has two parts:

- `app/`: thin TizenBrew launcher
- `site/`: hosted web build opened by the launcher through jsDelivr

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

Push this repo to GitHub, then add it as a GitHub module from the TizenBrew module manager.
