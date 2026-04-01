(function openHostedNuvioTvBuild() {
  var hostedSiteRevision = "cd23fa8";
  var hostedAppUrl = "https://rawcdn.githack.com/bekabonsa/n/" + hostedSiteRevision + "/site/index.html";
  var hostedBuildInfoUrl = "https://rawcdn.githack.com/bekabonsa/n/" + hostedSiteRevision + "/site/build-info.json";
  var launcherBuild = hostedSiteRevision;
  var tvInput = window.tizen && window.tizen.tvinputdevice;
  var buildNode = document.getElementById("launcher-build");

  function updateBuildLabel(nextLabel) {
    if (!nextLabel) {
      return;
    }
    launcherBuild = nextLabel;
    if (buildNode) {
      buildNode.textContent = "launcher " + launcherBuild;
    }
  }

  updateBuildLabel(launcherBuild);

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

  function resolveHostedBuildLabel() {
    return fetch(hostedBuildInfoUrl + "?_cb=" + encodeURIComponent(String(Date.now())))
      .then(function onResponse(response) {
        if (!response.ok) {
          throw new Error("Failed to load build info");
        }
        return response.json();
      })
      .then(function onJson(payload) {
        var builtAt = payload && payload.builtAt ? String(payload.builtAt).trim() : "";
        if (builtAt) {
          updateBuildLabel(builtAt);
        }
      })
      .catch(function onError() {
        updateBuildLabel(hostedSiteRevision + "-build-info-unavailable");
      });
  }

  if (tvInput && typeof tvInput.registerKey === "function") {
    ["MediaPlay", "MediaPause", "MediaPlayPause", "MediaFastForward", "MediaRewind"].forEach(function registerKey(keyName) {
      try {
        tvInput.registerKey(keyName);
      } catch (_) {}
    });
  }

  resolveHostedBuildLabel().then(function finalizeLauncher() {
    setTimeout(function redirectToHostedBuild() {
      window.location.replace(buildFreshHostedUrl());
    }, 700);
  }, function finalizeLauncher() {
    setTimeout(function redirectToHostedBuild() {
      window.location.replace(buildFreshHostedUrl());
    }, 700);
  });
}());
