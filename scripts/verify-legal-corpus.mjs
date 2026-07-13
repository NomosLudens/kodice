#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { assertStablePackagesEqual, buildPackage, loadCorpus, verifyFoundation } from './legal-corpus-lib.mjs';

try {
  const norms = await loadCorpus();
  if(!norms.length) throw new Error('CORPUS OFICIAL AUSENTE');
  const built = buildPackage(norms);
  verifyFoundation(built);
  const generated = await fs.readFile('public/legal/foundation-v1.json','utf8').then(JSON.parse).catch(error=>{
    if(error?.code === 'ENOENT') throw new Error('public/legal/foundation-v1.json missing; run build-legal-package.mjs');
    if(error instanceof SyntaxError) throw new Error(`public/legal/foundation-v1.json invalid JSON: ${error.message}`);
    throw error;
  });
  verifyFoundation(generated);
  assertStablePackagesEqual(generated, built);
  console.log(`Legal corpus verified: ${generated.norms.length} norms, hash ${generated.hash}`);
} catch (error) {
  console.error(error?.message || error);
  process.exitCode = 1;
}
