import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 组装 src/ui/layout.html → dist/ui.html
 *
 * 源码按 Tab 拆分为多文件（css/ pages/ scripts/），通过 include 标记引用：
 *   HTML 片段用 「<!-- @include: pages/suites.html -->」
 *   CSS/JS 片段用块注释形式的 @include 标记（如 css/base.css 的引用）
 * include 路径相对 src/ui/ 解析，支持递归嵌套。
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const uiDir = resolve(__dirname, '..', 'src', 'ui');
const distDir = resolve(__dirname, '..', 'dist');
const dest = resolve(distDir, 'ui.html');

const RE_HTML = /<!--\s*@include:\s*(.+?)\s*-->/g;
const RE_CODE = /\/\*\s*@include:\s*(.+?)\s*\*\//g;
const MAX_DEPTH = 16;

function inline(text, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error(`@include 嵌套超过 ${MAX_DEPTH} 层`);
  return text.replace(RE_HTML, (_, rel) => inline(readInc(rel), depth + 1))
             .replace(RE_CODE, (_, rel) => inline(readInc(rel), depth + 1));
}

function readInc(rel) {
  const p = resolve(uiDir, rel);
  try {
    return readFileSync(p, 'utf8');
  } catch {
    throw new Error(`[build-ui] @include 目标不存在: ${rel}（解析为 ${p}）`);
  }
}

const out = inline(readFileSync(resolve(uiDir, 'layout.html'), 'utf8'));
mkdirSync(distDir, { recursive: true });
writeFileSync(dest, out, 'utf8');

const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log(`[build-ui] dist/ui.html assembled (${kb} KB)`);
