// Static checks without a build step:
//  1. `node --check` on every JavaScript file;
//  2. every relative import specifier points to an existing file;
//  3. every local src/href in index.html exists.
// A broken path would otherwise only show up as a 404 on GitHub Pages.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['backend', 'frontend', 'test', 'scripts'];
const IMPORT_PATTERN = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
const HTML_REF_PATTERN = /\s(?:src|href)="([^"]+)"/g;

/** @param {string} dir @returns {string[]} */
function listJsFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listJsFiles(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

/** @param {string} file @returns {string[]} problems */
function checkSyntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  return result.status === 0 ? [] : [`${relative(ROOT, file)}: syntax error\n${result.stderr.trim()}`];
}

/** @param {string} file @returns {string[]} problems */
function checkImports(file) {
  const source = readFileSync(file, 'utf8');
  const problems = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier);
    if (!existsSync(target)) problems.push(`${relative(ROOT, file)}: missing import "${specifier}"`);
  }
  return problems;
}

/** @returns {string[]} problems */
function checkHtml() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const problems = [];
  for (const [, ref] of html.matchAll(HTML_REF_PATTERN)) {
    if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
    if (!existsSync(join(ROOT, ref.split(/[?#]/)[0]))) problems.push(`index.html: missing file "${ref}"`);
  }
  return problems;
}

const files = SOURCE_DIRS.flatMap((dir) => listJsFiles(join(ROOT, dir)));
const problems = [...files.flatMap(checkSyntax), ...files.flatMap(checkImports), ...checkHtml()];

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s) found.`);
  process.exit(1);
}
console.log(`OK: ${files.length} JavaScript files parsed, imports and index.html references resolved.`);
