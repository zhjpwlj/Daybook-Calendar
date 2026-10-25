import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

const themeDir = new URL('../src/styles/themes/', import.meta.url).pathname;
const files = readdirSync(themeDir)
  .filter((file) => file.endsWith('.css'))
  .sort();

if (files.length === 0) {
  console.error('lint-themes: no theme files found');
  process.exit(1);
}

const tokensByFile = new Map();
const errors = [];

for (const file of files) {
  const path = join(themeDir, file);
  const root = postcss.parse(readFileSync(path, 'utf8'), { from: path });
  const tokens = new Set();

  root.walkDecls((decl) => {
    if (!decl.prop.startsWith('--')) {
      errors.push(`${file}:${decl.source.start.line} non-token property "${decl.prop}"`);
    }
    if (decl.important) {
      errors.push(`${file}:${decl.source.start.line} !important is banned in themes`);
    }
    if (decl.prop.startsWith('--')) tokens.add(decl.prop);
  });

  tokensByFile.set(file, tokens);
}

const [referenceFile, ...rest] = files;
const reference = tokensByFile.get(referenceFile);

for (const file of rest) {
  const tokens = tokensByFile.get(file);
  for (const token of reference) {
    if (!tokens.has(token)) errors.push(`${file}: missing token ${token}`);
  }
  for (const token of tokens) {
    if (!reference.has(token)) errors.push(`${file}: token ${token} not in ${referenceFile}`);
  }
}

if (errors.length > 0) {
  console.error('lint-themes failed:\n' + errors.map((line) => `  ${line}`).join('\n'));
  process.exit(1);
}

console.log(`lint-themes: ${files.length} themes, ${reference.size} tokens each`);
