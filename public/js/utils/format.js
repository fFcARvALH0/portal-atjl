/**
 * js/utils/format.js
 * Utilitários de formatação e escape de dados.
 * Centraliza toda a lógica de apresentação: datas, texto, HTML, badges.
 */

/* ── HTML ────────────────────────────────────────────────────────── */

/**
 * Escapa caracteres HTML especiais para prevenir XSS.
 * Usar SEMPRE ao inserir dados do utilizador/API em innerHTML.
 * @param {*} str
 * @returns {string}
 */
export function h(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Converte quebras de linha em <br> (com escape HTML).
 */
export function nl2br(str) {
  return h(str).replace(/\n/g, '<br>');
}

/**
 * Trunca texto a um máximo de caracteres, adicionando "…".
 */
export function truncar(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/* ── Datas ───────────────────────────────────────────────────────── */

const _fmt = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});
const _fmtLongo = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: 'long', year: 'numeric'
});
const _fmtHora = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

/**
 * Formata uma data ISO para DD/MM/AAAA.
 */
export function formatarData(iso) {
  if (!iso) return '—';
  try { return _fmt.format(new Date(iso)); }
  catch { return String(iso).slice(0, 10); }
}

/**
 * Formata uma data ISO para "DD de mês de AAAA".
 */
export function formatarDataLonga(iso) {
  if (!iso) return '—';
  try { return _fmtLongo.format(new Date(iso)); }
  catch { return String(iso).slice(0, 10); }
}

/**
 * Formata uma data ISO para DD/MM/AAAA HH:MM.
 */
export function formatarDataHora(iso) {
  if (!iso) return '—';
  try { return _fmtHora.format(new Date(iso)); }
  catch { return String(iso).slice(0, 16); }
}

/* ── Badges / Labels ─────────────────────────────────────────────── */

const _ESTADO_LEI_COR = {
  vigente: 'verde', revogada: 'vermelho', parcial: 'laranja', suspensa: 'cinza'
};
const _ESTADO_LEI_LABEL = {
  vigente: 'Vigente', revogada: 'Revogada', parcial: 'Parcialmente Revogada', suspensa: 'Suspensa'
};

export function badgeEstadoLei(estado) {
  const cor   = _ESTADO_LEI_COR[estado]   || 'cinza';
  const label = _ESTADO_LEI_LABEL[estado] || h(estado) || '—';
  return `<span class="badge badge-${cor}">${label}</span>`;
}

const _TIPO_ACORDAO_LABEL = {
  acordao: 'Acórdão', despacho: 'Despacho', sentenca: 'Sentença'
};

export function badgeTipoAcordao(tipo) {
  const label = _TIPO_ACORDAO_LABEL[tipo] || h(tipo) || 'Acórdão';
  return `<span class="badge badge-azul">${label}</span>`;
}

export function badgeRole(role) {
  const cores  = { admin: 'vermelho', editor: 'azul', leitor: 'cinza' };
  const labels = { admin: 'Admin', editor: 'Editor', leitor: 'Leitor' };
  return `<span class="badge badge-${cores[role] || 'cinza'}">${labels[role] || h(role)}</span>`;
}

/* ── Texto ───────────────────────────────────────────────────────── */

/**
 * Normaliza texto para comparação/pesquisa (minúsculas, sem acentos).
 */
export function normalizar(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Destaca ocorrências de um termo numa string (com escape HTML).
 */
export function destacar(texto, termo) {
  if (!termo) return h(texto);
  const escapado = h(texto);
  const regex = new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapado.replace(regex, '<mark>$1</mark>');
}

/**
 * Pluraliza uma palavra: ex: pluralizar(1, 'lei', 'leis') → '1 lei'
 */
export function pluralizar(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/* ── Números ─────────────────────────────────────────────────────── */

export function formatarNumero(n) {
  return new Intl.NumberFormat('pt-PT').format(n);
}
