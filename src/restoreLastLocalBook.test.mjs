import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreLastLocalBook } from './restoreLastLocalBook.js';

const book = (id, type) => ({ id, type });
const progress = (book_id, updated_at) => ({ book_id, updated_at });
const file = { data: new Uint8Array([1]).buffer };

async function run({ books, progressRows, files = {}, openResult = true, openError = null }) {
  const opened = [];
  const result = await restoreLastLocalBook({
    books,
    progressRows,
    getBookFile: async id => files[id],
    openBook: async id => {
      opened.push(id);
      if (openError) throw openError;
      return openResult;
    },
  });
  return { result, opened };
}

test('progresso vazio não abre livro', async () => {
  assert.deepEqual(await run({ books: [book('epub-1', 'epub')], progressRows: [] }), { result: false, opened: [] });
});

for (const type of ['epub', 'pdf', 'txt']) {
  test(`${type} local válido chama openBook uma vez`, async () => {
    const result = await run({
      books: [book(`${type}-1`, type)],
      progressRows: [progress(`${type}-1`, 10)],
      files: { [`${type}-1`]: file },
    });
    assert.deepEqual(result, { result: true, opened: [`${type}-1`] });
  });
}

test('progresso sem metadado é ignorado', async () => {
  assert.deepEqual(await run({
    books: [],
    progressRows: [progress('removed', 10)],
    files: { removed: file },
  }), { result: false, opened: [] });
});

test('metadado sem bytes é ignorado', async () => {
  assert.deepEqual(await run({
    books: [book('missing-file', 'epub')],
    progressRows: [progress('missing-file', 10)],
  }), { result: false, opened: [] });
});

test('progresso Station é ignorado', async () => {
  assert.deepEqual(await run({
    books: [book('station:remote', 'epub')],
    progressRows: [progress('station:remote', 10)],
    files: { 'station:remote': file },
  }), { result: false, opened: [] });
});

test('progresso inválido é ignorado', async () => {
  assert.deepEqual(await run({
    books: [book('invalid-time', 'txt')],
    progressRows: [progress('invalid-time', 'not-a-timestamp')],
    files: { 'invalid-time': file },
  }), { result: false, opened: [] });
});

test('múltiplos progressos abrem somente o local elegível mais recente', async () => {
  const result = await run({
    books: [book('older', 'epub'), book('newer', 'pdf')],
    progressRows: [progress('older', 10), progress('newer', 20)],
    files: { older: file, newer: file },
  });
  assert.deepEqual(result, { result: true, opened: ['newer'] });
});

test('falha de openBook não interrompe o restore nem o boot', async () => {
  const result = await run({
    books: [book('broken', 'epub')],
    progressRows: [progress('broken', 10)],
    files: { broken: file },
    openError: new Error('reader failed'),
  });
  assert.deepEqual(result, { result: false, opened: ['broken'] });
});

test('não depende de viewport mobile', async () => {
  const previousMatchMedia = globalThis.matchMedia;
  delete globalThis.matchMedia;
  try {
    const result = await run({
      books: [book('mobile', 'txt')],
      progressRows: [progress('mobile', 10)],
      files: { mobile: file },
    });
    assert.deepEqual(result, { result: true, opened: ['mobile'] });
  } finally {
    if (previousMatchMedia) globalThis.matchMedia = previousMatchMedia;
  }
});
