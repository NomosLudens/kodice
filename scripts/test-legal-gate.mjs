#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertStablePackagesEqual,
  buildPackage,
  loadCorpus,
  sha256,
  sha256Bytes,
  stablePackageContent,
  stableStringify,
  validateNorm,
  verifyFoundation
} from './legal-corpus-lib.mjs';

class SkipError extends Error {}
function skip(msg){ throw new SkipError(msg); }
function assert(cond, msg){ if(!cond) throw new Error(msg); }
async function tempRoot(){ return fs.mkdtemp(path.join(os.tmpdir(), 'codice-legal-gate-')); }
function unit(normId, id, kind, canonicalPath, sortOrder, extra={}){
  return { id:`${normId}-${id}`, parentId:null, kind, label:id, canonicalPath, heading:null, text:`neutral ${id}`, sortOrder, status:'vigente', ...extra };
}
function norm(id, units, sourceHash, sourceFile){
  return {
    id,
    urn:`urn:lex:br:federal:${id}`,
    type:id === 'cf88' ? 'constituicao' : 'lei',
    number:id === 'cpc2015' ? '13105' : null,
    year:id === 'cf88' ? 1988 : 2015,
    title:`Neutral ${id}`,
    popularName:`Neutral ${id}`,
    aliases:[id],
    ementa:'neutral ementa',
    status:'vigente',
    publicationDate:'2020-01-01',
    versionDate:'2020-01-02',
    officialSourceUrl:'https://www.planalto.gov.br/neutral',
    sourceFile,
    sourceHash,
    lastVerifiedAt:'2020-01-03T00:00:00.000Z',
    acquisition:{
      normId:id,
      sourceFile,
      sourceHash,
      unitCount:units.length,
      articleCount:units.filter(u=>u.kind==='artigo').length,
      firstCanonicalPath:[...units].sort((a,b)=>a.sortOrder-b.sortOrder)[0].canonicalPath,
      lastCanonicalPath:[...units].sort((a,b)=>a.sortOrder-b.sortOrder).at(-1).canonicalPath,
      verifiedAt:'2020-01-03T00:00:00.000Z',
      complete:true
    },
    units
  };
}
async function writeCorpus(root){
  const source = Buffer.from('neutral official source bytes');
  const hash = sha256Bytes(source);
  await fs.mkdir(path.join(root, 'legal/sources/sample'), { recursive:true });
  await fs.mkdir(path.join(root, 'legal/corpus'), { recursive:true });
  await fs.writeFile(path.join(root, 'legal/sources/sample/source.txt'), source);
  const cfUnits = [
    unit('cf88','preambulo','preambulo','preambulo',1),
    unit('cf88','art1','artigo','art1',2),
    unit('cf88','art5','artigo','art5',3),
    unit('cf88','art5-inc35','inciso','art5-inc35',4, { parentId:'cf88-art5' }),
    unit('cf88','adct','disposicao_transitoria','adct',5)
  ];
  const cpcUnits = [unit('cpc2015','art300','artigo','art300',1)];
  await fs.writeFile(path.join(root, 'legal/corpus/cf88.json'), JSON.stringify(norm('cf88', cfUnits, hash, 'legal/sources/sample/source.txt')));
  await fs.writeFile(path.join(root, 'legal/corpus/cpc2015.json'), JSON.stringify(norm('cpc2015', cpcUnits, hash, 'legal/sources/sample/source.txt')));
}
async function test(name, fn){
  try { await fn(); console.log(`ok - ${name}`); }
  catch (error) {
    if(error instanceof SkipError){ console.log(`skip - ${name}: ${error.message}`); return; }
    console.error(`not ok - ${name}: ${error.message}`); process.exitCode = 1;
  }
}

await test('pacote público stale é rejeitado', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const built = buildPackage(await loadCorpus('legal/corpus', { root }));
  const stale = { ...built, version:'different', hash:built.hash };
  let rejected = false;
  try { assertStablePackagesEqual(stale, built); } catch { rejected = true; }
  assert(rejected, 'stale package accepted');
});

await test('hash de arquivo de origem incorreto é rejeitado', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const cfPath = path.join(root, 'legal/corpus/cf88.json');
  const cf = JSON.parse(await fs.readFile(cfPath,'utf8'));
  cf.sourceHash = '0'.repeat(64); cf.acquisition.sourceHash = cf.sourceHash;
  await fs.writeFile(cfPath, JSON.stringify(cf));
  await loadCorpus('legal/corpus', { root }).then(()=>{ throw new Error('accepted bad sourceHash'); }, error=>assert(/sourceHash mismatch/.test(error.message), error.message));
});

