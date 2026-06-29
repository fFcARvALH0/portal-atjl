'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/auth.js  (equivalente a Auth.gs)
 * ════════════════════════════════════════════════════════════════════
 * ALTERAÇÕES NESTA MIGRAÇÃO:
 *   1. Login passa a ser por NOME DE UTILIZADOR (username) + password,
 *      em vez de email + password. O campo "email" deixou de ser a
 *      credencial de login — passa a ser apenas um contacto opcional
 *      do utilizador (pode ficar vazio).
 *   2. A autenticação de dois fatores (2FA) por email foi REMOVIDA
 *      nesta fase (decisão do cliente), porque deixou de existir
 *      MailApp/Gmail disponível de origem no Netlify. O login passa a
 *      ser apenas username + password, num único passo.
 *   3. Hashing de password: SHA-256+salt manual (Apps Script) foi
 *      substituído por bcrypt (bcryptjs), um algoritmo dedicado a
 *      passwords, com custo computacional ajustável e salt embutido.
 *   4. CacheService (sessões, bloqueios) foi substituído por uma
 *      tabela "sessoes" em Netlify Blobs com expiração controlada
 *      manualmente (ver _sessaoExpirada).
 *
 * Mantido: sessões com token + CSRF, bloqueio temporário após várias
 * tentativas falhadas, RBAC (requerPermissao).
 *
 * CORREÇÕES NESTA REVISÃO:
 *   - BUG-06: a store "sessoes" acumulava sessões expiradas, tentativas
 *     falhadas e bloqueios para sempre. Foi adicionada uma purga
 *     "lazy" (_purgarSessoesExpiradas), com um intervalo mínimo entre
 *     execuções para não sobrecarregar o Netlify Blobs com escritas.
 *   - BUG-07: `criarUtilizador`/`alterarRoleUtilizador` aceitavam
 *     qualquer valor de `role`. Agora validam contra ROLES.
 *   - Bónus: `validarUsername` (lib/security.js) estava definida mas
 *     nunca era importada/usada — `criarUtilizador` aceitava qualquer
 *     string como nome de utilizador. Agora é validada.
 * ════════════════════════════════════════════════════════════════════
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');
const { STORES, SEGURANCA, ROLES, PERMISSOES } = require('./config');
const { logarAuditoria } = require('./audit');
const { validarUsername } = require('./security');

const SALT_ROUNDS = 10;
const ROLES_VALIDOS = Object.values(ROLES);

/**
 * Valida a complexidade de uma password.
 * Retorna null se válida, ou uma string com a mensagem de erro.
 */
function _validarComplexidadePassword(password) {
  const pw = String(password || '');
  if (pw.length < 10) return 'A password deve ter pelo menos 10 caracteres.';
  if (!/[A-Z]/.test(pw)) return 'A password deve conter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(pw)) return 'A password deve conter pelo menos uma letra minúscula.';
  if (!/[0-9]/.test(pw)) return 'A password deve conter pelo menos um número.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'A password deve conter pelo menos um carácter especial (ex: !@#$%).';
  return null;
}

function _roleValido(role) {
  return ROLES_VALIDOS.indexOf(role) !== -1;
}

/* ── Purga de sessões/tentativas/bloqueios expirados (BUG-06) ─────
   Em vez de uma Netlify Scheduled Function separada (que exigiria um
   novo ficheiro/cron fora do âmbito desta correção), a purga corre de
   forma "lazy": é despoletada pelas operações mais frequentes
   (obterSessao, autenticar) mas só executa de facto, no máximo, uma
   vez a cada INTERVALO_LIMPEZA_MS por instância — evita transformar
   cada pedido num "ler tudo + escrever tudo" na store de sessões. */
let _ultimaLimpeza = 0;
const INTERVALO_LIMPEZA_MS = 10 * 60 * 1000; // 10 minutos

async function _purgarSessoesExpiradas() {
  const agora = Date.now();
  if (agora - _ultimaLimpeza < INTERVALO_LIMPEZA_MS) return;
  _ultimaLimpeza = agora;
  try {
    const lista = await db.listarTudo(STORES.SESSOES);
    const validas = lista.filter((s) => !s.expiraEm || agora <= s.expiraEm);
    if (validas.length < lista.length) {
      await db.gravarTudo(STORES.SESSOES, validas);
    }
  } catch (e) {
    // A purga nunca deve impedir login/verificação de sessão de funcionar.
    console.error('Falha ao purgar sessões expiradas:', e.message);
  }
}

/* ── Hashing de password ───────────────────────────────────────── */

async function hashPassword(password) {
  return bcrypt.hash(String(password), SALT_ROUNDS);
}

async function verificarPassword(password, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(String(password), hash);
  } catch (e) {
    return false;
  }
}

/* ── Bloqueio por tentativas falhadas (substitui _cache do Apps Script) ── */

