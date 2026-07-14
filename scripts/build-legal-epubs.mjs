#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { loadCorpus } from './legal-corpus-lib.mjs';

async function createEpub(norm, destDir) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `epub-${norm.id}-`));

  try {
    // 1. mimetype (must not have newline)
    await fs.writeFile(path.join(tmpDir, 'mimetype'), 'application/epub+zip');

    // 2. META-INF/container.xml
    const metaInfDir = path.join(tmpDir, 'META-INF');
    await fs.mkdir(metaInfDir, { recursive: true });
    await fs.writeFile(path.join(metaInfDir, 'container.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    // 3. OEBPS structure
    const oebpsDir = path.join(tmpDir, 'OEBPS');
    const textDir = path.join(oebpsDir, 'text');
    await fs.mkdir(textDir, { recursive: true });

    // CSS
    await fs.writeFile(path.join(oebpsDir, 'style.css'), `body {
  font-family: "Outfit", "Inter", sans-serif;
  margin: 2em;
  line-height: 1.6;
  color: #1a202c;
  background-color: #f7fafc;
}
h1 {
  text-align: center;
  font-size: 1.8em;
  margin-top: 1em;
  margin-bottom: 0.5em;
  color: #2b6cb0;
}
.ementa {
  font-style: italic;
  text-align: justify;
  margin-left: 25%;
  margin-bottom: 3em;
  font-size: 0.9em;
  color: #4a5568;
  line-height: 1.4;
}
.units {
  margin-top: 2em;
}
.unit {
  margin-bottom: 1.2em;
}
.unit.preambulo {
  font-style: italic;
  text-align: justify;
  text-indent: 2em;
  margin-bottom: 2em;
}
.unit.artigo {
  font-weight: 700;
  margin-top: 2em;
  border-top: 1px solid #e2e8f0;
  padding-top: 1em;
}
.unit.paragrafo {
  text-indent: 1.5em;
  margin-top: 0.8em;
}
.unit.inciso {
  text-indent: 3em;
  margin-top: 0.6em;
}
.unit.alinea {
  text-indent: 4.5em;
  margin-top: 0.4em;
}
.unit.item {
  text-indent: 6em;
  margin-top: 0.4em;
}
.unit.disposicao_transitoria {
  background-color: #edf2f7;
  padding: 1em;
  border-radius: 0.375rem;
  margin-top: 2em;
  font-style: italic;
}`);

    // Generate XHTML content
    let unitsXhtml = '';
    const sortedUnits = [...norm.units].sort((a, b) => a.sortOrder - b.sortOrder);
    
    for (const unit of sortedUnits) {
      const headingHtml = unit.heading ? `<h3 class="unit-heading">${unit.heading}</h3>` : '';
      unitsXhtml += `
      <div id="${unit.canonicalPath}" class="unit ${unit.kind}" data-urn="${norm.urn}#${unit.canonicalPath}">
        ${headingHtml}
        <span class="unit-label">${unit.label}</span>
        <span class="unit-text">${unit.text}</span>
      </div>`;
    }

    const mainXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR">
<head>
  <title>${norm.title}</title>
  <link rel="stylesheet" href="../style.css" type="text/css"/>
</head>
<body>
  <div class="legal-norm">
    <h1>${norm.title}</h1>
    <p class="ementa">${norm.ementa}</p>
    <div class="units">
      ${unitsXhtml}
    </div>
  </div>
</body>
</html>`;

    await fs.writeFile(path.join(textDir, 'main.xhtml'), mainXhtml);

    // NCX
    let ncxNavPoints = '';
    let playOrder = 1;
    const articles = sortedUnits.filter(u => u.kind === 'artigo');
    
    for (const art of articles) {
      ncxNavPoints += `
    <navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
      <navLabel>
        <text>${art.label}</text>
      </navLabel>
      <content src="text/main.xhtml#${art.canonicalPath}"/>
    </navPoint>`;
      playOrder++;
    }

    const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD NCX 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx-2005-1.dtd" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${norm.urn}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${norm.title}</text>
  </docTitle>
  <navMap>
    <navPoint id="navPoint-0" playOrder="0">
      <navLabel>
        <text>Início</text>
      </navLabel>
      <content src="text/main.xhtml"/>
    </navPoint>
    ${ncxNavPoints}
  </navMap>
</ncx>`;

    await fs.writeFile(path.join(oebpsDir, 'toc.ncx'), tocNcx);

    // OPF Manifest & Spine items
    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="db-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${norm.title}</dc:title>
    <dc:language>pt-BR</dc:language>
    <dc:identifier id="db-id">${norm.urn}</dc:identifier>
    <dc:creator opf:role="aut">República Federativa do Brasil</dc:creator>
    <dc:publisher>Kódice Legal Gate</dc:publisher>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="main" href="text/main.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref id="main"/>
  </spine>
</package>`;

    await fs.writeFile(path.join(oebpsDir, 'content.opf'), contentOpf);

    // 4. Zip compilation (mimetype must be uncompressed first)
    const epubFile = path.join(destDir, `${norm.id}.epub`);
    
    // Clean old file if exists
    await fs.rm(epubFile, { force: true });

    // mimetype uncompressed (using zip -0 -X)
    execSync(`zip -0 -X "${epubFile}" mimetype`, { cwd: tmpDir });
    
    // rest compressed (using zip -9 -r)
    execSync(`zip -9 -r "${epubFile}" META-INF OEBPS`, { cwd: tmpDir });

    console.log(`Generated EPUB: ${epubFile}`);
  } finally {
    // Cleanup tmp dir
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    const norms = await loadCorpus();
    if (!norms.length) {
      console.error('No legal norms found in legal/corpus');
      process.exitCode = 1;
      return;
    }

    const publicLegalDir = path.resolve('public/legal');
    await fs.mkdir(publicLegalDir, { recursive: true });

    for (const norm of norms) {
      await createEpub(norm, publicLegalDir);
    }
    console.log('All legal EPUBs generated successfully!');
  } catch (error) {
    console.error('Error generating legal EPUBs:', error);
    process.exitCode = 1;
  }
}

main();
