# PWA e dispositivos móveis

## Arquitetura deste PR

- Cloudflare Pages entrega o app estático em `dist/`.
- O service worker guarda apenas app shell, manifest, ícones já existentes, bundles, chunks locais e worker local do PDF.js.
- IndexedDB guarda livros locais, notas, progresso e ajustes.
- Supabase continua opcional para conta, notas, progresso e preferências; arquivos EPUB/PDF/TXT não são enviados.
- Héstia fica fora deste PR.

## Instalação

### Chrome Android

Abra o site, acesse **Ajustes** e toque em **Instalar Kódice** quando o prompt do Chrome estiver disponível. Também é possível usar o menu do Chrome e escolher **Instalar app** ou **Adicionar à tela inicial**.

### Safari iPhone

Abra o site no Safari, toque em **Compartilhar**, escolha **Adicionar à Tela de Início** e confirme em **Adicionar**. O app não abre automaticamente esse menu; a instalação depende de gesto do usuário.

## Offline e armazenamento

A primeira abertura precisa ocorrer online para o navegador baixar o app shell. Depois disso, a biblioteca local e livros já importados abrem pelo IndexedDB. Safari e PWA instalada no iPhone podem manter armazenamentos separados; importe os livros no contexto que pretende usar.

O Kódice solicita persistência de armazenamento uma única vez após o primeiro livro importado, quando o navegador oferece `navigator.storage.persist()`. A concessão não é garantida.

## Backup

O backup é manual. O lembrete de backup informa quando há alterações desde o último backup, mas o arquivo só é criado após tocar em **Exportar backup**. No iPhone, a exportação tenta Web Share API com arquivo quando suportado e usa download por link como fallback.

## Cache

Cacheado pelo service worker:

- `/` e `/index.html`;
- `manifest.webmanifest`;
- ícones já existentes do app;
- bundle principal e chunks dinâmicos de EPUB/PDF;
- worker local do PDF.js;
- demais assets locais do build.

Nunca cacheado:

- respostas Supabase/autenticação/API;
- endpoints `.ts.net`/Héstia futura;
- requisições cross-origin;
- métodos diferentes de GET;
- requisições com `Authorization`;
- arquivos EPUB/PDF/TXT e blobs dos livros.

## Segurança e CSP

A política de segurança (CSP) é entregue em `public/_headers` e protege o app shell estático:
- `connect-src 'self' https://api.kodice.nomosludens.ia.br https://*.supabase.co wss://*.supabase.co;`
- Não depende de hosts privados ou túneis internos por padrão.
- Bloqueia conexões não autorizadas e vazamentos de credenciais.
