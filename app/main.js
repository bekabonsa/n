window.__NUVIO_PLATFORM__ = "tizen";

var bootStatusNode = document.getElementById("nuvio-tizen-boot-status");
var buildLabelNode = document.getElementById("nuvio-tizen-build-label");
var debugDetailNode = document.getElementById("nuvio-tizen-debug-detail");
var bootOverlayDismissed = false;
var buildLabel = "2026-04-01T22:24:50.361Z";

if (buildLabelNode) {
  buildLabelNode.textContent = buildLabel || "packaged-build";
}

window.__NUVIO_BOOT_DEBUG__ = {
  enabled: true,
  setStatus: function setBootStatus(message) {
    setBootStatus(message, false);
  },
  fail: function failBootStatus(message) {
    setBootStatus(message, true);
  },
  done: function finishBootStatus(message) {
    setBootStatus(message || "App shell ready.", false);
  },
  setDetail: function setDetail(message) {
    if (!debugDetailNode) {
      return;
    }
    debugDetailNode.textContent = String(message || "");
  },
  failDetail: function failDetail(message) {
    if (!debugDetailNode) {
      return;
    }
    debugDetailNode.textContent = String(message || "");
    debugDetailNode.style.color = "rgba(255, 220, 220, 0.98)";
  },
  clearDetail: function clearDetail() {
    if (!debugDetailNode) {
      return;
    }
    debugDetailNode.textContent = "";
    debugDetailNode.style.color = "rgba(245, 249, 255, 0.98)";
  }
};

function setBootStatus(message, isError) {
  if (!bootStatusNode || bootOverlayDismissed) {
    return;
  }
  bootStatusNode.textContent = message;
  bootStatusNode.setAttribute("data-state", isError ? "error" : "info");
}

function dismissBootStatusWhenReady() {
  if (bootOverlayDismissed) {
    return;
  }
  if (!document.getElementById("app")) {
    setTimeout(dismissBootStatusWhenReady, 500);
    return;
  }
  bootOverlayDismissed = true;
  if (buildLabelNode && buildLabelNode.parentNode) {
    buildLabelNode.parentNode.removeChild(buildLabelNode);
  }
  if (bootStatusNode && bootStatusNode.parentNode && !String(debugDetailNode && debugDetailNode.textContent || "").trim()) {
    bootStatusNode.parentNode.removeChild(bootStatusNode);
  }
}

window.addEventListener("error", function onError(event) {
  var message = event && event.message ? event.message : "Unknown boot error";
  setBootStatus("Boot error: " + message, true);
});

window.addEventListener("unhandledrejection", function onUnhandledRejection(event) {
  var reason = event && event.reason;
  var message = reason && reason.message ? reason.message : String(reason || "Unknown promise rejection");
  setBootStatus("Boot rejection: " + message, true);
});

var tvInput = window.tizen && window.tizen.tvinputdevice;
if (tvInput && typeof tvInput.registerKey === "function") {
  ["MediaPlay", "MediaPause", "MediaPlayPause", "MediaFastForward", "MediaRewind"].forEach(function registerKey(keyName) {
    try {
      tvInput.registerKey(keyName);
    } catch (_) {}
  });
}

function loadScript(src, label, onLoad) {
  setBootStatus("Loading " + label + "...");
  var script = document.createElement("script");
  script.src = src;
  script.async = false;
  script.defer = false;
  script.onload = function handleLoad() {
    setBootStatus("Loaded " + label + ".");
    if (typeof onLoad === "function") {
      onLoad();
    }
  };
  script.onerror = function handleError() {
    setBootStatus("Failed to load " + label + ".", true);
  };
  document.body.appendChild(script);
}

window.__NUVIO_TIZEN_BOOTSTRAP_APP__ = function bootstrapApp() {
  if (window.__NUVIO_TIZEN_APP_BOOTSTRAPPED__) {
    return;
  }

  window.__NUVIO_TIZEN_APP_BOOTSTRAPPED__ = true;
  setBootStatus("Starting app bootstrap...");
  loadScript("js/runtime/polyfills.js", "polyfills", function onPolyfills() {
    loadScript("js/runtime/env.js", "runtime env", function onRuntimeEnv() {
      loadScript("assets/libs/qrcode-generator.js", "QR library", function onQrLibrary() {
        loadScript("app.bundle.js", "app bundle", function onBundle() {
          setBootStatus("App bundle loaded.");
          dismissBootStatusWhenReady();
        });
      });
    });
  });
};

loadScript("nuvio.env.js", "runtime config", function onEnvConfig() {
  setBootStatus("Runtime config loaded.");
  setTimeout(dismissBootStatusWhenReady, 4000);
});
