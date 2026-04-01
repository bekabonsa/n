import "./runtime/polyfills.js";
import { Router } from "./ui/navigation/router.js";
import { FocusEngine } from "./ui/navigation/focusEngine.js";
import { PlayerController } from "./core/player/playerController.js";
import { AuthManager } from "./core/auth/authManager.js";
import { AuthState } from "./core/auth/authState.js";
import { StartupSyncService } from "./core/profile/startupSyncService.js";
import { ThemeManager } from "./ui/theme/themeManager.js";
import { renderAppShell } from "./bootstrap/renderAppShell.js";
import { renderAddonRemotePage } from "./bootstrap/renderAddonRemotePage.js";
import { warmStreamingLibs } from "./runtime/loadStreamingLibs.js";
import { Platform } from "./platform/index.js";
import { LocalStore } from "./core/storage/localStore.js";
import { I18n } from "./i18n/index.js";
import { getPrimarySignInRoute, getSignedOutLandingRoute } from "./core/auth/authNavigation.js";

const GUEST_QR_BYPASS_KEY = "skipAuthQrGate";

function setBootDebugStatus(message) {
  try {
    globalThis.__NUVIO_BOOT_DEBUG__?.setStatus?.(message);
  } catch (_) {}
}

function failBootDebugStatus(message) {
  try {
    globalThis.__NUVIO_BOOT_DEBUG__?.fail?.(message);
  } catch (_) {}
}

function finishBootDebugStatus(message) {
  try {
    globalThis.__NUVIO_BOOT_DEBUG__?.done?.(message);
  } catch (_) {}
}

function formatErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error?.stack || error?.message || error);
}

function renderFatalError(error) {
  const message = formatErrorMessage(error);
  failBootDebugStatus(`Fatal startup error: ${message}`);
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0f1115;color:#f4f7fb;padding:48px;font-family:Arial,sans-serif;">
      <div style="max-width:960px;margin:0 auto;">
        <h1 style="margin:0 0 16px;font-size:42px;">Nuvio TV failed to start</h1>
        <p style="margin:0 0 20px;font-size:20px;color:#c7d0dd;">Startup hit an error before the app UI rendered.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#171b22;border:1px solid #2b3340;border-radius:12px;padding:20px;font-size:18px;line-height:1.5;">${message}</pre>
      </div>
    </div>
  `;
}

function isLowEndDevice() {
  const hardware = Number(globalThis.navigator?.hardwareConcurrency || 0);
  const memory = Number(globalThis.navigator?.deviceMemory || 0);
  const lowCpu = Number.isFinite(hardware) && hardware > 0 && hardware <= 4;
  const lowMem = Number.isFinite(memory) && memory > 0 && memory <= 2;
  return lowCpu || lowMem;
}

function applyPerformanceMode() {
  const constrained = Platform.isWebOS() || Platform.isTizen() || isLowEndDevice();
  document.documentElement.classList.toggle("performance-constrained", constrained);
  document.body.classList.toggle("performance-constrained", constrained);
}

function isAddonRemoteMode() {
  try {
    return new URLSearchParams(window.location.search).get("addonsRemote") === "1";
  } catch {
    return false;
  }
}

async function bootstrapApp() {
  setBootDebugStatus("Rendering app shell...");
  renderAppShell();
  setBootDebugStatus("Initializing platform...");
  Platform.init();
  setBootDebugStatus(`Platform ready: ${Platform.getName()}. Applying performance mode...`);
  applyPerformanceMode();
  setBootDebugStatus("Loading translations...");
  await I18n.init();

  setBootDebugStatus("Initializing router...");
  Router.init();
  setBootDebugStatus("Initializing player controller...");
  PlayerController.init();
  setBootDebugStatus("Initializing focus engine...");
  FocusEngine.init();
  setBootDebugStatus("Applying theme...");
  ThemeManager.apply();
  setBootDebugStatus("Applying translations...");
  I18n.apply();
  setBootDebugStatus("Warming playback libraries...");
  warmStreamingLibs({ delayMs: 1400 });

  AuthManager.subscribe((state) => {
    if (state === AuthState.LOADING) {
      setBootDebugStatus("Auth bootstrap running...");
      StartupSyncService.stop();
      return;
    }

    if (state === AuthState.SIGNED_OUT) {
      setBootDebugStatus("Auth state: signed out.");
      StartupSyncService.stop();
      const shouldBypassQr = Boolean(LocalStore.get(GUEST_QR_BYPASS_KEY, false));
      const landingRoute = shouldBypassQr ? "home" : getSignedOutLandingRoute();
      if (landingRoute === "home") {
        if (Router.getCurrent() !== "home") {
          Router.navigate("home", {}, {
            replaceHistory: true,
            skipStackPush: true
          });
        }
        finishBootDebugStatus("Startup finished on home.");
        return;
      }
      const hasSeenQr = LocalStore.get("hasSeenAuthQrOnFirstLaunch");
      Router.navigate(getPrimarySignInRoute(), {
        onboardingMode: !hasSeenQr
      });
      finishBootDebugStatus(`Startup finished on ${getPrimarySignInRoute()}.`);
    }

    if (state === AuthState.AUTHENTICATED) {
      setBootDebugStatus("Auth state: authenticated.");
      LocalStore.remove(GUEST_QR_BYPASS_KEY);
      StartupSyncService.start();
      Router.navigate("profileSelection");
      finishBootDebugStatus("Startup finished on profile selection.");
    }
  });

  setBootDebugStatus("Bootstrapping auth...");
  await AuthManager.bootstrap();
  setBootDebugStatus("Auth bootstrap completed.");
}

async function bootstrapAddonRemoteMode() {
  setBootDebugStatus("Rendering addon remote mode...");
  await renderAddonRemotePage();
  finishBootDebugStatus("Addon remote mode ready.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const bootstrap = isAddonRemoteMode() ? bootstrapAddonRemoteMode : bootstrapApp;
    bootstrap().catch((error) => {
      console.error("App bootstrap failed", error);
      renderFatalError(error);
    });
  }, { once: true });
} else {
  const bootstrap = isAddonRemoteMode() ? bootstrapAddonRemoteMode : bootstrapApp;
  bootstrap().catch((error) => {
    console.error("App bootstrap failed", error);
    renderFatalError(error);
  });
}

window.addEventListener("error", (event) => {
  if (!event?.error) {
    return;
  }
  renderFatalError(event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  renderFatalError(event?.reason);
});
