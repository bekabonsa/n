import { Router } from "../../navigation/router.js";
import { ScreenUtils } from "../../navigation/screen.js";
import { AuthManager } from "../../../core/auth/authManager.js";
import { LocalStore } from "../../../core/storage/localStore.js";
import { getMissingAuthConfigFields, hasAuthConfig } from "../../../core/auth/authConfig.js";
import { I18n } from "../../../i18n/index.js";

const GUEST_QR_BYPASS_KEY = "skipAuthQrGate";

function escapeHtml(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSignInError(error) {
  const message = String(error?.detail || error?.message || error || "").trim();
  if (!message) {
    return "Sign in failed.";
  }
  const normalized = message.toLowerCase();
  if (normalized.includes("supabase auth is not configured")) {
    return "Local auth is not configured yet.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  return message;
}

export const AuthSignInScreen = {

  async mount() {
    this.container = document.getElementById("account");
    this.emailValue = this.emailValue || "";
    this.passwordValue = "";
    this.errorMessage = "";
    this.isSubmitting = false;
    this.hasBackDestination = Router.stack.length > 0;
    ScreenUtils.show(this.container);
    this.render();
  },

  render() {
    const authConfigured = hasAuthConfig();
    const missingFields = getMissingAuthConfigFields();
    const configMessage = authConfigured
      ? I18n.t(
        "auth.signIn.browserDescription",
        {},
        { fallback: "Sign in to sync your addons, profiles, watch progress, and private resources." }
      )
      : `Local auth needs ${missingFields.join(" and ")} in nuvio.env.js before account sign-in will work.`;
    const statusClass = this.errorMessage ? " error" : (authConfigured ? "" : " info");
    const statusMessage = this.errorMessage || configMessage;

    this.container.innerHTML = `
      <div class="auth-browser-shell">
        <div class="auth-browser-card">
          <div class="auth-browser-hero">
            <h2 class="auth-browser-title">${I18n.t("auth.signIn.title", {}, { fallback: "Sign In" })}</h2>
            <p class="auth-browser-subtitle">${escapeHtml(configMessage)}</p>
          </div>

          <form id="auth-browser-form" class="auth-browser-form">
            <label class="auth-browser-field">
              <span class="auth-browser-label">${I18n.t("auth.signIn.emailLabel", {}, { fallback: "Email" })}</span>
              <input
                id="auth-email-input"
                class="auth-browser-input"
                type="email"
                autocomplete="email"
                spellcheck="false"
                value="${escapeHtml(this.emailValue)}"
                ${authConfigured ? "" : "disabled"}
              />
            </label>

            <label class="auth-browser-field">
              <span class="auth-browser-label">${I18n.t("auth.signIn.passwordLabel", {}, { fallback: "Password" })}</span>
              <input
                id="auth-password-input"
                class="auth-browser-input"
                type="password"
                autocomplete="current-password"
                value="${escapeHtml(this.passwordValue)}"
                ${authConfigured ? "" : "disabled"}
              />
            </label>

            <div class="auth-browser-status${statusClass}">${escapeHtml(statusMessage)}</div>

            <div class="auth-browser-actions">
              <button type="submit" class="auth-browser-action auth-browser-action-primary focusable" data-action="submit" ${this.isSubmitting || !authConfigured ? "disabled" : ""}>
                ${this.isSubmitting
      ? I18n.t("auth.signIn.signingIn", {}, { fallback: "Signing In..." })
      : I18n.t("auth.signIn.submit", {}, { fallback: "Sign In" })}
              </button>
              <button type="button" class="auth-browser-action focusable" data-action="guest">
                ${I18n.t("auth.signIn.continueGuest", {}, { fallback: "Continue Without Account" })}
              </button>
              <button type="button" class="auth-browser-action focusable" data-action="openQr">
                ${I18n.t("auth.signIn.openQrLogin", {}, { fallback: "Use QR Sign-In" })}
              </button>
              ${this.hasBackDestination ? `
                <button type="button" class="auth-browser-action focusable" data-action="back">
                  ${I18n.t("auth.signIn.back", {}, { fallback: "Back" })}
                </button>
              ` : ""}
            </div>
          </form>
        </div>
      </div>
    `;

    this.form = this.container.querySelector("#auth-browser-form");
    this.emailInput = this.container.querySelector("#auth-email-input");
    this.passwordInput = this.container.querySelector("#auth-password-input");
    ScreenUtils.indexFocusables(this.container);
    ScreenUtils.setInitialFocus(this.container);
    this.attachActions();
  },

  attachActions() {
    if (this.form) {
      this.form.onsubmit = (event) => {
        event.preventDefault();
        void this.handleSubmit();
      };
    }
    if (this.emailInput) {
      this.emailInput.oninput = () => {
        this.emailValue = this.emailInput.value;
      };
    }
    if (this.passwordInput) {
      this.passwordInput.oninput = () => {
        this.passwordValue = this.passwordInput.value;
      };
    }
    const actionNodes = Array.from(this.container?.querySelectorAll("[data-action]") || []);
    actionNodes.forEach((node) => {
      node.onclick = () => {
        void this.handleAction(node.dataset.action || "");
      };
    });
  },

  async handleSubmit() {
    if (this.isSubmitting) {
      return;
    }

    this.emailValue = String(this.emailInput?.value || this.emailValue || "").trim();
    this.passwordValue = String(this.passwordInput?.value || this.passwordValue || "");
    if (!hasAuthConfig()) {
      this.errorMessage = "Local auth is not configured yet.";
      this.render();
      return;
    }
    if (!this.emailValue || !this.passwordValue) {
      this.errorMessage = "Enter both email and password.";
      this.render();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = "";
    this.render();

    try {
      await AuthManager.signInWithEmail(this.emailValue, this.passwordValue);
      LocalStore.remove(GUEST_QR_BYPASS_KEY);
      LocalStore.set("hasSeenAuthQrOnFirstLaunch", true);
      Router.navigate("profileSelection");
    } catch (error) {
      this.errorMessage = formatSignInError(error);
      this.isSubmitting = false;
      this.render();
      return;
    }

    this.isSubmitting = false;
  },

  async handleAction(action) {
    if (action === "submit") {
      await this.handleSubmit();
      return;
    }
    if (action === "openQr") {
      Router.navigate("authQrSignIn");
      return;
    }
    if (action === "guest") {
      LocalStore.set("hasSeenAuthQrOnFirstLaunch", true);
      LocalStore.set(GUEST_QR_BYPASS_KEY, true);
      Router.navigate("home", {}, {
        replaceHistory: true,
        skipStackPush: true
      });
      return;
    }
    if (action === "back") {
      if (this.hasBackDestination) {
        Router.back();
        return;
      }
      LocalStore.set("hasSeenAuthQrOnFirstLaunch", true);
      LocalStore.set(GUEST_QR_BYPASS_KEY, true);
      Router.navigate("home", {}, {
        replaceHistory: true,
        skipStackPush: true
      });
    }
  },

  async onKeyDown(event) {
    if (ScreenUtils.handleDpadNavigation(event, this.container)) {
      return;
    }
    if (event.keyCode !== 13) {
      return;
    }

    const current = this.container.querySelector(".focusable.focused");
    if (!current) {
      return;
    }
    await this.handleAction(current.dataset.action || "");
  },

  cleanup() {
    if (this.form) {
      this.form.onsubmit = null;
      this.form = null;
    }
    if (this.emailInput) {
      this.emailInput.oninput = null;
      this.emailInput = null;
    }
    if (this.passwordInput) {
      this.passwordInput.oninput = null;
      this.passwordInput = null;
    }
    const actionNodes = Array.from(this.container?.querySelectorAll("[data-action]") || []);
    actionNodes.forEach((node) => {
      node.onclick = null;
    });
    ScreenUtils.hide(this.container);
  }

};
