(function defineNuvioEnv() {
  var root = typeof globalThis !== "undefined" ? globalThis : window;
  root.__NUVIO_ENV__ = Object.assign({}, root.__NUVIO_ENV__ || {}, {
    SUPABASE_URL: "https://dpyhjjcoabcglfmgecug.supabase.co/",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweWhqamNvYWJjZ2xmbWdlY3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODYyNDcsImV4cCI6MjA4NjM2MjI0N30.U-3QSNDdpsnvRk_7ZL419AFTOtggHJJcmkodxeXjbkg",
    TV_LOGIN_REDIRECT_BASE_URL: "https://nuvioapp.space/tv-login",
    PUBLIC_APP_URL: "http://127.0.0.1:8080",
    YOUTUBE_PROXY_URL: "youtube-proxy.html",
    PARENTAL_GUIDE_API_URL: "https://parental.nuvioapp.space/",
    INTRODB_API_URL: "https://api.introdb.app/",
    IMDB_RATINGS_API_BASE_URL: "https://seriesgraph.com/",
    AVATAR_PUBLIC_BASE_URL: "https://dpyhjjcoabcglfmgecug.supabase.co/storage/v1/object/public/avatars",
    ADDON_REMOTE_BASE_URL: "",
    ENABLE_REMOTE_WRAPPER_MODE: false,
    PREFERRED_PLAYBACK_ORDER: ["native-file", "platform-avplay", "native-hls", "hls.js", "dash.js"],
    TMDB_API_KEY: "439c478a771f35c05022f9feabcca01c"
  });
}());

;(function applyTizenPlaybackDefaults() {
  var root = typeof globalThis !== "undefined" ? globalThis : window;
  var env = root.__NUVIO_ENV__ || {};
  env.PREFERRED_PLAYBACK_ORDER = ["platform-avplay", "native-file", "native-hls", "hls.js", "dash.js"];
  root.__NUVIO_ENV__ = env;
}());
;(function finishTizenEnvBootstrap() {
  var root = typeof globalThis !== "undefined" ? globalThis : window;
  if (typeof root.__NUVIO_TIZEN_BOOTSTRAP_APP__ === "function") {
    root.__NUVIO_TIZEN_BOOTSTRAP_APP__();
  }
}());
