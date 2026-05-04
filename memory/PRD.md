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
- [x] **Devocional restaurado ao topo** da Início (`Inicio.jsx`): card grande aparece logo após o título da seção; StreakBadge movido para baixo do devocional.
- [x] **Bíblia — Seletor de versões + tamanho de fonte**:
  - Dropdown `data-testid="biblia-translation-select"` com Almeida (ARC), Bíblia Livre (BLJ), Open Nova Bíblia Viva (ONBV), Bíblia Livre p/ Todos (BLT) e NVI (em breve / placeholder com fallback automático).
  - Botão `data-testid="biblia-font-size"` (Aa) cicla entre 4 tamanhos (sm/md/lg/xl), persistido em `localStorage`.
  - Tradução também persistida em `localStorage` (chave `tv_biblia_translation`).
  - `lib/bible.js` agora suporta múltiplos provedores: `bible-api.com` (Almeida) + `bible.helloao.org` (PT_BLJ/ONBV/BLT) com mapeamento USFM por livro.
- [x] **Bíblia — Barra flutuante refeita**: 3 ações claras em grid: **Destacar** (abre Sheet com paleta de cores rápida), **Tutor IA** (abre Drawer e dispara `handleExplain` automaticamente para todos os versículos selecionados), **Menu** (abre Drawer completo).
- [x] **Admin — Fix `body stream already read`**: `lib/admin.js` substituído — `createRow`/`updateRow` agora usam `.select()` (sem `.single()`) e devolvem `data[0]`. Adicionado `clean()` que converte strings vazias em `null` antes do insert/update, evitando erros de tipo no PostgREST. Aplicado a Eixos, Cursos, Aulas, Devocionais e Eventos do painel admin.

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
