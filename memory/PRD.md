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

## Hotfix (05/mai/2026 — Selection Bar Invisível + Anti-Crash)
- [x] **BUG: `contain: layout paint` no `<main>` quebrou `position: fixed`**: a barra de seleção da Bíblia estava invisível porque `<main>` virava um novo *containing block* para descendentes fixos. Removido `contain` do `<main>` em `Layout.jsx`. Mantido apenas em containers sem filhos fixed (AulaNotes, sidebar da Bíblia, modal do Tutor IA).
- [x] **Barra de seleção SEMPRE MONTADA** (`Biblia.jsx`): substituído `selectedVerses.length > 0 ? (...) : null` por `visibility/opacity/pointerEvents` toggles. Evita mount/unmount cycles que disparavam `insertBefore` no Chrome Android.
- [x] **3 novos botões na barra de seleção** (linha inferior, sempre visíveis):
  - `selection-share` (Compartilhar) — reutiliza `handleShare`.
  - `selection-save-image` (Salvar) — reutiliza `handleSaveImage`.
  - `selection-obs` (Observação) — abre o Menu de Estudo.
  - Card `<ShareVerseCard>` agora usa `getCardVerses()` = `drawerVerses || selectedVerses`, permitindo compartilhar direto da seleção sem abrir o Menu.
- [x] **Tutor IA — paddingBottom:120px em TODOS os breakpoints** (`AITutorDrawer.jsx`): desktop antes tinha `paddingBottom:16px`, agora recebe os mesmos 120px do mobile para que a última resposta fique acima da barra de input.
- [x] **Modais sempre montados no DOM** (visibility toggle):
  - `study-mobile-modal` (Biblia): troca de `if(!drawerOpen) return null` para `visibility:hidden/visible`.
  - `ai-tutor-mobile-modal` (AITutorDrawer mobile): idem.
  - Previne React mount/unmount → elimina causa raiz do `insertBefore` crash em Chrome Android.
- [x] **Validado por testing agent (iteration_9)**: 5/5 PASS em desktop 1440x900 E mobile 412x915. Zero `insertBefore` crashes. paddingBottom 120px confirmado.

## Implementado (05/mai/2026 — Layout Responsivo Desktop)
- [x] **Fim da largura fixa no desktop** (`Layout.jsx`):
  - Container muda de `max-w-md` para `lg:max-w-6xl` em telas ≥1024px (Tailwind `lg`).
  - `<main>` ganha `lg:px-8 lg:py-8` e `lg:pb-10`. Header com `lg:px-8` + `lg:text-xl`.
  - `BottomNav` agora estica até `lg:max-w-6xl` para acompanhar o container.
- [x] **Aula em 2 colunas (Desktop)** (`Aula.jsx`):
  - Grid `lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start`.
  - **Esquerda (70%)**: Leitura Bíblica + Vídeo + Texto de Apoio.
  - **Direita (30%, sticky `top-24`)**: `<AulaNotes>` + Botão "Tutor IA" + Botão "Marcar como concluída".
  - Mobile: layout inalterado (coluna única + CTAs sticky bottom).
- [x] **Bíblia em 2 colunas (Desktop)** (`Biblia.jsx`):
  - Grid `lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start`.
  - Painel de estudo extraído em função `renderStudyBody()` reusável (Modal mobile, Drawer Vaul, Sidebar lg+).
  - **Sidebar sticky (`top-24`, `maxHeight: calc(100vh - 8rem)`)** mostra:
    - Empty state ("Selecione um versículo") quando nenhum versículo selecionado.
    - Quando `drawerOpen`: ref + versículos + Destacar + Favoritar + Observação + Tutor IA + **Compartilhar/Salvar imagem (RESTAURADOS)**.
  - Estado `isDesktopWide` (`matchMedia('(min-width: 1024px)')`) anula o Drawer Vaul em desktop largo (sem duplicação de UI).
  - Reader não é mais escurecido (`opacity 0.6`) em desktop — apenas mobile.
- [x] **Mobile-first preservado**: S24 Ultra mantém modal fullscreen, padding 70/120 do Tutor IA, fluxo da floating bar de seleção.

## Implementado (05/mai/2026 — Blindagem Mobile S24 Ultra)
- [x] **Anti-crash `insertBefore` (Chrome Android)** — `lib/share.js`:
  - Substituído `toPng` + `fetch(dataUrl).blob()` por `toBlob` direto (menos passos de DOM).
  - Delay de `200ms` ("respiro técnico") antes de `html-to-image` E antes do `navigator.share`.
  - Download usa `URL.createObjectURL` + `appendChild` no `body` (nunca `insertBefore`).
  - `Biblia.jsx` (`handleShare`, `handleSaveImage`, `handleSaveObs`): `activeElement.blur()` + `setTimeout 200ms` antes da ação pesada.
