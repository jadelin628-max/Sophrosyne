/* Sophrosyne — PWA / 版本一致性测试（0.5.0）
 * 校验：manifest 版本 == app.js APP_VERSION；index.html 引用的每个脚本/样式都进入 SW 缓存清单；
 * SW 缓存键格式正确；缓存清单中的文件在磁盘上存在。防止发版时漏 bump 或漏挂资源。
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }
let failed = 0;
function assert(c, m) { if (c) { console.log("  ok -", m); } else { console.error("  FAIL -", m); failed++; } }

console.log("[1] 版本三要素一致（manifest / app.js / 存储键）");
const manifest = JSON.parse(read("manifest.json"));
const app = read("js/app.js");
const appVer = (app.match(/const APP_VERSION = "([^"]+)"/) || [])[1];
assert(manifest.version === appVer, "manifest.version === app.APP_VERSION（" + manifest.version + "）");

console.log("[2] SW 缓存键格式与存储键");
const sw = read("sw.js");
const cache = (sw.match(/const CACHE = "([^"]+)"/) || [])[1];
assert(/^sophrosyne-v\d+$/.test(cache || ""), "SW 缓存键为 sophrosyne-v<N>（" + cache + "）");
const store = read("js/store.js");
const storeKey = (store.match(/const KEY = "([^"]+)"/) || [])[1];
assert(/^sophrosyne\.v\d+$/.test(storeKey || ""), "存储键为 sophrosyne.v<N>（" + storeKey + "）");

console.log("[3] index.html 引用的脚本/样式全部进入 SW 缓存清单");
const html = read("index.html");
const scripts = (html.match(/<script src="([^"]+)"><\/script>/g) || []).map(s => (s.match(/src="([^"]+)"/) || [])[1]);
const stylesHref = (html.match(/<link rel="stylesheet" href="([^"]+)"/g) || []).map(s => (s.match(/href="([^"]+)"/) || [])[1]);
const assets = (sw.match(/const ASSETS = \[([\s\S]*?)\];/) || [])[1].match(/"\.\/[^"]+"/g).map(s => s.slice(3, -1));
for (const src of scripts.concat(stylesHref)) {
  assert(assets.includes(src), src + " 在 SW ASSETS 中");
}

console.log("[4] SW 缓存清单中的文件均存在");
for (const a of assets) {
  assert(fs.existsSync(path.join(ROOT, a)), a + " 文件存在");
}

if (failed) { console.error("PWA FAIL — " + failed + " 项未过"); process.exit(1); }
console.log("PWA OK — 版本/缓存清单/资源完整性通过");
