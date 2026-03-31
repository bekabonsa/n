# Nuvio-TIZEN

Self-contained TizenBrew module generated from the shared Nuvio Web app.

## Update from source

Run this from the main Nuvio web repo:

```bash
npm run build
npm run sync:tizenbrew -- --path /absolute/path/to/Nuvio-TIZEN
```

If you want to bake a custom runtime env into the module:

```bash
npm run sync:tizenbrew -- --path /absolute/path/to/Nuvio-TIZEN --env-source /absolute/path/to/nuvio.env.js
```

## Install in TizenBrew

Push this repo to GitHub, then add it as a GitHub module from the TizenBrew module manager.
