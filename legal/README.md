# Vade Mecum Foundation

Este diretório contém a base canônica para o corpus jurídico estruturado do Kódice.

## Arquitetura de Persistência Jurídica: VM Mini

O corpus jurídico do Kódice adota a arquitetura canônica **VM Mini**:

```text
FONTES OFICIAIS
      ↓
legal/sources/
      ↓
importador determinístico
      ↓
legal/corpus/
      ↓
verificação / hash
      ↓
VM MINI
      ↓
SQLite (/var/lib/kodice/legal.db)
      ↓
API Privada Kódice (porta 4520)
      ↓
Tailscale HTTPS
      ↓
Kódice PWA
```

## Fontes oficiais aceitas

A constante única `OFFICIAL_SOURCE_HOSTS`, em `scripts/legal-corpus-lib.mjs`, limita `officialSourceUrl` a famílias oficiais aprovadas pelo projeto:

- Normas.leg.br;
- Câmara dos Deputados (`www.camara.leg.br`, `www2.camara.leg.br`);
- Senado Federal (`www.senado.leg.br`, `legis.senado.leg.br`);
- Planalto (`www.planalto.gov.br`);
- LexML (`www.lexml.gov.br`), para identificação, URNs e relacionamentos.

Sites privados, blogs, resumos, Wikipédia, Jusbrasil, PDFs sem origem comprovada e texto gerado por IA permanecem proibidos.

## Fonte oficial do CPC/2015

- **Provider primário:** Câmara dos Deputados — Centro de Documentação e Informação
- **URL oficial:** `https://www.camara.leg.br/legin/fed/lei/2015/lei-13105-16-marco-2015-780273-normaatualizada-pl.html`
- **Formato:** HTML oficial integral compilado/atualizado com metadados legislativos completos.
- **Snapshot local:** `legal/sources/cpc2015/lei-13105-16-marco-2015-normaatualizada-pl.html`
- **SHA-256 do snapshot:** `ef5749a3c624c8b8644949f6aa61370663b7da1bcfa6e1f1b25cbde5aa70b3e3`
- **Data de verificação:** `2026-08-18T00:00:00.000Z`

## Importador determinístico

O arquivo `legal/corpus/cpc2015.json` é gerado deterministicamente pelo importador oficial:

```bash
node scripts/import-cpc2015.mjs
```

O importador lê exclusivamente os bytes brutos do snapshot oficial preservado em `legal/sources/cpc2015/`, deriva todas as 4.199 unidades jurídicas hierárquicas (1.075 artigos) e valida conformidade integral com o schema sem qualquer intervenção manual.

## Materialização no SQLite (VM Mini)

A persistência do corpus estruturado no SQLite local da VM Mini é realizada pelo script idempotente `scripts/build-legal-db.mjs`:

```bash
node scripts/build-legal-db.mjs
```

O banco é criado/atualizado com schema relacional normalizado (`legal_norms`, `legal_versions`, `legal_units`), garantindo unicidade de versão vigente e caminhos canônicos (`canonical_path`).

## API Jurídica Privada

A API privada do Vade Mecum é executada via `node:http` nativo:

```bash
node scripts/legal-api-server.mjs
```

Endpoints mínimos:
- `GET /health` → `{ "status": "ok", "service": "kodice-legal-api" }`
- `GET /api/legal/norms/:normId` → Metadados da norma
- `GET /api/legal/norms/:normId/units/:canonicalPath` → Unidade jurídica recuperada do SQLite (ex: `art300`)
