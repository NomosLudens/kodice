#!/usr/bin/env node
// Copia /functions/ para /dist/functions/ após o vite build.
// Cloudflare Pages Functions ficam em dist/functions/ no output.

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('functions');
const DEST = path.resolve('dist/functions');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  for (const entry of fs.readdirSync(p)) {
    const full = path.join(p, entry);
    if (fs.statSync(full).isDirectory()) rmrf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(p);
}

if (!fs.existsSync(SRC)) {
  console.log('build-functions: nenhuma pasta /functions, nada a fazer.');
  process.exit(0);
}

rmrf(DEST);
copyDir(SRC, DEST);
console.log(`build-functions: copiado ${SRC} → ${DEST}`);

function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const entry of fs.readdirSync(s, { withFileTypes: true })) {
    const sFull = path.join(s, entry.name);
    const dFull = path.join(d, entry.name);
    if (entry.isDirectory()) copyDir(sFull, dFull);
    else fs.copyFileSync(sFull, dFull);
  }
}
