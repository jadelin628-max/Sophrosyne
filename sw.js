/* Sophrosyne — Service Worker（离线缓存）
 * 发版时务必递增 CACHE 版本号，否则 cache-first 会让老用户永远拿到旧文件。
 */
const CACHE = "sophrosyne-v50";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./js/metrics.js",
  "./js/scenes.js",
  "./js/migrate.js",
  "./js/store.js",
  "./js/score.js",
  "./js/engine.js",
  "./js/llm.js",
  "./js/events.js",
  "./js/ui.js",
  "./js/app.js",
  "./assets/generated/palace_plan.webp",
  "./assets/generated/base_texture.webp",
  "./assets/generated/interior_junjichu.webp",
  "./assets/generated/interior_qianqinggong.webp",
  "./assets/generated/interior_taihedian.webp",
  "./assets/generated/interior_taimiao.webp",
  "./assets/generated/interior_wenyuange.webp",
  "./assets/generated/interior_yangxindian.webp",
  "./assets/generated/interior_yuhuayuan.webp",
  "./assets/generated/interior_baohe.webp",
  "./assets/generated/interior_changyinge.webp",
  "./assets/generated/interior_cininggong.webp",
  "./assets/generated/interior_jiaotaidian.webp",
  "./assets/generated/interior_kunninggong.webp",
  "./assets/generated/interior_neiweufu.webp",
  "./assets/generated/interior_ningshougong.webp",
  "./assets/generated/interior_qintianjian.webp",
  "./assets/generated/interior_shangshufang.webp",
  "./assets/generated/interior_shenwumen.webp",
  "./assets/generated/interior_taihemen.webp",
  "./assets/generated/interior_wenhuadian.webp",
  "./assets/generated/interior_wumen.webp",
  "./assets/generated/interior_wuyingdian.webp",
  "./assets/generated/interior_yushanfang.webp",
  "./assets/generated/interior_zhonghedian.webp",
  "./assets/transparent/baohe.webp",
  "./assets/transparent/cehua_donghua.webp",
  "./assets/transparent/changyinge.webp",
  "./assets/transparent/cininggong.webp",
  "./assets/transparent/jiaotaidian.webp",
  "./assets/transparent/junjichu.webp",
  "./assets/transparent/kunninggong.webp",
  "./assets/transparent/neiweufu.webp",
  "./assets/transparent/ningshougong.webp",
  "./assets/transparent/panel_wide.webp",
  "./assets/transparent/qianqinggong.webp",
  "./assets/transparent/qianqingmen.webp",
  "./assets/transparent/qintianjian.webp",
  "./assets/transparent/shangshufang.webp",
  "./assets/transparent/shenwumen.webp",
  "./assets/transparent/taihedian.webp",
  "./assets/transparent/taihemen.webp",
  "./assets/transparent/taimiao.webp",
  "./assets/transparent/ui_jade_seal.webp",
  "./assets/transparent/wenhuadian.webp",
  "./assets/transparent/wenyuange.webp",
  "./assets/transparent/wumen.webp",
  "./assets/transparent/wuyingdian.webp",
  "./assets/transparent/yangxindian.webp",
  "./assets/transparent/yuhuayuan.webp",
  "./assets/transparent/yushanfang.webp",
  "./assets/transparent/zhonghedian.webp",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 只缓存同源请求，避免把任意跨域响应永久写入缓存
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        // 4xx/5xx 不入缓存
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        // 仅导航请求回退到离线首页，避免给图片请求错配 HTML
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
    )
  );
});
