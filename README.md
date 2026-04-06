# NuvioTizen

`NuvioTizen` is a Samsung Tizen TV web app prototype for a Nuvio-branded streaming shell. It is a single-page TV interface built with plain HTML, CSS, and JavaScript and packaged as a Tizen widget (`.wgt`).

The app includes:

- Nuvio account login with direct credentials and QR-based TV pairing
- Home spotlight rotation and browse rails
- Movie and series catalog browsing
- Search with an on-screen keyboard
- Detail, season, episode, and source selection flows
- Playback controls with audio and subtitle switching
- Tizen packaging through `config.xml`

## Project Layout

- [`index.html`](index.html): app shell and all view markup
- [`css/style.css`](css/style.css): TV layout, navigation, player, login, and spotlight styling
- [`js/main.js`](js/main.js): application state, navigation, auth, catalogs, playback, subtitles, and TV input handling
- [`config.xml`](config.xml): Tizen widget manifest and privileges
- [`images/`](images): logos and app icons
- [`NuvioTizen.wgt`](NuvioTizen.wgt): packaged widget artifact when built

## Requirements

- Samsung Tizen Studio installed
- A valid Samsung certificate profile for packaging
- Network access from the TV or emulator

This repo does not use a Node build system. The runtime app is plain static web assets, and packaging is handled by Tizen Studio.

## Build

Syntax check:

```sh
node --check js/main.js
```

Build the web app:

```sh
"/Users/user/tizen-studio/tools/ide/bin/tizen" build-web -- "$(pwd)"
```

Package the widget:

replace cert in the following command with your certificate

```sh
"/Users/user/tizen-studio/tools/ide/bin/tizen" package -t wgt -s cert -- ./.buildResult
```

Copy the packaged widget to the repo root:

```sh
cp ./.buildResult/*.wgt ./
```

## Runtime Notes

- The app is configured as a Tizen TV widget in [`config.xml`](config.xml).
- Main remote-navigation behavior is implemented in [`js/main.js`](js/main.js).
- Spotlight, browse rails, login, and player UI are styled in [`css/style.css`](css/style.css).
- The app currently uses Supabase and Nuvio endpoints configured directly in [`js/main.js`](js/main.js).

## Current Output

The packaged build artifact is expected at:

- [`NuvioTizen.wgt`](NuvioTizen.wgt)
