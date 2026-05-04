# Teologia Viva — PRD

## Problema original
Construir o aplicativo **Teologia Viva** — um PWA mobile-first integrado com Supabase (Auth + DB + Edge Functions). Experiência devocional, academia de estudos teológicos, leitura bíblica, comunidade e eventos locais. Design: Azul Marinho #001F3F + Dourado/Sépia, minimalista e sóbrio.

## Infraestrutura
- **Supabase URL**: https://wuwmjovqdahlpfkncydg.supabase.co
- **Anon key**: configurada em `/app/frontend/.env` como `REACT_APP_SUPABASE_ANON_KEY`
- **Edge Function**: `/functions/v1/clever-task` (POST com `{ prompt }`) — usada pelo Tutor IA e pela explicação de versículos
- **Bíblia**: fetch público via `bible-api.com` (tradução Almeida)

## Arquitetura
- **Frontend**: React + Tailwind + Shadcn UI, mobile-first (`max-w-md` frame), conversando diretamente com Supabase via `@supabase/supabase-js`. Backend FastAPI/Mongo do template não é usado.
- **Rotas**: `/auth` (público), `/` (Início), `/academia`, `/curso/:id`, `/aula/:id`, `/biblia`, `/comunidade`, `/eventos`, `/anotacoes`, `/perfil`.
- **Guards**: `Protected` redireciona para `/auth` se não autenticado; `PublicOnly` redireciona para `/` se já autenticado.

## Planos
- **Trial** (7 dias a partir de `trial_inicio`): acesso total, IA ilimitada
- **Free** (pós-trial): apenas 1ª aula dos cursos, 5 consultas de IA/dia
- **Premium**: acesso total (lógica de upgrade ainda não implementada — botão "Upgrade" é um placeholder)
- Cálculo do plano efetivo em `src/lib/plan.js` (client-side; tabela `profiles` armazena `plano` + `trial_inicio`)

## Tabelas Supabase consumidas
- `profiles` (assumida): id uuid PK = auth.users.id, nome, email, plano, trial_inicio
- `devocionais`: data, titulo, versiculo, referencia, reflexao
- `eixos`: id, nome, ordem
- `cursos`: id, eixo_id, nome, descricao, capa_url, ordem
- `aulas`: id, curso_id, ordem, titulo, leitura_biblica, video_url, texto_apoio
- `mural_oracoes`: id, user_id, autor_nome, pedido, contador_oracoes, created_at
- `interacoes_oracao`: id, user_id, oracao_id
- `eventos_comunidade`: id, titulo, descricao, latitude, longitude, data_evento, status
- `anotacoes`: id, user_id, titulo, conteudo, created_at

## Implementado (30/abr/2026)
- [x] Setup: Supabase client, fontes Cormorant Garamond + Karla, paleta navy/gold, PWA manifest
- [x] Auth (signup/login) com criação de profile (trial + trial_inicio=NOW)
- [x] Tratamento gracioso quando Supabase exige confirmação de email
- [x] Layout mobile com header (logo + badge de plano) e bottom navigation (5 abas)
- [x] Tela Início com devocional do dia (fallback para mais recente)
- [x] Academia (eixos como pills horizontais, cursos filtrados, cards)
- [x] Curso com progresso (localStorage) e lista de aulas (lock em free)
- [x] Aula com leitura bíblica estilizada, player de vídeo (YouTube embed), texto de apoio, Tutor IA drawer (contexto da aula → clever-task)
- [x] Bíblia com parchment mode, 38 livros (AT+NT), seletor de livro/capítulo (sheets), clique em versículo → drawer "Explicar com IA"
- [x] Comunidade com mural_oracoes, botão "Vou Orar" (optimistic + contador) e criação de pedido
- [x] Eventos com GPS e filtro Haversine 20km
- [x] Anotações (lista + criar + excluir)
- [x] Perfil com status do plano, contador de IA usado, progresso do curso atual
- [x] Rate limit de IA (5/dia para free, ilimitado trial/premium) via localStorage

