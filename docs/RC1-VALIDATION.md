# Kódice Web App/PWA — Validação RC1

O Kódice é um web app/PWA publicado no Cloudflare com arquitetura local-first. Local-first não significa aplicativo separado ou exclusivamente local.

## A. Preview Cloudflare

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| A01 | Abrir URL HTTPS | HTTP 200 | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| A02 | Carregar assets | Todos 200 | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| A03 | Carregar manifest | HTTP 200 e JSON válido | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| A04 | Carregar service worker | HTTP 200 | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| A05 | Recarregar página | App reabre | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| A06 | Inspecionar console | Nenhum erro | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| A07 | Verificar mixed content | Nenhuma ocorrência | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

*(Testes devem ser feitos no deploy de preview do Cloudflare Workers/Pages)*

## B. Desktop

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| B01 | Abrir navegador compatível | Firefox ou Chromium aberto | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| B02 | Navegar na aba Local | Exibição correta da biblioteca local | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| B03 | Navegar na aba Estação | Exibição correta da estação configurada | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| B04 | Testar importação por seletor | Livro importado sem erros | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| B05 | Testar drag and drop | Arquivo solto abre corretamente | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| B06 | Testar painéis UI | Cada painel abre após um clique e fecha após um clique, sem erro no console | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| B07 | Testar teclado | Atalhos e navegação funcionais | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## C. Mobile

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| C01 | Viewport móvel | Interface responsiva carrega corretamente | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| C02 | Interação por toque | Cada controle responde a um único toque e não dispara ação duplicada | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| C03 | Sidebar e painéis | Abrem e fecham com animação suave | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| C04 | Teclado virtual | Layout adapta-se sem sobreposições | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| C05 | Mudança de orientação | UI refaz layout corretamente | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| C06 | Instalação PWA | Instalação concluída com sucesso | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## D. Boot local-first

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| D01 | Ausência de URL Station | App inicializa sem erros | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| D02 | Analisar requests iniciais | Nenhuma request /api/codice disparada | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| D03 | Acesso à biblioteca local | Totalmente funcional | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| D04 | Inspecionar console pós-boot | Nenhum erro registrado | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## E. EPUB local real

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| E01 | Importar arquivo válido | Parse bem-sucedido | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| E02 | Navegar páginas | Mudança sem travamentos | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| E03 | Criar nota | Nota salva e exibida | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| E04 | Realizar reload | Arquivo reabre na mesma página com nota salva | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## F. PDF local real

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| F01 | Importar arquivo válido | PDF carrega com sucesso | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| F02 | Navegar páginas | Página anterior e próxima são exibidas sem tela vazia ou erro no console | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| F03 | Criar nota | Nota vinculada à página correta | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| F04 | Realizar reload | PDF reabre na mesma página com nota | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## G. TXT local real

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| G01 | Importar arquivo válido | Texto renderizado e legível | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| G02 | Dar scroll no conteúdo | Scroll fluido | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| G03 | Criar nota | Nota salva no contexto local | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| G04 | Realizar reload | Scroll restabelecido e nota presente | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## H. Supabase web

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| H00 | abrir sem variáveis Supabase | app local funciona | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| H01 | Testar login com Supabase | Login bem-sucedido | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| H02 | logout remove sessão visual | sessão visual removida | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| H03 | Sincronizar dados online | Sincronização sem falhas de integridade | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| H04 | Monitorar pacotes HTTP | Nenhuma URL Station é trafegada | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| H05 | Sincronizar catálogo | Nenhum arquivo da Station é enviado à nuvem | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| H06 | Falha de rede provocada | Recuperação limpa ao voltar online | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## I. Station via web app

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| I00 | Station não configurada | mensagem correta e Atualizar desativado | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I01 | Informar URL HTTPS real | Health check (HTTP 200 e schema válido) | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I02 | Acionar "Atualizar" | Catálogo obtido com sucesso | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I03 | Abrir EPUB, PDF, TXT remoto | Download direto no Reader sem gravação local persistente | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I04 | Testar CORS em domínio diferente | Requisição CORS aprovada | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I05 | Station indisponível abruptamente | App relata erro de rede isolado, biblioteca local mantida | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I06 | remover Station | baseUrl e catálogo são limpos, biblioteca local permanece | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I07 | criar nota e progresso em livro remoto | nota e progresso criados | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I08 | recarregar página e reabrir livro remoto | livro remoto reaberto com sucesso | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| I09 | bytes remotos são baixados novamente | bytes remotos são baixados novamente; nota e progresso permanecem | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## J. Privacidade no navegador

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| J01 | Inspecionar localStorage | baseUrl da Station presente, sem blobs | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| J02 | Inspecionar IndexedDB (books) | Nenhum byte/catálogo Station armazenado | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| J03 | Inspecionar CacheStorage | Nenhum byte Station armazenado | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| J04 | Inspecionar Service Worker | Nenhuma interceptação gravando dados da Station | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## K. PWA

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| K01 | Instalar via prompt | Ícone criado e abre standalone | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| K02 | Atualizar assets em background | SW detecta nova versão e reporta | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| K03 | Ativar modo offline e abrir | PWA carrega e exibe interface local | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| K04 | Tentar ler livro Station offline | Aviso limpo de indisponibilidade de rede | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## L. Backup

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| L01 | Exportar backup via UI | Arquivo JSON gerado e baixado | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| L02 | Inspecionar JSON gerado | Nenhuma menção à URL ou dados da Station | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| L03 | Importar JSON em perfil limpo | Todos os dados locais (notas, config, etc) restaurados | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## M. Jurídico

| ID | Verificação | Resultado esperado | Obtido | Status | Evidência | Incidente |
|---|---|---|---|---|---|---|
| M01 | Inspecionar dist/ final | Nenhum arquivo jurídico solto ou EPUB mock | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| M02 | Inspecionar código da UI | Nenhum botão "Vade Mecum completo" produtivo | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| M03 | Fallback fetch ausente | Tentativas de fetch em "/legal/id.epub" bloqueadas/inexistentes | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
