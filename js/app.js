/* Sophrosyne — 启动入口 */
(function () {
  const APP_VERSION = "0.4.0";
  window.Sophrosyne.APP_VERSION = APP_VERSION;

  function boot() {
    const fresh = !localStorage.getItem(Sophrosyne.Store.KEY);
    const state = Sophrosyne.Engine.init();
    Sophrosyne.UI.init(state, { firstRun: fresh });
    const v = document.getElementById("app-version");
    if (v) v.textContent = "版本 " + APP_VERSION;
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    const proto = location.protocol;
    const host = location.hostname;
    if (proto === "https:" || host === "localhost" || host === "127.0.0.1") {
      navigator.serviceWorker.register("sw.js").catch(e => console.warn("SW register failed", e));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { boot(); registerSW(); });
  } else {
    boot(); registerSW();
  }
})();
