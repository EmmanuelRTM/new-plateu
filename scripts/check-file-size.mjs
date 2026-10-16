// Enforces the ≤500 lines-per-file engineering rule for source and test files.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const MAX_LINES = 500;
const ROOTS = ['src', 'tests', 'e2e', 'scripts'];
const EXTENSIONS = new Set(['.js', '.mjs', '.css']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('._')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  let files = [];
  try { files = walk(root); } catch { continue; }
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    if (lines > MAX_LINES) offenders.push(`${file}: ${lines} lines`);
  }
}

if (offenders.length) {
  console.error(`Files over ${MAX_LINES} lines:\n` + offenders.join('\n'));
  process.exit(1);
}
console.log(`OK: all files are ≤ ${MAX_LINES} lines.`);
