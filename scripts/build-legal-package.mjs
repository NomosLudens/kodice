#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { buildPackage, loadCorpus, verifyFoundation } from './legal-corpus-lib.mjs';

const output = 'public/legal/foundation-v1.json';
const norms = await loadCorpus();
const pkg = buildPackage(norms);
verifyFoundation(pkg);
await fs.mkdir(dirname(output), { recursive:true });
await fs.writeFile(output, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Generated ${output} (${pkg.hash}) with ${pkg.norms.length} norms.`);
