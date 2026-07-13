#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { buildPackage, loadCorpus, verifyFoundation } from './legal-corpus-lib.mjs';

const norms = await loadCorpus();
const built = buildPackage(norms, '1970-01-01T00:00:00.000Z');
verifyFoundation(built);
const generated = await fs.readFile('public/legal/foundation-v1.json','utf8').then(JSON.parse).catch(()=>null);
if(!generated) throw new Error('public/legal/foundation-v1.json missing; run build-legal-package.mjs after importing official corpus');
verifyFoundation(generated);
console.log(`Legal corpus verified: ${generated.norms.length} norms, hash ${generated.hash}`);