async function _getBloqueio(username) {
  const lista = await db.listarTudo(STORES.SESSOES);
  const item = lista.find((s) => s.tipo === 'bloqueio' && s.username === username);
  if (!item) return null;
  if (Date.now() > item.expiraEm) return null;
  return item;
}

async function _registarTentativaFalhada(username) {
  const lista = await db.listarTudo(STORES.SESSOES);
  let item = lista.find((s) => s.tipo === 'tentativas' && s.username === username);
  const agora = Date.now();
  if (!item || agora > item.expiraEm) {
    item = { id: db.gerarId(), tipo: 'tentativas', username, contagem: 0, expiraEm: agora + SEGURANCA.BLOQUEIO_LOGIN_SEG * 1000 };
    lista.push(item);
  }
  item.contagem += 1;
  let bloqueado = false;
  if (item.contagem >= SEGURANCA.MAX_TENTATIVAS_LOGIN) {
    lista.push({ id: db.gerarId(), tipo: 'bloqueio', username, expiraEm: agora + SEGURANCA.BLOQUEIO_LOGIN_SEG * 1000 });
    bloqueado = true;
  }
  await db.gravarTudo(STORES.SESSOES, lista);
  return { contagem: item.contagem, bloqueado };
}

async function _limparTentativas(username) {
  const lista = await db.listarTudo(STORES.SESSOES);
  const restantes = lista.filter((s) => !(s.tipo === 'tentativas' && s.username === username));
  await db.gravarTudo(STORES.SESSOES, restantes);
}

/* ── Login ─────────────────────────────────────────────────────── */

async function autenticar(username, password) {
  username = String(username || '').trim().toLowerCase();

  await _purgarSessoesExpiradas();

  const bloqueio = await _getBloqueio(username);
  if (bloqueio) {
    return { ok: false, erro: 'Conta temporariamente bloqueada por demasiadas tentativas falhadas. Tente novamente mais tarde.' };
  }

  const utilizadores = await db.listarTudo(STORES.UTILIZADORES);
  const user = utilizadores.find((u) => String(u.username).toLowerCase() === username);

  const falhar = async () => {
    const r = await _registarTentativaFalhada(username);
    if (r.bloqueado) {
      await logarAuditoria(username, 'login_bloqueado', 'Utilizador', username, 'Conta bloqueada após ' + r.contagem + ' tentativas falhadas.');
    }
    return { ok: false, erro: 'Credenciais inválidas.' };
  };

  if (!user || user.ativo === false) return falhar();
  const passwordValida = await verificarPassword(password, user.passwordHash);
  if (!passwordValida) return falhar();

  await _limparTentativas(username);
  return _criarSessao(user);
}

async function _criarSessao(user) {
  const token = crypto.randomUUID();
  const csrf = crypto.randomUUID();
  const sessao = {
    id: db.gerarId(),
    tipo: 'sessao',
    token,
    username: user.username,
    nome: user.nome,
    role: user.role,
    csrf,
    expiraEm: Date.now() + SEGURANCA.SESSAO_DURACAO_SEG * 1000
  };
  await db.inserir(STORES.SESSOES, sessao);

  await db.atualizar(STORES.UTILIZADORES, 'username', user.username, { ultimoLogin: new Date().toISOString() });

  await logarAuditoria(user.username, 'login_sucesso', 'Utilizador', user.username, 'Sessão iniciada.');
  return {
    ok: true,
    token,
    csrf,
    utilizador: { username: user.username, nome: user.nome, role: user.role, email: user.email || '' },
    forcarMudancaPassword: user.forcarMudancaPassword === true
  };
}

async function obterSessao(token) {
  if (!token) return null;
  await _purgarSessoesExpiradas();
  const lista = await db.listarTudo(STORES.SESSOES);
  const sessao = lista.find((s) => s.tipo === 'sessao' && s.token === token);
  if (!sessao) return null;
  if (Date.now() > sessao.expiraEm) return null;
  return sessao;
}

async function terminarSessao(token) {
  const sessao = await obterSessao(token);
  if (sessao) await logarAuditoria(sessao.username, 'logout', 'Utilizador', sessao.username, 'Sessão terminada.');
  await db.remover(STORES.SESSOES, 'token', token);
  return { ok: true };
}

/** Lança erro se a sessão não existir, o CSRF não corresponder, ou a permissão não estiver atribuída ao papel. */
async function requerPermissao(token, csrf, permissao) {
  const sessao = await obterSessao(token);
  if (!sessao) throw new Error('Sessão inválida ou expirada. Inicie sessão novamente.');
  if (csrf !== sessao.csrf) throw new Error('Token de segurança inválido (CSRF). Recarregue a página.');
  if (permissao && (PERMISSOES[sessao.role] || []).indexOf(permissao) === -1) {
    throw new Error('Não tem permissão para executar esta ação.');
  }
  return sessao;
}

