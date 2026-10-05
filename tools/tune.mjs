// 平衡调参：一次跑三种水平的机器人，输出紧凑对比
// 用法: node tools/tune.mjs [每组局数=10]
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const N = process.argv[2] || '10';
const extra = process.argv.slice(3); // 例如 --cfg=expRise=0.03:0.08 或 --mobile
for (const skill of ['good', 'avg', 'poor']) {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'sim.mjs'), N, skill, 'normal', 'both', ...extra], { encoding: 'utf8' });
  const tail = out.slice(out.lastIndexOf('====')).split('\n').filter(Boolean);
  console.log(tail.join('\n'));
  console.log('');
}
