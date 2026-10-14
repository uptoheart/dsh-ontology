import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src', 'ui.html');
const distDir = resolve(__dirname, '..', 'dist');
const dest = resolve(distDir, 'ui.html');

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
copyFileSync(src, dest);
console.log('[copy-ui] dist/ui.html synced');