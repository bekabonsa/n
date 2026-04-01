(function openHostedNuvioTvBuild() {
  var hostedAppUrl = "https://rawcdn.githack.com/bekabonsa/n/d29eb67/site/index.html";
  var launcherBuildMatch = hostedAppUrl.match(/\/([0-9a-f]{7,40})\/site\/index\.html$/i);
  var launcherBuild = launcherBuildMatch ? launcherBuildMatch[1] : "unknown";
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