async function alterarPassword(token, csrf, passwordAtual, passwordNova) {
  const sessao = await requerPermissao(token, csrf, null);
  const utilizadores = await db.listarTudo(STORES.UTILIZADORES);
  const user = utilizadores.find((u) => u.username === sessao.username);
  if (!user) throw new Error('Utilizador não encontrado.');
  const valida = await verificarPassword(passwordAtual, user.passwordHash);
  if (!valida) return { ok: false, erro: 'Password atual incorreta.' };
  const erroComplexidade = _validarComplexidadePassword(passwordNova);
  if (erroComplexidade) return { ok: false, erro: erroComplexidade };
  const novoHash = await hashPassword(passwordNova);
  await db.atualizar(STORES.UTILIZADORES, 'username', sessao.username, { passwordHash: novoHash, forcarMudancaPassword: false });
  await logarAuditoria(sessao.username, 'alterar_password', 'Utilizador', sessao.username, 'Password alterada pelo próprio utilizador.');
  return { ok: true };
}

/* ── Gestão de utilizadores (apenas administradores) ─────────────── */

async function listarUtilizadores(token, csrf) {
  await requerPermissao(token, csrf, 'gerir_utilizadores');
  const lista = await db.listarTudo(STORES.UTILIZADORES);
  return lista.map((u) => ({
    username: u.username, nome: u.nome, email: u.email || '', role: u.role,
    ativo: u.ativo, ultimoLogin: u.ultimoLogin
  }));
}

async function criarUtilizador(token, csrf, dados) {
  const sessao = await requerPermissao(token, csrf, 'gerir_utilizadores');
  const username = String(dados.username || '').trim().toLowerCase();
  if (!username) return { ok: false, erro: 'Indique um nome de utilizador.' };
  if (!validarUsername(username)) {
    return { ok: false, erro: 'Nome de utilizador inválido. Use 3-40 caracteres: letras, números, ponto, underscore ou hífen.' };
  }
  if (dados.role && !_roleValido(dados.role)) {
    return { ok: false, erro: 'Papel de utilizador inválido. Use um de: ' + ROLES_VALIDOS.join(', ') + '.' };
  }

  const existentes = await db.listarTudo(STORES.UTILIZADORES);
  if (existentes.some((u) => String(u.username).toLowerCase() === username)) {
    return { ok: false, erro: 'Já existe um utilizador com esse nome de utilizador.' };
  }

  const passwordTemp = dados.password || gerarPasswordTemporaria();
  if (dados.password) {
    const erroComplexidade = _validarComplexidadePassword(dados.password);
    if (erroComplexidade) return { ok: false, erro: erroComplexidade };
  }
  const hash = await hashPassword(passwordTemp);
  await db.inserir(STORES.UTILIZADORES, {
    username,
    nome: dados.nome || username,
    email: dados.email || '',
    passwordHash: hash,
    role: dados.role || ROLES.LEITOR,
    ativo: true,
    criado: new Date().toISOString(),
    ultimoLogin: '',
    forcarMudancaPassword: true
  });

  await logarAuditoria(sessao.username, 'criar', 'Utilizador', username, 'Utilizador "' + username + '" criado com papel "' + dados.role + '".');
  // Devolve a password temporária na resposta (não há envio de email
  // automático nesta fase) para que o administrador a comunique ao
  // novo utilizador por um canal seguro à sua escolha.
  return { ok: true, passwordTemporaria: passwordTemp };
}

async function alterarRoleUtilizador(token, csrf, username, novoRole, ativo) {
  const sessao = await requerPermissao(token, csrf, 'gerir_utilizadores');
  if (novoRole && !_roleValido(novoRole)) {
    return { ok: false, erro: 'Papel de utilizador inválido. Use um de: ' + ROLES_VALIDOS.join(', ') + '.' };
  }
  const atualizado = await db.atualizar(STORES.UTILIZADORES, 'username', username, {
    ...(novoRole ? { role: novoRole } : {}),
    ...(ativo !== undefined ? { ativo } : {})
  });
  if (!atualizado) return { ok: false, erro: 'Utilizador não encontrado.' };
  await logarAuditoria(sessao.username, 'editar', 'Utilizador', username, 'Papel/estado de "' + username + '" atualizado.');
  return { ok: true };
}

function gerarPasswordTemporaria() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 14; i++) pw += alfabeto.charAt(crypto.randomInt(alfabeto.length));
  return pw;
}

module.exports = {
  hashPassword, verificarPassword,
  autenticar, obterSessao, terminarSessao, requerPermissao, alterarPassword,
  listarUtilizadores, criarUtilizador, alterarRoleUtilizador,
  gerarPasswordTemporaria
};
