# Arquitetura — Portal de Legislação e Jurisprudência (STJ)

> **Refatoração completa** · Julho 2025  
> Stack: Netlify Static Site · Netlify Functions (Node.js) · Netlify Blobs

---

## 1. Visão Geral

```
Browser (ES Modules)          Netlify Function           Netlify Blobs
─────────────────────         ──────────────────         ─────────────
public/js/main.js      POST   netlify/functions/         leis
  └── modules/*      ──────►  api.js                     artigos
  └── services/api.js          └── lib/modules/*         acordaos
  └── state/store.js           └── lib/shared/*          sessoes
  └── components/*             └── lib/parser/*          utilizadores
  └── utils/*                  └── lib/config.js         auditoria
                                └── lib/db.js            versoes
                                └── lib/security.js      relacoes
                                                         favoritos
```

---

## 2. Estrutura de Diretórios

### Backend — `netlify/functions/`

```
netlify/functions/
├── api.js                          # Dispatcher único (CORS, rate limit, rotas)
└── lib/
    ├── config.js                   # Constantes globais (STORES, ROLES, SEGURANÇA)
    ├── db.js                       # Camada de acesso a Netlify Blobs + cache
    ├── security.js                 # Sanitização de inputs (XSS, injeção)
    ├── seed.js                     # Dados iniciais (admin por defeito)
    ├── parser.js                   # Entrada do parser (compat. legado)
    ├── parser/                     # Parser modular de documentos
    │   ├── index.js                # Orquestrador
    │   ├── patterns.js             # Padrões regex
    │   ├── normalize.js            # Normalização de texto
    │   ├── detectArticles.js       # Deteção de artigos
    │   ├── detectHierarchy.js      # Hierarquia (grupos/capítulos/secções)
    │   ├── detectAnnexes.js        # Anexos
    │   ├── helpers.js              # Auxiliares do parser
    │   ├── validators.js           # Validação de resultados
    │   ├── parseLists.js           # Listas (alíneas)
    │   ├── parseNumbers.js         # Números e numerais romanos
    │   └── parseTables.js          # Tabelas
    │
    ├── shared/                     # ★ NOVO — Utilitários partilhados
    │   ├── store-truncation.js     # Truncagem lazy de stores (DRY)
    │   ├── errors.js               # Tipos de erro classificados (HTTP status)
    │   └── logger.js               # Logger estruturado JSON (por módulo)
    │
    └── modules/                    # ★ NOVO — Módulos de negócio
        ├── auth.js                 # Autenticação, sessões, RBAC
        ├── legislation.js          # Leis + Artigos (CRUD, cache, versões)
        ├── jurisprudence.js        # Acórdãos (CRUD, cache, versões)
        ├── audit.js                # Registo de auditoria
        ├── versioning.js           # Histórico de versões + restauro
        ├── search.js               # Motor de pesquisa (sinónimos, score)
        ├── relations.js            # Vinculação automática acórdão↔artigos
        ├── favorites.js            # Favoritos por utilizador
        └── pdf.js                  # Exportação PDF (pdfkit)
```

**Shims de compatibilidade** (re-exportam os novos módulos):
`lib/auth.js`, `lib/entities.js`, `lib/audit.js`, `lib/versioning.js`,
`lib/favoritos.js`, `lib/relacoes.js`, `lib/searchEngine.js`, `lib/pdfExport.js`

### Frontend — `public/`

```
public/
├── index.html                      # SPA — carrega apenas /js/main.js
├── css/
│   └── estilos.css                 # CSS único (inalterado)
└── js/
    ├── main.js                     # ★ Entry point ES Module
    │                               #   Reconstrói window.STJ, regista vistas
    ├── config/
    │   └── constants.js            # Constantes (VISTAS, ROLES, ESTADOS)
    ├── services/
    │   └── api.js                  # Cliente HTTP — único ponto de contacto API
    ├── state/
    │   └── store.js                # Store reativo + persistência de sessão
    ├── utils/
    │   ├── dom.js                  # Helpers DOM (g, q, setHtml, debounce…)
    │   └── format.js               # Formatação (datas, HTML escape, badges)
    ├── components/
    │   ├── toast.js                # Notificações toast
    │   ├── modal.js                # Modais (confirmar, alerta, input)
    │   └── spinner.js              # Loading states
    └── modules/
        ├── router.js               # Router SPA
        ├── home/view.js            # Página inicial
        ├── legislation/
        │   ├── list.js             # Lista de diplomas (filtros, ordenação)
        │   └── detail.js           # Detalhe: TOC, doc-search, hiperligações
        ├── jurisprudence/
        │   ├── list.js             # Lista de acórdãos
        │   └── detail.js           # Detalhe completo do acórdão
        ├── search/view.js          # Pesquisa avançada multi-entidade
        ├── privacy/view.js         # Política de privacidade RGPD
        └── admin/
            ├── index.js            # Orquestrador da área reservada
            ├── sidebar.js          # Navegação lateral
            ├── login.js            # Login / logout / alterar password
            ├── laws/
            │   ├── list.js         # Lista de leis (admin)
            │   ├── form.js         # Criar/editar lei
            │   └── import.js       # Wizard de importação de documentos
            ├── articles/
            │   ├── list.js         # Lista de artigos (admin)
            │   ├── form.js         # Criar/editar artigo
            │   └── interpretation.js # Painel de interpretação jurídica
            ├── decisions/
            │   ├── list.js         # Lista de acórdãos (admin)
            │   └── form.js         # Criar/editar acórdão
            ├── users/view.js       # Gestão de utilizadores
            ├── audit/view.js       # Registo de auditoria
            └── favorites/view.js   # Favoritos do utilizador
```

