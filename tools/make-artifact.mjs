// 由 index.html 生成可发布为 claude.ai Artifact 的页面（去掉 doctype/html/head/body 外壳，保留标题、样式、内容与脚本）
// 用法: node tools/make-artifact.mjs <输出文件路径>
// 同时打印需要一并发布的资源文件列表（JSON）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('需要输出路径'); process.exit(1); }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const scripts = [...body.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const content = body.replace(/<noscript>[\s\S]*?<\/noscript>/, '').replace(/<script src="[^"]+"><\/script>\s*/g, '').trim();

const page = [
  title,
  ...styles.map((s) => `<link rel="stylesheet" href="${s}">`),
  content,
  ...scripts.map((s) => `<script src="${s}"></script>`),
  '',
].join('\n');
fs.writeFileSync(out, page);
const files = Object.fromEntries([...styles, ...scripts].map((f) => [f, f]));
console.log(JSON.stringify(files, null, 1));
