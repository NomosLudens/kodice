# Diretrizes de Segurança — Kódice

## 1. Postura de Segurança e Privacidade

O **Kódice** adota uma arquitetura estritamente **local-first**:
* **Privacidade de Livros e Documentos:** Arquivos EPUB, PDF e TXT importados pelo usuário são armazenados e processados exclusivamente no navegador (IndexedDB e Web Workers locais). Nenhum documento pessoal é transmitido para servidores remotos.
* **Isolamento de Credenciais:** O repositório e a aplicação não exigem nem embutem segredos, tokens mestres ou credenciais de produção.
* **Política de Rede Restrita:** Por padrão, o frontend conecta-se exclusivamente à API jurídica canônica (`https://api.kodice.nomosludens.ia.br`) e, caso configurado pelo usuário, ao serviço de sincronização Supabase. Não há conexões automáticas a redes privadas ou serviços terceiros não autorizados.

## 2. Reportando Vulnerabilidades

Caso identifique uma vulnerabilidade de segurança:
1. **Não** abra uma issue pública.
2. Envie os detalhes e passos de reprodução através de um relatório privado de segurança no GitHub (Security Advisory) ou contate os mantenedores.
3. Forneça detalhes técnicos que permitam a reprodução e avaliação do impacto.
