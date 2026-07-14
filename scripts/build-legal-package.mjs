#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { buildPackage, loadCorpus, verifyFoundation } from './legal-corpus-lib.mjs';

const output = 'public/legal/foundation-v1.json';
const tmp = `${output}.tmp`;

try {
  const norms = await loadCorpus();
  if(!norms.length) throw new Error('CORPUS OFICIAL AUSENTE');
  const pkg = buildPackage(norms);
  verifyFoundation(pkg);
  await fs.mkdir(dirname(output), { recursive:true });
  await fs.writeFile(tmp, `${JSON.stringify(pkg, null, 2)}\n`);
  await fs.rename(tmp, output);
  console.log(`Generated ${output} (${pkg.hash}) with ${pkg.norms.length} norms.`);
} catch (error) {
  await fs.rm(tmp, { force:true }).catch(()=>{});
  console.error(error?.message || error);
  process.exitCode = 1;
}
