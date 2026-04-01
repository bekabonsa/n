(function openHostedNuvioTvBuild() {
  var hostedAppUrl = "https://raw.githack.com/bekabonsa/n/main/site/index.html";
  var launcherBuild = "main-auto";
  var tvInput = window.tizen && window.tizen.tvinputdevice;
  var buildNode = document.getElementById("launcher-build");

  if (buildNode) {
    buildNode.textContent = "launcher " + launcherBuild;
  }

  function buildFreshHostedUrl() {
    try {
      var url = new URL(hostedAppUrl);
      url.searchParams.set("bootDebug", "1");
      url.searchParams.set("source", "tizenbrew");
      url.searchParams.set("wrapper", "tizen");
      url.searchParams.set("launcher_build", launcherBuild);
      url.searchParams.set("_cb", String(Date.now()));
      return url.toString();
    } catch (_) {
      return hostedAppUrl + "?_cb=" + encodeURIComponent(String(Date.now()));
    }
  }

  if (tvInput && typeof tvInput.registerKey === "function") {
    ["MediaPlay", "MediaPause", "MediaPlayPause", "MediaFastForward", "MediaRewind"].forEach(function registerKey(keyName) {
      try {
        tvInput.registerKey(keyName);
      } catch (_) {}
    });
  }

  setTimeout(function redirectToHostedBuild() {
    window.location.replace(buildFreshHostedUrl());
  }, 700);
}());
