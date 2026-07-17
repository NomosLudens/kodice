# Kódice Web App/PWA — Validação RC1

O Kódice é um web app/PWA publicado no Cloudflare com arquitetura local-first. Local-first não significa aplicativo separado ou exclusivamente local.

## A. Preview Cloudflare

- **pré-condição:** Deploy de preview concluído no Cloudflare Pages.
- **ação:** Acessar a URL do preview.
- **resultado esperado:** Preview abre em HTTPS, resposta 200, assets carregam, manifest carrega, service worker carrega, reload direto funciona, console sem erro, nenhuma URL privada aparece no bundle, nenhum mixed content.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## B. Desktop

- **pré-condição:** Navegador Firefox ou Chromium.
- **ação:** Abrir a biblioteca e navegar pelas abas Local e Estação. Testar painéis, teclado, importação por seletor, drag and drop, leitura e navegação.
- **resultado esperado:** Tudo funciona perfeitamente sem erros.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## C. Mobile

- **pré-condição:** Dispositivo móvel ou simulador com touch.
- **ação:** Testar viewport móvel, toque, sidebar, painéis, teclado virtual, mudança de orientação, instalação da PWA, leitura EPUB/PDF/TXT.
- **resultado esperado:** Interface responsiva, toques reconhecidos corretamente e instalação PWA bem-sucedida.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## D. Boot local-first

- **pré-condição:** App recém aberto com URL Station ausente.
- **ação:** Analisar requests na aba Network e console.
- **resultado esperado:** Nenhuma request /api/codice, biblioteca local disponível, ausência de Supabase não quebra o app, console sem erro.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## E. EPUB local real

- **pré-condição:** App aberto, EPUB local válido disponível.
- **ação:** Importar, abrir, navegar, criar nota, verificar progresso, realizar reload e verificar persistência.
- **resultado esperado:** O arquivo abre rapidamente, notas e progresso são salvos e persistem após o reload.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## F. PDF local real

- **pré-condição:** App aberto, PDF local válido disponível.
- **ação:** Importar, abrir, mudar de páginas, criar nota, realizar reload e verificar persistência.
- **resultado esperado:** Navegação fluida, notas salvas na página certa e persistência funcionando.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## G. TXT local real

- **pré-condição:** App aberto, arquivo TXT válido disponível.
- **ação:** Importar, abrir, dar scroll, criar nota, realizar reload e verificar persistência.
- **resultado esperado:** Leitura correta, posição do scroll armazenada e persistência pós-reload.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## H. Supabase web

- **pré-condição:** Modo sem variáveis iniciais, seguido de login caso configurado.
- **ação:** Testar login, logout, sincronização, falha de rede. Monitorar pacotes de dados.
- **resultado esperado:** Sincronização robusta, nenhuma URL Station enviada, nenhum catálogo Station enviado, nenhum byte remoto enviado.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## I. Station via web app

- **pré-condição:** Station privada configurada e online.
- **ação:** Informar URL HTTPS real, verificar health e library. Acionar Atualizar, abrir EPUB, PDF e TXT remotos. Testar CORS, Station indisponível e funcionamento isolado.
- **resultado esperado:** Station é listada corretamente (read-only). Biblioteca Local continua funcionando paralelamente caso Station caia.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## J. Privacidade no navegador

- **pré-condição:** Station conectada e dados locais gerados.
- **ação:** Inspecionar Local Storage, IndexedDB, CacheStorage, service worker, Network, backup exportado e requisições Supabase.
- **resultado esperado:** baseUrl somente em localStorage. Catálogo e bytes remotos somente em memória. Nenhum byte Station salvo no IndexedDB (books/book_files) ou CacheStorage. Backup livre de referências Station.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## K. PWA

- **pré-condição:** PWA passível de instalação (desktop ou mobile).
- **ação:** Instalar, abrir instalada, atualizar o cache/service worker, dar reload e ativar modo offline.
- **resultado esperado:** Funciona offline para os livros locais. A aba Station avisa a indisponibilidade isoladamente, restabelecendo-se ao voltar online. Nenhum cache de livro remoto no SW.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## L. Backup

- **pré-condição:** Dados e livros presentes, Station conectada.
- **ação:** Exportar backup, inspecionar conteúdo (JSON), importar em perfil limpo e conferir.
- **resultado esperado:** O arquivo exportado contém apenas livros locais, notas e progresso. Nenhuma URL e nenhum catálogo da Station. Importação recria o estado com sucesso.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE

## M. Jurídico

- **pré-condição:** Inspecionar os builds e diretórios gerados.
- **ação:** Verificar se pacotes jurídicos foram injetados. Testar build:epubs sem corpus produtivo.
- **resultado esperado:** Nenhum EPUB jurídico, nenhum JSON jurídico produtivo solto, nenhum Vade Mecum, nenhum texto "completo", e nenhum arquivo jurídico falso em `dist`. Build correspondente falha adequadamente.
- **resultado obtido:** PENDENTE
- **status:** PENDENTE
- **evidência:** PENDENTE
- **incidente:** PENDENTE
