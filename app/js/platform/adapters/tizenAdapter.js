import { normalizeKeyEvent, isBackEvent } from "../sharedKeys.js";

function getAvplayApi() {
  const webapis = globalThis.webapis;
  const avplay = webapis?.avplay || webapis?.avPlay || globalThis.avplay || null;
  if (!avplay || typeof avplay.open !== "function") {
    return null;
  }
  return avplay;
}

function ensureAvplayHost(videoElement) {
  if (!(videoElement instanceof HTMLElement)) {
    return;
  }
  const parent = videoElement.parentElement;
  if (!(parent instanceof HTMLElement)) {
    return;
  }

  parent.style.position = "relative";
  parent.style.background = "black";
  parent.style.overflow = "hidden";

  let host = parent.querySelector("#nuvioTizenAvplayHost");
  if (!(host instanceof HTMLElement)) {
    host = document.createElement("div");
    host.id = "nuvioTizenAvplayHost";
    host.style.position = "absolute";
    host.style.left = "0";
    host.style.top = "0";
    host.style.right = "0";
    host.style.bottom = "0";
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.background = "black";
    host.style.overflow = "hidden";
    host.style.pointerEvents = "none";
    host.style.zIndex = "0";
    parent.insertBefore(host, videoElement);
  }

  let objectNode = host.querySelector('object[type="application/avplayer"]');
  if (!(objectNode instanceof HTMLElement)) {
    objectNode = document.createElement("object");
    objectNode.type = "application/avplayer";
    objectNode.style.display = "block";
    objectNode.style.width = "100%";
    objectNode.style.height = "100%";
    objectNode.style.background = "black";
    objectNode.style.pointerEvents = "none";
    host.appendChild(objectNode);
  }

  videoElement.style.position = "absolute";
  videoElement.style.left = "0";
  videoElement.style.top = "0";
  videoElement.style.width = "100%";
  videoElement.style.height = "100%";
  videoElement.style.background = "transparent";
  videoElement.style.opacity = "0";
  videoElement.style.pointerEvents = "none";
  videoElement.style.zIndex = "0";
 }

export const tizenAdapter = {
  name: "tizen",

  init() {
    const tvInputDevice = globalThis.tizen?.tvinputdevice || null;
    if (!tvInputDevice) {
      return;
    }

    const mediaKeys = [
      "MediaPlayPause",
      "MediaPlay",
      "MediaPause",
      "MediaStop",
      "MediaFastForward",
      "MediaRewind",
      "MediaTrackPrevious",
      "MediaTrackNext"
    ];

    if (typeof tvInputDevice.registerKeyBatch === "function") {
      try {
        tvInputDevice.registerKeyBatch(mediaKeys);
        return;
      } catch (_) {
        // Fall through to per-key registration.
      }
    }

    mediaKeys.forEach((keyName) => {
      try {
        tvInputDevice.registerKey?.(keyName);
      } catch (_) {
        // Ignore missing media-key support on older firmware.
      }
    });
  },

  exitApp() {
    try {
      globalThis.tizen?.application?.getCurrentApplication?.().exit?.();
    } catch (_) {
      try {
        globalThis.close?.();
      } catch (_) {
        // Ignore unsupported app-exit APIs in non-TV browsers.
      }
    }
  },

  isBackEvent(event) {
    return isBackEvent(event, [10009, 27, 8]);
  },

  normalizeKey(event) {
    return normalizeKeyEvent(event, [10009, 27, 8]);
  },

  getDeviceLabel() {
    return "Tizen TV";
  },

  getCapabilities() {
    return {
      hlsJs: Boolean(globalThis.Hls?.isSupported?.()),
      dashJs: Boolean(globalThis.dashjs?.MediaPlayer),
      nativeVideo: true,
      webosAvplay: false,
      tizenAvplay: Boolean(getAvplayApi())
    };
  },

  prepareVideoElement(videoElement) {
    if (!getAvplayApi()) {
      return;
    }
    ensureAvplayHost(videoElement);
  }
};
