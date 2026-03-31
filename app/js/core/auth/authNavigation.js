import { Platform } from "../../platform/index.js";

export function getPrimarySignInRoute() {
  return Platform.isBrowser() ? "authSignIn" : "authQrSignIn";
}

export function getSignedOutLandingRoute() {
  return Platform.isBrowser() ? "authSignIn" : "authQrSignIn";
}
