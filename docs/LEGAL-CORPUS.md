# Kódice — Corpus Jurídico Canônico

O corpus jurídico do **Kódice** reúne os principais textos normativos do ordenamento jurídico brasileiro em formato estruturado e semanticamente validado.

---

## 1. Composição do Corpus

* **Total de Normas:** 61 diplomas legais federais.
* **Total de Unidades Estruturadas:** 36.045 artigos, parágrafos, incisos, alíneas e itens.
* **Localização no Repositório:** `legal/corpus/*.json`
* **Catálogo Resumido:** `legal/catalog.json`

### Principais Normas Abrangidas:
1. **Constituição da República Federativa do Brasil de 1988** (`cf88`)
2. **Código de Processo Civil** (Lei nº 13.105/2015 — `cpc2015`)
3. **Código Civil** (Lei nº 10.406/2002 — `cc2002`)
4. **Código Penal** (Decreto-Lei nº 2.848/1940 — `cp1940`)
5. **Código de Processo Penal** (Decreto-Lei nº 3.689/1941 — `cpp1941`)
6. **Consolidação das Leis do Trabalho** (Decreto-Lei nº 5.452/1943 — `clt1943`)
7. **Código Tributário Nacional** (Lei nº 5.172/1966 — `ctn1966`)
8. **Código de Defesa do Consumidor** (Lei nº 8.078/1990 — `cdc1990`)
9. **Estatuto da Criança e do Adolescente** (Lei nº 8.069/1990 — `eca1990`)
10. **Estatuto da OAB** (Lei nº 8.906/1994 — `eoab1994`)
11. **Lei Geral de Proteção de Dados Pessoais — LGPD** (Lei nº 13.709/2018 — `lgpd2018`)
*(e mais 50 leis fundamentais, códigos e estatutos)*

---

## 2. Estrutura de Cada Norma

Cada arquivo JSON no diretório `legal/corpus/` obedece a um esquema estrito:

```json
{
  "id": "cpc2015",
  "urn": "urn:lex:br:federal:lei:2015-03-16;13105",
  "type": "lei",
  "number": "13105",
  "year": 2015,
  "title": "Código de Processo Civil",
  "popularName": "CPC/2015",
  "ementa": "Código de Processo Civil.",
  "status": "vigente",
  "publicationDate": "2015-03-17",
  "officialSourceUrl": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
  "sourceHash": "...",
  "lastVerifiedAt": "...",
  "acquisition": {
    "sourceFile": "legal/sources/cpc2015.htm",
    "articleCount": 1075,
    "unitCount": 4199
  },
  "units": [
    {
      "id": "cpc2015:art300",
      "parentId": null,
      "kind": "artigo",
      "label": "Art. 300",
      "canonicalPath": "art300",
      "heading": "Art. 300.",
      "text": "A tutela de urgência será concedida quando houver elementos que evidenciem a probabilidade do direito e o perigo de dano ou o risco ao resultado útil do processo.",
      "sortOrder": 1250,
      "status": "vigente"
    }
  ]
}
```

---

## 3. Proveniência e Auditoria

1. **Fontes Oficiais:** Todas as normas são extraídas dos portais oficiais da Presidência da República (Planalto) ou Câmara dos Deputados.
2. **Imutabilidade e Hash Canônico:**
   * A materialização do banco de dados SQLite é perfeitamente determinística.
   * O hash lógico das 61 normas e 36.045 unidades é:
     ```
     7e09b098072983fb87854e5e2fcceed809bde308069e37b454b07e4d15aa512f
     ```
   * Qualquer alteração não autorizada no texto normativo rompe a integridade da verificação.