await test('normIds divergentes são rejeitados com hash válido', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const pkg = buildPackage(await loadCorpus('legal/corpus', { root }));
  pkg.normIds = ['cf88'];
  pkg.hash = sha256(stableStringify(stablePackageContent(pkg)));
  let message = '';
  try { verifyFoundation(pkg); } catch (error) { message = error.message; }
  assert(/normIds must exactly match norms/.test(message), `unexpected error: ${message}`);
});

await test('norm ID duplicado é rejeitado', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const norms = await loadCorpus('legal/corpus', { root });
  const pkg = buildPackage([norms[0], norms[0]]);
  let rejected = false;
  try { verifyFoundation(pkg); } catch { rejected = true; }
  assert(rejected, 'duplicate norm accepted');
});

await test('ciclo de parent é rejeitado', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const cf = JSON.parse(await fs.readFile(path.join(root, 'legal/corpus/cf88.json'),'utf8'));
  cf.units[1].parentId = cf.units[3].id;
  cf.units[3].parentId = cf.units[1].id;
  let rejected = false;
  try { validateNorm(cf); } catch { rejected = true; }
  assert(rejected, 'cycle accepted');
});


await test('symlink externo em legal/sources é rejeitado', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const outside = path.join(root, 'outside-source.txt');
  await fs.writeFile(outside, 'outside bytes');
  const link = path.join(root, 'legal/sources/sample/escape.txt');
  try { await fs.symlink(outside, link); }
  catch (error) {
    if(['EPERM','EACCES','ENOSYS'].includes(error?.code)) skip(`symlink unavailable: ${error.code}`);
    throw error;
  }
  const cfPath = path.join(root, 'legal/corpus/cf88.json');
  const cf = JSON.parse(await fs.readFile(cfPath,'utf8'));
  cf.sourceFile = 'legal/sources/sample/escape.txt';
  cf.sourceHash = sha256Bytes(await fs.readFile(outside));
  cf.acquisition.sourceFile = cf.sourceFile;
  cf.acquisition.sourceHash = cf.sourceHash;
  await fs.writeFile(cfPath, JSON.stringify(cf));
  await loadCorpus('legal/corpus', { root }).then(()=>{ throw new Error('accepted escaping symlink'); }, error=>assert(/sourceFile resolves outside legal\/sources/.test(error.message), error.message));
});

await test('sourceFile com ../ é rejeitado', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const cf = JSON.parse(await fs.readFile(path.join(root, 'legal/corpus/cf88.json'),'utf8'));
  cf.sourceFile = 'legal/sources/../outside.txt'; cf.acquisition.sourceFile = cf.sourceFile;
  let rejected = false;
  try { validateNorm(cf); } catch { rejected = true; }
  assert(rejected, '../ sourceFile accepted');
});

await test('sourceFile fora de legal/sources é rejeitado', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const cf = JSON.parse(await fs.readFile(path.join(root, 'legal/corpus/cf88.json'),'utf8'));
  cf.sourceFile = 'legal/corpus/source.txt'; cf.acquisition.sourceFile = cf.sourceFile;
  let rejected = false;
  try { validateNorm(cf); } catch { rejected = true; }
  assert(rejected, 'outside sourceFile accepted');
});

await test('dois builds iguais produzem bytes iguais', async()=>{
  const root = await tempRoot(); await writeCorpus(root);
  const script = path.resolve('scripts/build-legal-package.mjs');
  const env = { ...process.env, SOURCE_DATE_EPOCH:'1577836800' };
  let run = spawnSync(process.execPath, [script], { cwd:root, env, encoding:'utf8' });
  assert(run.status === 0, run.stderr || run.stdout);
  const first = await fs.readFile(path.join(root, 'public/legal/foundation-v1.json'));
  run = spawnSync(process.execPath, [script], { cwd:root, env, encoding:'utf8' });
  assert(run.status === 0, run.stderr || run.stdout);
  const second = await fs.readFile(path.join(root, 'public/legal/foundation-v1.json'));
  assert(first.equals(second), 'build output differed');
});

await test('falha de validação preserva pacote anterior', async()=>{
  const root = await tempRoot();
  await fs.mkdir(path.join(root, 'public/legal'), { recursive:true });
  const previous = '{"previous":true}\n';
  await fs.writeFile(path.join(root, 'public/legal/foundation-v1.json'), previous);
  await fs.mkdir(path.join(root, 'legal/corpus'), { recursive:true });
  const script = path.resolve('scripts/build-legal-package.mjs');
  const run = spawnSync(process.execPath, [script], { cwd:root, encoding:'utf8' });
  assert(run.status !== 0, 'builder unexpectedly passed');
  const after = await fs.readFile(path.join(root, 'public/legal/foundation-v1.json'), 'utf8');
  assert(after === previous, 'previous package was not preserved');
});

if(process.exitCode) process.exit(process.exitCode);
