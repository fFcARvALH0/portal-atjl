# Portal de Legislação e Jurisprudência — ATJL
## Supremo Tribunal de Justiça (República Portucalense)

> ⚠️ **PLATAFORMA DE DEMONSTRAÇÃO TÉCNICA**
> A instituição, o país e todo o conteúdo jurídico são **inteiramente fictícios**.
> Criados exclusivamente para fins de estudo, demonstração e portefólio técnico.
> Não representa nem imita nenhuma entidade real.

---

## Sobre esta versão

Este projeto é a **migração de Google Apps Script para Netlify** do Portal
ATJL. A aplicação original corria inteiramente dentro do ecossistema Google
(Apps Script + Google Sheets + Gmail + Drive). Esta versão é independente
desse ecossistema e corre como um site estático + funções serverless no
Netlify.

### Principais alterações em relação à versão Apps Script

| Aspeto | Versão Apps Script (anterior) | Versão Netlify (esta) |
|---|---|---|
| Hospedagem | Web App do Apps Script | Site Netlify (estático + Functions) |
| Base de dados | Google Sheets (SpreadsheetApp) | Netlify Blobs (key-value) |
| Comunicação cliente↔servidor | `google.script.run` | `fetch('/api', …)` para uma Netlify Function |
| **Login da área reservada** | **email + password + 2FA por email** | **nome de utilizador + password, sem 2FA** |
| Hash de password | SHA-256 + salt manual | bcrypt (`bcryptjs`) |
| Sessões / bloqueios de login | `CacheService` | Tabela "sessoes" em Netlify Blobs |
| Exportação para PDF | Google Docs temporário → PDF (DocumentApp) | Geração direta em memória (`pdfkit`) |
| Emails (2FA, notificações) | Gmail (`MailApp`) | **Removidos nesta fase** (ver nota abaixo) |
| Criação do 1º administrador | Executar `setupInicial()` no editor Apps Script | Variáveis de ambiente `ADMIN_USERNAME` / `ADMIN_PASSWORD`, aplicadas automaticamente no 1º pedido à API |

**Nota sobre o 2FA e emails:** a app original enviava códigos de
verificação e notificações por Gmail. Como o Netlify não tem um serviço de
email de origem, esta funcionalidade foi **removida nesta fase** (decisão
tomada na migração). O login passa a ser apenas **utilizador + password**,
num único passo. Se mais tarde quiser reintroduzir 2FA ou notificações por
email, isso pode ser feito ligando um serviço externo (ex: Resend,
SendGrid, Postmark) e voltando a adicionar o passo de verificação no
`lib/auth.js` e no `js/admin.js`.

---

## Estrutura dos ficheiros

```
portal-atjl/
├── netlify.toml                 # Configuração de build, redirects /api, headers
├── package.json                 # Dependências Node (bcryptjs, pdfkit, @netlify/blobs)
├── .env.example                 # Modelo das variáveis de ambiente
├── netlify/functions/
│   ├── api.js                   # Função única que despacha todas as ações da API
│   └── lib/
│       ├── config.js            # Identidade institucional, papéis (RBAC), constantes
│       ├── db.js                # Camada de acesso a dados sobre Netlify Blobs
│       ├── security.js          # Sanitização de inputs
│       ├── auth.js              # Login (utilizador+password), sessões, RBAC
│       ├── audit.js             # Registo de auditoria
│       ├── versioning.js        # Histórico/restauro de versões
│       ├── entities.js          # CRUD de Leis, Artigos, Acórdãos
│       ├── relacoes.js          # Vinculação automática acórdão ↔ artigos
│       ├── favoritos.js         # Favoritos por utilizador
│       ├── searchEngine.js      # Pesquisa por relevância + sinónimos
│       ├── parser.js            # Análise de documentos importados
│       ├── pdfExport.js         # Exportação de leis/acórdãos para PDF
│       └── seed.js              # Criação automática do admin inicial
└── public/
    ├── index.html                # Página principal (SPA)
    ├── css/estilos.css           # CSS completo do portal
    └── js/
        ├── core.js               # Estado global + comunicação com a API
        ├── vistas.js             # Vistas públicas (home, legislação, jurisprudência, pesquisa…)
        └── admin.js              # Área reservada (login, CRUD, utilizadores, auditoria…)
```

---

## Instalação e deploy no Netlify

### 1. Criar o repositório Git

