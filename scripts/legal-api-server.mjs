#!/usr/bin/env node
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

/**
 * scripts/legal-api-server.mjs
 *
 * Servidor HTTP nativo (node:http) para a API jurídica privada do Kódice na VM Mini.
 * Consulta o banco SQLite persistente.
 */

export function createLegalApiHandler(db, options = {}) {
  const allowedOrigins = options.allowedOrigins || ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5273', 'http://127.0.0.1:5273', 'https://mini.taildb6c11.ts.net', 'https://kodice.nomosludens.ia.br'];

  const getNormStmt = db.prepare(`
    SELECT n.*, v.id as version_id, v.version_date, v.source_hash
    FROM legal_norms n
    LEFT JOIN legal_versions v ON v.id = n.current_version_id
    WHERE n.id = ?
  `);

  const getUnitStmt = db.prepare(`
    SELECT u.*
    FROM legal_units u
    JOIN legal_norms n ON n.id = u.norm_id AND n.current_version_id = u.version_id
    WHERE u.norm_id = ? AND u.canonical_path = ?
  `);

  const listNormsStmt = db.prepare(`
    SELECT n.id, n.urn, n.type, n.number, n.year, n.title, n.popular_name, n.status,
           n.publication_date, n.official_source_url, n.last_verified_at
    FROM legal_norms n
    ORDER BY n.id
  `);

  return (req, res) => {
    const origin = req.headers.origin;
    const cleanOrigin = origin ? origin.replace(/\/+$/, '') : null;
    const isAllowed = cleanOrigin && (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*') || allowedOrigins.some(o => o.replace(/\/+$/, '') === cleanOrigin));
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    } else if (!origin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    let cleanPath = parsedUrl.pathname.replace(/\/+/g, '/');
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    const pathname = cleanPath.startsWith('/api/legal')
      ? cleanPath
      : ('/api/legal' + (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath));

    // 1. Health
    if (pathname === '/health' || pathname === '/api/legal/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'kodice-legal-api' }));
      return;
    }

    // 2. List norms
    if (pathname === '/api/legal/norms') {
      const rows = listNormsStmt.all();
      const out = rows.map(n => ({
        id: n.id, urn: n.urn, type: n.type, number: n.number, year: n.year,
        title: n.title, popularName: n.popular_name, status: n.status,
        publicationDate: n.publication_date,
        officialSourceUrl: n.official_source_url,
        lastVerifiedAt: n.last_verified_at
      }));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
      return;
    }

    // 2aa. Full norm units: /api/legal/norms/:normId/units
    // Returns ALL units of the current version, ordered by sort_order ASC.
    // Used by the reader to render the whole norm as a continuous document.
    const fullUnitsMatch = pathname.match(/^\/api\/legal\/norms\/([^/]+)\/units$/);
    if (fullUnitsMatch) {
      const normId = decodeURIComponent(fullUnitsMatch[1]);
      const normRow = db.prepare('SELECT current_version_id FROM legal_norms WHERE id = ?').get(normId);
      if (!normRow || !normRow.current_version_id) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Legal norm not found', normId }));
        return;
      }
      const fullUnitsStmt = db.prepare(`
        SELECT id, norm_id, version_id, parent_id, kind, label, canonical_path, heading, text, sort_order, status
        FROM legal_units
        WHERE norm_id = ? AND version_id = ?
        ORDER BY sort_order ASC
      `);
      const rows = fullUnitsStmt.all(normId, normRow.current_version_id);
      const out = rows.map(r => ({
        id: r.id,
        normId: r.norm_id,
        versionId: r.version_id,
        parentId: r.parent_id,
        kind: r.kind,
        label: r.label,
        canonicalPath: r.canonical_path,
        heading: r.heading,
        text: r.text,
        sortOrder: r.sort_order,
        status: r.status
      }));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
      return;
    }

    // 2a. List children: /api/legal/norms/:normId/children?parent=<canonicalPath>
    const childrenMatch = pathname.match(/^\/api\/legal\/norms\/([^/]+)\/children$/);
    if (childrenMatch) {
      const normId = decodeURIComponent(childrenMatch[1]);
      const parentCp = parsedUrl.searchParams.get('parent');
      const normRow = db.prepare('SELECT current_version_id FROM legal_norms WHERE id = ?').get(normId);
      if (!normRow) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Legal norm not found', normId }));
        return;
      }
      // Resolve parent_id from parent canonical path if provided
      let parentId = null;
      if (parentCp && parentCp !== 'root') {
        let parentRow = getUnitStmt.get(normId, parentCp);
        if (!parentRow) {
          const fallbackPath = parentCp.replace(/[^a-zA-Z0-9-]/g, '');
          parentRow = getUnitStmt.get(normId, fallbackPath);
        }
        if (!parentRow) {
          const cleanNum = parentCp.replace(/[^0-9]/g, '');
          if (cleanNum) parentRow = getUnitStmt.get(normId, 'art' + cleanNum);
        }
        if (!parentRow) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Parent unit not found', normId, parentCp }));
          return;
        }
        parentId = parentRow.id;
      }
      const childrenStmt = db.prepare(`
        SELECT u.id, u.parent_id, u.kind, u.label, u.canonical_path, u.heading, u.sort_order
        FROM legal_units u
        WHERE u.norm_id = ? AND u.version_id = ?
          AND ${parentId === null ? 'u.parent_id IS NULL' : 'u.parent_id = ?'}
        ORDER BY u.sort_order
      `);
      const args = parentId === null ? [normId, normRow.current_version_id] : [normId, normRow.current_version_id, parentId];
      const rows = childrenStmt.all(...args);
      const out = rows.map(r => ({
        id: r.id,
        normId: r.norm_id,
        versionId: r.version_id,
        parentId: r.parent_id,
        kind: r.kind,
        label: r.label,
        canonicalPath: r.canonical_path,
        heading: r.heading,
        sortOrder: r.sort_order
      }));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
      return;
    }

    // 2b. Global search: /api/legal/search?q=<query>&limit=<limit>
    // 2c. Norm search: /api/legal/norms/:normId/search?q=<query>&limit=<limit>
    const globalSearchMatch = pathname === '/api/legal/search';
    const normSearchMatch = pathname.match(/^\/api\/legal\/norms\/([^/]+)\/search$/);

    if (globalSearchMatch || normSearchMatch) {
      const qRaw = (parsedUrl.searchParams.get('q') || '').trim();
      let limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
      if (isNaN(limit) || limit <= 0) limit = 50;
      if (limit > 100) limit = 100;

      if (!qRaw) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify([]));
        return;
      }

      const targetNormId = normSearchMatch ? decodeURIComponent(normSearchMatch[1]) : null;

      let qClean = qRaw.replace(/^art\.?\s*/i, '').trim();
      qClean = qClean.replace(/^(cpc|cpc2015)\s*/i, '').trim();

      const exactCpCandidate = targetNormId ? `${targetNormId}-art${qClean}` : `%art${qClean}`;
      const exactLabelCandidate = `Art. ${qClean}%`;
      const likePattern = `%${qRaw}%`;
      const cleanLikePattern = `%${qClean}%`;

      let rows = [];
      if (targetNormId) {
        const normSearchStmt = db.prepare(`
          SELECT u.id, u.norm_id, u.version_id, u.parent_id, u.kind, u.label, u.canonical_path, u.heading, u.text, u.sort_order
          FROM legal_units u
          WHERE u.norm_id = ? AND (
            u.canonical_path = ? OR
            u.canonical_path LIKE ? OR
            u.label LIKE ? OR
            u.heading LIKE ? OR
            u.text LIKE ?
          )
          ORDER BY (CASE WHEN u.canonical_path = ? THEN 0 WHEN u.label LIKE ? THEN 1 ELSE 2 END), u.sort_order ASC
          LIMIT ?
        `);
        rows = normSearchStmt.all(targetNormId, exactCpCandidate, `%${qClean}`, exactLabelCandidate, likePattern, likePattern, exactCpCandidate, exactLabelCandidate, limit);
      } else {
        const globalSearchStmt = db.prepare(`
          SELECT u.id, u.norm_id, u.version_id, u.parent_id, u.kind, u.label, u.canonical_path, u.heading, u.text, u.sort_order
          FROM legal_units u
          WHERE (
            u.canonical_path = ? OR
            u.canonical_path LIKE ? OR
            u.label LIKE ? OR
            u.heading LIKE ? OR
            u.text LIKE ? OR
            u.canonical_path LIKE ?
          )
          ORDER BY (CASE WHEN u.canonical_path = ? THEN 0 WHEN u.label LIKE ? THEN 1 ELSE 2 END), u.sort_order ASC
          LIMIT ?
        `);
        rows = globalSearchStmt.all(exactCpCandidate, `%${qClean}`, exactLabelCandidate, likePattern, likePattern, cleanLikePattern, exactCpCandidate, exactLabelCandidate, limit);
      }

      const out = rows.map(r => ({
        id: r.id,
        normId: r.norm_id,
        versionId: r.version_id,
        parentId: r.parent_id,
        kind: r.kind,
        label: r.label,
        canonicalPath: r.canonical_path,
        heading: r.heading,
        snippet: r.text ? (r.text.length > 160 ? r.text.slice(0, 160) + '…' : r.text) : '',
        text: r.text
      }));

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
      return;
    }

    // 3. Unit lookup: /api/legal/norms/:normId/units/:canonicalPath
    const unitMatch = pathname.match(/^\/api\/legal\/norms\/([^/]+)\/units\/([^/]+)$/);
    if (unitMatch) {
      const normId = decodeURIComponent(unitMatch[1]);
      const canonicalPath = decodeURIComponent(unitMatch[2]);

      let unit = getUnitStmt.get(normId, canonicalPath);
      if (!unit) {
        const fallbackPath = canonicalPath.replace(/[^a-zA-Z0-9-]/g, '');
        unit = getUnitStmt.get(normId, fallbackPath);
      }
      if (!unit) {
        const cleanNum = canonicalPath.replace(/[^0-9]/g, '');
        if (cleanNum) unit = getUnitStmt.get(normId, 'art' + cleanNum);
      }

      if (!unit) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Legal unit not found', normId, canonicalPath }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: unit.id,
        normId: unit.norm_id,
        versionId: unit.version_id,
        parentId: unit.parent_id,
        kind: unit.kind,
        label: unit.label,
        canonicalPath: unit.canonical_path,
        heading: unit.heading,
        text: unit.text,
        sortOrder: unit.sort_order,
        status: unit.status
      }));
      return;
    }

    // 4. Norm lookup: /api/legal/norms/:normId
    const normMatch = pathname.match(/^\/api\/legal\/norms\/([^/]+)$/);
    if (normMatch) {
      const normId = decodeURIComponent(normMatch[1]);
      const norm = getNormStmt.get(normId);

      if (!norm) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Legal norm not found', normId }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: norm.id,
        urn: norm.urn,
        type: norm.type,
        number: norm.number,
        year: norm.year,
        title: norm.title,
        popularName: norm.popular_name,
        ementa: norm.ementa,
        status: norm.status,
        publicationDate: norm.publication_date,
        officialSourceUrl: norm.official_source_url,
        currentVersionId: norm.current_version_id,
        lastVerifiedAt: norm.last_verified_at
      }));
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  };
}

export function startLegalApiServer(dbPath, port = 4520, host = '127.0.0.1') {
  const db = new DatabaseSync(dbPath);
  const handler = createLegalApiHandler(db);
  const server = http.createServer(handler);

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      resolve({ server, db, port, host });
    });
    server.on('error', reject);
  });
}

if (process.argv[1] && process.argv[1].endsWith('legal-api-server.mjs')) {
  const dbPath = process.env.KODICE_LEGAL_DB || '/var/lib/kodice/legal.db';
  const port = parseInt(process.env.KODICE_LEGAL_PORT || '4520', 10);
  const host = process.env.KODICE_LEGAL_HOST || '127.0.0.1';

  startLegalApiServer(dbPath, port, host).then(({ port, host }) => {
    console.log(`Kódice Legal API listening on http://${host}:${port}`);
  }).catch(err => {
    console.error('Failed to start Legal API server:', err);
    process.exit(1);
  });
}