- [x] **Tutor IA — respostas cortadas eliminadas** (`AITutorDrawer.jsx`):
  - Mobile: header e input agora são `position:absolute` (overlays), messages scroll por baixo.
  - `paddingTop: 70px` + `paddingBottom: 120px` na área de mensagens — texto NUNCA fica atrás do header/teclado.
  - Auto-scroll em dois passos (imediato + `requestAnimationFrame`) após cada mensagem/loading.
  - `contain: layout paint` no modal.
- [x] **Anotações das Aulas — botão + toast** (`AulaNotes.jsx`):
  - Botão dourado **"Salvar Anotação"** `#C5A059` abaixo do textarea (`data-testid="btn-salvar-anotacao"`).
  - Durante save: label muda para "Salvando..." + spinner. Toast ✅ "Anotação salva!" no sucesso.
  - Mantém o auto-save com debounce (1500ms) em paralelo. O manual cancela o debounce pendente para evitar double-write.
- [x] **Perfil — notificações**: switch explica "Permissão bloqueada" quando `Notification.permission === 'denied'` (Chrome → Site → Notificações). Se `default`, o prompt nativo é acionado pelo próprio clique no switch (via `subscribePush → askPermission`).
- [x] **Performance CSS**: `contain: layout paint` aplicado em `<main>` do Layout, modal do Tutor IA e bloco de Anotações.

## Implementado (05/mai/2026 — UX & Jornada)
- [x] **Tutor IA — Modal Fullscreen mobile** (`AITutorDrawer.jsx`):
  - No mobile (`pointer:coarse`): renderiza `<div fullscreen>` com `height: 100dvh`, `flex column` e fundo `#001529`.
  - Header fixo no topo (título + descrição + botão X), input fixo no rodapé, mensagens em scroll independente (`flex:1; minHeight:0`).
  - Quando o teclado Android abre, o `100dvh` encolhe e o input "sobe junto" — histórico continua visível.
  - Desktop mantém o Drawer Vaul tradicional.
- [x] **Bloco de Notas nas Aulas** (`AulaNotes.jsx`):
  - Tabela `anotacoes_aulas (user_id, aula_id, conteudo, updated_at)` com PK composto + RLS por usuário.
  - Auto-save com debounce de 1500ms (upsert no Supabase) — indicadores "Salvando…" / "Salvo" no header do bloco.
  - Estilo navy/dourado consistente, posicionado abaixo do vídeo na `Aula.jsx`.
- [x] **Página `/jornada` — Minha Jornada** (`Jornada.jsx`):
  - Tabs: **Destaques** (lê `anotacoes_biblia` filtrando por color/favorito_lista/observacao com badge da cor + bookmark) e **Anotações** (lê `anotacoes_aulas` com join para curso/aula).
  - Empty states com CTA contextual (Ir para Bíblia / Ir para Academia).
  - Acessível pelo Perfil → "Minha Jornada" + rota `/jornada` no App.js.
- [x] **Salvar imagem do versículo**:
  - `lib/share.js` adicionou `saveVerseCard()` separada de `shareVerseCard()`.
  - Botões pareados no Menu de Estudo: "Compartilhar" (dourado) + "Salvar imagem" (outline) em grid 2 colunas.

## Implementado (05/mai/2026)
- [x] **Compartilhar versículo (P0)**:


  - Componente `<ShareVerseCard>` (1080×1920, navy/dourado, ornamento de cantos, branding "Teologia Viva")
  - `lib/share.js` com `shareVerseCard()` — usa `html-to-image` (`toPng`) → `File` → `navigator.share({ files })` (Android/iOS modernos) → fallback download.
  - Botão "Compartilhar versículo" (`data-testid="btn-compartilhar"`) no Menu de Estudo da Bíblia (mobile e desktop).
- [x] **Stripe Checkout (Modo Teste)** — preparação completa:
  - Tabela `payment_transactions` (user_id, session_id, amount, currency, status, payment_status, package_id) com RLS.
  - Edge Function `stripe-create-checkout` (Deno + `npm:stripe@14.21.0`) — pacotes server-side (NUNCA aceita amount do client). Cria session, registra tx pendente.
  - Edge Function `stripe-checkout-status` — polling idempotente. Atualiza status + ativa `profiles.plano = 'premium'` quando pago.
  - Secret `STRIPE_API_KEY = sk_test_emergent` configurada via Management API.
  - `lib/payments.js` com `startCheckout` e `pollSessionStatus`.
  - `<UpgradeModal>` reformulado: card de preço "R$ 9,90/mês", botão "Quero ser Premium" → redireciona para Stripe Checkout.
  - `Perfil.jsx` detecta `?session_id=...` no retorno e faz polling de até 60s, mostra toast e ativa Premium automaticamente.

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