## Implementado (04/mai/2026)
- [x] **Bíblia consumida 100% do Supabase** — tabela `biblia` recriada com schema `(versao, abbrev, name, ordem, testamento, chapters jsonb)` e PK composto `(versao, abbrev)`. Populada com **3 versões completas** (NVI, ACF, AA — Almeida Atualizada), 66 livros cada, 198 linhas no total. RLS habilitado com policy de leitura pública.
- [x] `lib/bible.js` totalmente refatorado: `listBooks(versao)`, `getChaptersCount(abbrev, versao)`, `fetchChapter(abbrev, chapter, versao)` — sem dependência de APIs externas. Cache em memória da lista de livros. Range explícito `0-99` para garantir os 66 livros.
- [x] **`Biblia.jsx` reescrito**:
  - Header em 2 linhas: (1) Seletor de versão + botão Aa, (2) Picker de livro/capítulo + Prev/Next. **Sticky no topo** com fundo navy/95 + backdrop blur. h-11 nos botões para serem clicáveis em mobile.
  - 4 tamanhos de fonte (sm/md/lg/xl) cicláveis pelo Aa, persistidos.
  - Versão e livro/capítulo persistidos em `localStorage` (com migração automática de chaves antigas).
  - **Barra flutuante via React Portal no `document.body`** (fix para bug de containing block causado por `transform` da animação `animate-fade-up`). Fundo sólido `#1A1A1A`, z-index 9999, borda dourada 2px.
  - 3 botões claros: **Destacar** (Sheet de cores) / **Tutor IA** (dourado central — abre Drawer + dispara IA com texto de todos os versículos selecionados) / **Menu** (Drawer completo).
  - Drawer em z-index 220, Sheet de cores em 210, todos via Radix Portal.
  - `console.log` no `toggleVerse` para debug do estado de seleção.
  - **Layout — removido `animate-fade-up`** do `<main>` para eliminar o bug que transformava `position: fixed` em `position: absolute` (transform CSS cria novo containing block).
  - **Progresso de aulas migrado para Supabase + Realtime (04/mai/2026)**:
  - **Web Push Notifications do Devocional Diário (04/mai/2026)**:
    - Tabela `progresso_aulas` `(user_id, aula_id, curso_id, completed_at)` com RLS por usuário e adicionada à publication `supabase_realtime`.
    - `lib/progresso.js` com `listProgress`, `markComplete`, `unmarkComplete`, `migrateLocalProgressToSupabase`, `subscribeProgress`.
    - `AuthContext` chama `migrateLocalProgressToSupabase` automaticamente no login (idempotente, marca flag `tv_progress_migrated_v1_<userId>` no localStorage).
    - `Aula.jsx`, `Curso.jsx` e `Perfil.jsx` agora leem do Supabase. `markComplete` upserta em vez de localStorage.
    - **Realtime sync**: `subscribeProgress` em `Aula.jsx` e `Curso.jsx` — marca aula no notebook e o S24 atualiza instantaneamente sem refresh.
  - **Lembrete de Meditação 18:00 (04/mai/2026)** — segunda push opcional:
    - Coluna `profiles.notif_meditacao` (bool default false).
    - Edge Function `send-devotional-push` parametrizada com `kind: 'devocional'|'meditacao'` (mesma função, dois crons).
    - Mensagem meditação: **"🌙 Hora da meditação — Que tal retomar [título] antes de descansar?"**
    - pg_cron `send-meditation-reminder-daily` em `0 21 * * *` (= 18:00 BRT).
    - Switch separado no Perfil (`data-testid="switch-notif-meditacao"`) — opcional, totalmente independente do switch de devocional. Reusa a mesma push subscription.
    - **VAPID keys** geradas localmente (P-256). Public key em `frontend/.env` (`REACT_APP_VAPID_PUBLIC_KEY`); Private + Subject (`mailto:contato@teologiaviva.app`) nas Edge Function secrets do Supabase.
    - **Service Worker** `/public/sw.js` — handlers `push` (showNotification) e `notificationclick` (foco/abrir app).
    - **Tabela `push_subscriptions`** (user_id, endpoint, p256dh, auth, user_agent) com RLS — usuário gerencia suas próprias inscrições; service_role lê todas.
    - **Coluna `profiles.notif_devocional`** (bool default false) — preferência do usuário.
    - **`lib/push.js`** — `subscribePush()`, `unsubscribePush()`, `getCurrentSubscription()`, `isPushSupported()`. Upsert por endpoint.
    - **Switch no Perfil** (`data-testid="switch-notif-devocional"`) — pede permissão, faz subscribe via PushManager, salva no Supabase. Desabilitado em browsers sem suporte.
    - **Edge Function `send-devotional-push`** — Deno + `npm:web-push@3.6.7`. Carrega devocional do dia, busca subs com `notif_devocional=true`, envia em paralelo, remove endpoints expirados (404/410). Suporta `dryRun: true`.
    - **pg_cron** `send-devotional-push-daily` agendado em **`0 10 * * *`** (10:00 UTC = 07:00 BRT) via `net.http_post` com Bearer service_role.
    - **Mensagem padrão**: "☕ Seu devocional de hoje já está disponível!" + título do devocional.
    - Detecta dispositivo via `matchMedia('(pointer: coarse)')` — no S24 Ultra retorna true.
    - **Mobile**: troca o `<Drawer>` Vaul por um **modal fullscreen** (`position: fixed inset:0 z-99998`) sem animação de slide, sem teclado-induced reflow.
    - **Desktop**: mantém o Drawer Vaul tradicional com animação suave.
    - Antes de abrir: `document.activeElement.blur()` + scroll lock no `<body>`.
    - `suspendList` por 1s após o clique de Tutor IA — bloqueia novos toques na lista de versículos.
    - Cores 100% navy/dourado oficiais (sem mais vermelho).
    - Validado em viewport 412×915 com `pointer:coarse`: 2 ciclos consecutivos de Tutor IA sem nenhum erro de console.
