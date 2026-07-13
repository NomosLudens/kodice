# Vade Mecum Foundation

Este diretório contém a base canônica para o corpus jurídico estruturado do Kódice.

## Fontes oficiais aceitas

A constante única `OFFICIAL_SOURCE_HOSTS`, em `scripts/legal-corpus-lib.mjs`, limita `officialSourceUrl` a famílias oficiais aprovadas pelo projeto:

- Normas.leg.br;
- Câmara dos Deputados;
- Senado Federal;
- Planalto;
- LexML, apenas para identificação e relacionamentos.

Sites privados, blogs, resumos, Wikipédia, Jusbrasil, PDFs sem origem comprovada e texto gerado por IA permanecem proibidos.

## Regra de integridade

O pacote público `public/legal/foundation-v1.json` é gerado por `scripts/build-legal-package.mjs` a partir de `legal/corpus/*.json`.

O campo `hash` do pacote é o SHA-256 do conteúdo estável do manifesto, calculado sobre:

- `schemaVersion`
- `packageId`
- `version`
- `normIds`
- `norms`

O campo `generatedAt` fica fora do material hasheado para manter o hash determinístico em builds repetidos com o mesmo corpus.

## Build determinístico

O `generatedAt` não usa relógio de parede. A origem determinística é, nesta ordem:

1. `SOURCE_DATE_EPOCH`, quando definido;
2. o maior `lastVerifiedAt` entre as normas;
3. falha explícita se nenhuma data válida existir.

Dois builds com os mesmos arquivos de corpus e fontes oficiais devem gerar bytes idênticos.

## Arquivo oficial de origem

Cada norma deve declarar `sourceFile`, sempre como caminho relativo dentro de `legal/sources/`. O build e o verificador calculam SHA-256 dos bytes reais desse arquivo e comparam com `sourceHash`.

Caminhos absolutos, `..` e qualquer arquivo fora de `legal/sources/` são rejeitados.

## Manifesto de aquisição

Cada norma deve conter um manifesto `acquisition` derivado do arquivo oficial e conferido pelo validador, contendo no mínimo:

- `normId`
- `sourceFile`
- `sourceHash`
- `unitCount`
- `articleCount`
- `firstCanonicalPath`
- `lastCanonicalPath`
- `verifiedAt`
- `complete: true`

O validador compara esses valores com as unidades realmente presentes no corpus. Os smoke checks jurídicos continuam existindo, mas não provam integralidade sozinhos.

## Gate de corpus

Nenhum texto jurídico deve ser escrito manualmente ou inventado. Antes de adicionar uma norma em `legal/corpus`, confirme fonte oficial, URL, versão, data de verificação, hash SHA-256 do material de origem e estrutura integral validada.

Se Constituição Federal, ADCT e CPC não puderem ser obtidos e conferidos em fonte oficial, o resultado do PR permanece: **BLOQUEADO — CORPUS OFICIAL AUSENTE**.
