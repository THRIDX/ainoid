// 生成可部署的发布包（纯静态文件，不需要服务器端程序）：
//   dist/web/            静态网站目录：上传到任意静态托管（Netlify、Cloudflare Pages、GitHub Pages、腾讯云、阿里云 OSS、itch.io……）
//   dist/ainoid-web.zip  web 目录的压缩包：Netlify Drop / Cloudflare Pages / itch.io 直接上传
//   dist/ainoid.html     单文件版：样式与脚本全部内联，发给朋友用浏览器打开即可离线游玩
// 用法: node tools/build-dist.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const WEB = path.join(DIST, 'web');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const files = ['index.html', ...styles, ...scripts, 'tools/src/world-atlas-LICENSE.txt'];

// ---------- 1. 静态网站目录 ----------
fs.rmSync(DIST, { recursive: true, force: true });
for (const f of files) {
  const dst = path.join(WEB, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), dst);
}

// ---------- 2. 单文件版 ----------
let single = html;
for (const f of styles) {
  const css = fs.readFileSync(path.join(ROOT, f), 'utf8');
  single = single.replace(`<link rel="stylesheet" href="${f}">`, () => `<style>\n${css}\n</style>`);
}
for (const f of scripts) {
  const js = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script/gi, '<\\/script');
  single = single.replace(`<script src="${f}"></script>`, () => `<script>\n${js}\n</script>`);
}
fs.writeFileSync(path.join(DIST, 'ainoid.html'), single);

// ---------- 3. 压缩包（标准 ZIP，deflate 压缩） ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
fs.writeFileSync(path.join(DIST, 'ainoid-web.zip'), zip(files.map((f) => ({ name: f, data: fs.readFileSync(path.join(ROOT, f)) }))));

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + ' KB';
console.log('dist/web/            ' + files.length + ' 个文件');
console.log('dist/ainoid-web.zip  ' + kb(path.join(DIST, 'ainoid-web.zip')));
console.log('dist/ainoid.html     ' + kb(path.join(DIST, 'ainoid.html')));