- [x] **Devocional restaurado ao topo** da Início (`Inicio.jsx`): card grande aparece logo após o título da seção; StreakBadge movido para baixo do devocional.
- [x] **Admin — Fix `body stream already read`**: `lib/admin.js` substituído — `createRow`/`updateRow` agora usam `.select()` (sem `.single()`) e devolvem `data[0]`. Adicionado `clean()` que converte strings vazias em `null` antes do insert/update.

## ⚠️ Configurações PENDENTES no Supabase (a cargo do usuário)
O teste E2E apontou 3 bloqueadores server-side:

1. **Desabilitar "Confirm email"** em *Authentication → Providers → Email* (ou habilitar auto-confirm). Sem isso, signup não retorna sessão e o fluxo fica travado.
2. **Tabela `profiles` precisa das colunas**: `id uuid PK`, `nome text`, `email text`, `plano text default 'trial'`, `trial_inicio timestamptz`. Faltou a coluna `plano`.
3. **RLS/GRANT na `profiles`**: liberar SELECT/INSERT/UPDATE para o role `authenticated`, com policy `USING (auth.uid() = id)`. Atualmente nega até leitura.

O app possui fallback de profile sintético, então os itens 2/3 não quebram a UI — mas o plano real (e o trial_inicio real) só serão persistidos depois que o schema estiver correto.

## Backlog (P1/P2)
- P1: Integração de pagamento (Stripe) para upgrade Premium
- P1: Seed data / devocional fallback quando `devocionais` está vazio
- P1: Persistir progresso do curso em tabela Supabase (`progresso_aulas`) em vez de localStorage
- P1: Deep link em versículo (compartilhar), busca na Bíblia
- P2: Notificações push (devocional diário)
- P2: Filtro/ordenação em eventos (data, categoria)
- P2: Rich text nas anotações (markdown)
- P2: Offline mode (service worker) — atualmente manifest.json está mínimo

## Personas
- **Aluno iniciante**: quer começar a estudar teologia com estrutura de trilha (Academia), devocional diário e dúvidas respondidas pelo Tutor IA.
- **Comunidade local**: compartilha pedidos de oração, encontra eventos próximos.
- **Leitor avançado**: usa a Bíblia com explicações de versículos e mantém anotações.
