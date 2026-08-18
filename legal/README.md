# Vade Mecum Foundation

Este diretório contém a base canônica para o corpus jurídico estruturado do Kódice.

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

O importador lê exclusivamente os bytes brutos do snapshot oficial preservado em `legal/sources/cpc2015/`, deriva todas as unidades jurídicas hierárquicas (partes, livros, títulos, capítulos, seções, subseções, artigos, parágrafos, incisos, alíneas e itens) e valida conformidade integral com o schema sem qualquer intervenção manual.

## Regra de integridade e Build

O pacote público `public/legal/foundation-v1.json` é gerado por `scripts/build-legal-package.mjs` a partir de `legal/corpus/*.json`.

```bash
node scripts/build-legal-package.mjs
node scripts/verify-legal-corpus.mjs
node scripts/test-cpc-pipeline.mjs
```

O campo `hash` do pacote é o SHA-256 do conteúdo estável do manifesto, calculado sobre:

- `schemaVersion`
- `packageId`
- `version`
- `normIds`
- `norms`

O campo `generatedAt` fica fora do material hasheado para manter o hash determinístico em builds repetidos com o mesmo corpus.

## Persistência no Supabase

A persistência do corpus estruturado no Supabase é realizada pelo script idempotente `scripts/sync-legal-corpus.mjs`:

```bash
node scripts/sync-legal-corpus.mjs
```

Requer as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (ou `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`) configuradas no ambiente.
