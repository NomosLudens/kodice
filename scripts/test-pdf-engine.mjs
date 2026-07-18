import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../node_modules/pdfjs-dist/package.json', import.meta.url), 'utf8'));
assert.equal(packageJson.version, '6.1.200');
assert.match(source, /pdfjs-dist\/build\/pdf\.mjs/);
assert.match(source, /pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url/);
assert.match(source, /isEvalSupported:\s*false/);
assert.match(source, /pdfRenderTask/);
assert.match(source, /pdfRenderGeneration/);
assert.match(source, /task\.cancel\(\)/);

function createTextPdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R >>',
    '<< /Length 56 >>\nstream\nBT /F1 24 Tf 72 720 Td (Kódice PDF page 1) Tj ET\nendstream',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>',
    '<< /Length 56 >>\nstream\nBT /F1 24 Tf 72 720 Td (Kódice PDF page 2) Tj ET\nendstream',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>',
    '<< /Length 56 >>\nstream\nBT /F1 24 Tf 72 720 Td (Kódice PDF page 3) Tj ET\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

const loadingTask = pdfjsLib.getDocument({ data: createTextPdf(), isEvalSupported: false });
const pdf = await loadingTask.promise;
assert.equal(pdf.numPages, 3);
for (const expectedPage of [1, 2, 3]) {
  const page = await pdf.getPage(expectedPage);
  const text = await page.getTextContent();
  assert.ok(text.items.some(item => item.str.includes(`page ${expectedPage}`)));
  const viewport = page.getViewport({ scale: 1 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  assert.ok([...pixels].some((value, index) => index % 4 !== 3 && value !== 255), `page ${expectedPage} canvas is blank`);
}
await loadingTask.destroy();

const builtFiles = await readdir(new URL('../dist/assets/', import.meta.url));
assert.ok(builtFiles.some(file => /^pdf\.worker\.min-.*\.mjs$/.test(file)), 'built PDF worker asset is missing');
console.log('PDF engine contract passed: version, secure eval setting, three text pages, non-white canvases, worker asset.');