---

## 3. Fluxo de Dados

```
Utilizador
    │
    ▼
index.html ──► /js/main.js (type="module")
                    │
                    ├── carregarSessao()  ← sessionStorage
                    ├── iniciarSpinnerGlobal()
                    ├── router.registarTodos({...})
                    └── _render()
                             │
                             ├── modules/home/view.js
                             ├── modules/legislation/list.js
                             ├── modules/legislation/detail.js
                             ├── modules/jurisprudence/...
                             ├── modules/search/view.js
                             └── modules/admin/index.js
                                        │
                                        └── admin/laws/*, articles/*, decisions/*, ...
```

**Chamada à API:**
```
view.js ──► services/api.js ──► POST /api
                                     │
                             netlify/functions/api.js
                                     │
                             ├── _limiteExcedido() — rate limit
                             ├── ACOES_PUBLICAS[action]()
                             └── ACOES_AUTENTICADAS[action]()
                                         │
                                 lib/modules/*.js
                                         │
                                   lib/db.js ──► Netlify Blobs
```

---

## 4. Módulos de Negócio (Backend)

### `lib/modules/auth.js`
- Autenticação por username+password (bcryptjs)
- Sessões com token+CSRF em Netlify Blobs
- Bloqueio temporário após N tentativas falhadas
- RBAC: `requerPermissao(token, csrf, permissao)`
- Gestão de utilizadores (criar, alterar role/estado)
- Purga lazy de sessões expiradas

### `lib/modules/legislation.js`
- CRUD de **Leis** e **Artigos** com cache em memória
- Histórico automático via `guardarVersao()` antes de cada UPDATE/DELETE
- Importação em lote de artigos (substitui todos os existentes)
- Limpeza de dados dependentes (relações, favoritos) ao eliminar

### `lib/modules/jurisprudence.js`
- CRUD de **Acórdãos** com cache e histórico
- Vinculação automática a artigos após criar/editar (via `relations.js`)

### `lib/modules/search.js`
- Pesquisa textual multi-entidade (score-based)
- Expansão de sinónimos jurídicos (ex: "lei" → "decreto", "portaria"…)
- Preparado para evoluir para full-text index externo

### `lib/modules/audit.js` / `versioning.js`
- Ambos usam `lib/shared/store-truncation.js` (DRY eliminado)
- Auditoria: registo imutável de todas as ações de escrita
- Versioning: snapshot completo antes de UPDATE/DELETE; restauro com RBAC

### `lib/shared/errors.js`
Hierarquia tipada de erros com HTTP status semântico:
```
AppError (500)
  ├── ValidationError (400)
  ├── AuthError (401)
  ├── ForbiddenError (403)
  ├── NotFoundError (404)
  ├── ConflictError (409)
  ├── ParserError (422)
  └── StorageError (503)
```

---

## 5. Módulos de Serviço (Frontend)

### `js/services/api.js`
**Único ponto de contacto com a API.** Todas as views importam daqui.
- Nunca chamar `fetch()` diretamente nas views.
- Lança `Error` com a mensagem da API quando `ok: false`.

### `js/state/store.js`
**Single source of truth** para o estado da aplicação.
```js
store.set({ sessao: {...} });       // atualiza + notifica subscritores
store.get('sessao');                // leitura síncrona
store.subscribe('sessao', fn);      // subscrição reativa
```

### `js/utils/format.js`
- `h(str)` — escape HTML (XSS prevention) — **usar sempre** com dados externos
- `formatarData(iso)` — DD/MM/AAAA
- `formatarDataHora(iso)` — DD/MM/AAAA HH:MM
- `badgeEstadoLei(estado)` — badge colorido
- `nl2br(str)` — quebras de linha → `<br>`
- `destacar(texto, termo)` — highlight de pesquisa