```bash
cd portal-atjl
git init
git add .
git commit -m "Portal ATJL — versão Netlify"
```

Suba o repositório para o GitHub/GitLab/Bitbucket da sua preferência.

### 2. Criar o site no Netlify

1. Aceda a [app.netlify.com](https://app.netlify.com) e clique em **Add new site → Import an existing project**.
2. Escolha o repositório que acabou de criar.
3. O Netlify deteta automaticamente as definições do `netlify.toml`:
   - **Build command:** `npm install`
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
4. Clique em **Deploy site**.

### 3. Ativar o Netlify Blobs

O Netlify Blobs é provisionado automaticamente para sites com Netlify
Functions — não precisa de criar nenhuma base de dados externa nem
fornecer chaves de API. Não é necessária nenhuma configuração extra.

### 4. Configurar as variáveis de ambiente (cria o administrador inicial)

Em **Site settings → Environment variables**, adicione:

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | Não (default: `admin`) |
| `ADMIN_PASSWORD` | uma password forte, só sua | **Sim** |
| `ADMIN_EMAIL` | `admin@example.com` | Não (campo de contacto, não usado para login) |

> Estas variáveis só têm efeito **enquanto não existir nenhum utilizador**
> na base de dados. Assim que o administrador inicial é criado (no
> primeiro pedido feito à API depois do deploy), pode alterar ou remover
> estas variáveis sem qualquer efeito — a conta já está criada e a
> password fica guardada com hash (bcrypt), nunca em texto simples.

Depois de definir as variáveis, faça um novo deploy (ou "Trigger deploy")
para garantir que as funções arrancam já com as variáveis disponíveis.

### 5. Primeiro acesso

1. Abra o URL do site gerado pelo Netlify.
2. Clique em **Área Reservada**.
3. Faça login com o **nome de utilizador** e a **password** definidos em
   `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
4. Será pedido para alterar a password no primeiro acesso
   (`forcarMudancaPassword`).
5. Em **Utilizadores** (menu da área reservada), pode criar contas para
   outros magistrados/funcionários, escolhendo o respetivo papel
   (administrador, redator, revisor, leitor).

### 6. Testar localmente (opcional)

```bash
npm install -g netlify-cli   # se ainda não tiver a CLI do Netlify
cp .env.example .env         # e edite com as suas credenciais
npm install
netlify dev
```

A CLI do Netlify simula tanto o site estático como as Functions e o
Netlify Blobs localmente.

---

## Papéis e permissões (RBAC) — sem alterações

| Papel | Permissões |
|---|---|
| **administrador** | Tudo: gerir utilizadores, leis, artigos, acórdãos, ver auditoria, importar, restaurar versões |
| **redator** | Gerir leis, artigos, acórdãos; importar documentos |
| **revisor** | Ver auditoria |
| **leitor** | Sem permissões de escrita (apenas navegação/pesquisa/favoritos) |

---

## Funcionalidades mantidas da versão anterior

- **Pesquisa por relevância** com expansão de sinónimos jurídicos
- **Exportação para PDF** (agora gerada diretamente em memória, sem ficheiros residuais)
- **Favoritos** por utilizador autenticado
- **Pesquisas guardadas** por utilizador
- **Vinculação automática** acórdão ↔ artigos referenciados (regex sobre o texto da decisão)
- **Histórico de versões** com restauro (antes de cada edição/eliminação)
- **Registo de auditoria** de todas as ações administrativas
- **RGPD**: direito ao apagamento/anonimização da própria conta
- **Importação em lote** de documentos (.docx, .txt, .md) com deteção automática de Título/Capítulo/Secção/Artigo
- **Acessibilidade (WCAG)**: skip link, `aria-*`, foco visível, `.sr-only`, landmarks semânticos

## O que mudou nesta migração (resumo)

1. **Login: email → nome de utilizador.** O campo de login na área
   reservada deixou de pedir email e passa a pedir um nome de
   utilizador (`username`), com password. O email deixou de ser
   credencial — é apenas um contacto opcional do utilizador.
2. **2FA removido nesta fase.** O código de verificação por email já
   não existe; o login é direto após validar utilizador + password.
3. **Hospedagem e base de dados:** Google Apps Script + Google Sheets
   → Netlify Functions + Netlify Blobs.
4. **PDF:** Google Docs/DocumentApp → geração direta com `pdfkit`.