---

## 6. Padrões de Código

### Backend: Módulo típico
```js
'use strict';
const db          = require('../db');
const { STORES }  = require('../config');
const { criarLogger } = require('../shared/logger');
const log = criarLogger('nome-modulo');

async function minhaFuncao(params) {
  // validar → operar → auditar → devolver
}
module.exports = { minhaFuncao };
```

### Frontend: Vista típica
```js
import * as api from '../../services/api.js';
import { h, formatarData } from '../../utils/format.js';

export async function renderMinhaVista(estado) {
  const dados = await api.minhaAcao();
  return `<div>...</div>`;
}
```

### Regra de ouro: escape HTML
```js
// ✅ CORRETO — dados do utilizador/API
`<div>${h(lei.titulo)}</div>`

// ❌ ERRADO — vulnerabilidade XSS
`<div>${lei.titulo}</div>`
```

---

## 7. Segurança

| Controlo | Implementação |
|---|---|
| XSS | `h()` em todos os dados externos no frontend; `sanitizar()` no backend |
| CSRF | Token duplo (token de sessão + token CSRF separado) |
| Rate limiting | 120 req/min/IP via Netlify Blobs (distribuído) |
| Prototype pollution | `_acao()` usa `hasOwnProperty` em vez de acesso direto |
| Sessões | UUID criptográfico + expiração configurável |
| Passwords | bcryptjs (10 rounds) + validação de complexidade |
| RBAC | `requerPermissao(token, csrf, permissao)` centralizado |
| Inputs | Limites de comprimento de texto por campo em `LIMITES_TEXTO` |
| CORS | Origem restrita a `process.env.URL` |

---

## 8. Performance

| Técnica | Onde |
|---|---|
| Cache em memória (TTL) | `lib/db.js` — leis, artigos |
| Cache-Control headers | `api.js` — ações públicas (60-300 s) |
| Truncagem lazy de stores | `lib/shared/store-truncation.js` |
| Rate limit com cache local 3 s | `api.js` — evita leitura de Blobs por pedido |
| IntersectionObserver (TOC) | `legislation/detail.js` |
| Debounce | `utils/dom.js` — pesquisa inline |
| Lazy imports | `jurisprudence.js` → `relations.js` (evita ciclos) |
| ES Modules nativos | `index.html` — sem bundler, sem overhead de runtime |
| `type="module"` defer implícito | `index.html` — não bloqueia o parser HTML |

---

## 9. Escalabilidade

| Cenário | Capacidade estimada |
|---|---|
| Diplomas | 10 000+ (lista paginável via filtros) |
| Artigos | 100 000+ (carregados por lei, não todos de uma vez) |
| Acórdãos | 50 000+ (lista paginável) |
| Utilizadores concorrentes | Milhares (serverless stateless) |
| Importações simultâneas | Limitadas pelo rate limit (120 req/min/IP) |

**Próximos passos para maior escala:**
1. Substituir Netlify Blobs por PostgreSQL/D1 + índices full-text
2. Adicionar Redis para cache de sessões e rate limiting
3. Implementar paginação real na API (cursor-based)
4. Adicionar índice de pesquisa dedicado (Typesense/Meilisearch)

---

## 10. Adicionar uma Nova Funcionalidade

### Novo módulo de negócio (backend):
1. Criar `netlify/functions/lib/modules/meu-modulo.js`
2. Importar em `api.js` e registar ações em `ACOES_*`
3. Criar shim `netlify/functions/lib/meu-modulo.js` para compat.

### Nova vista pública (frontend):
1. Criar `public/js/modules/minha-vista/view.js`
2. Importar e expor `renderMinhaVista` em `main.js`
3. Registar no `router.registarTodos({...})` em `main.js`
4. Adicionar botão de navegação no `index.html` se necessário

### Nova ação de API:
1. Adicionar handler em `ACOES_PUBLICAS` ou `ACOES_AUTENTICADAS` em `api.js`
2. Adicionar função exportada em `public/js/services/api.js`

---

## 11. Variáveis de Ambiente

| Variável | Uso |
|---|---|
| `URL` | CORS origin (URL do site Netlify) |
| `DEPLOY_PRIME_URL` | CORS fallback (preview deploys) |
| `NETLIFY_SITE_ID` | Store de rate limiting |
| `NETLIFY_BLOBS_TOKEN` | Acesso a Netlify Blobs |
| `ADMIN_PASSWORD` | Password do admin inicial (seed.js) |
| `DEBUG` | `"true"` ativa logs de debug |
| `NODE_ENV` | `"development"` ativa logs de debug |

---

*Documentação gerada automaticamente · Portal STJ · 2025*
