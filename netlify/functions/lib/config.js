'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/config.js  (equivalente a Config.gs no projeto Apps Script original)
 * ════════════════════════════════════════════════════════════════════
 * Constantes da aplicação: identidade institucional, nomes das
 * "tabelas" (stores de Netlify Blobs), papéis (RBAC) e parâmetros
 * de segurança.
 *
 * MIGRAÇÃO GOOGLE APPS SCRIPT → NETLIFY:
 *   - getSpreadsheet()/PropertiesService deixam de existir; o
 *     SPREADSHEET_ID foi substituído por stores do Netlify Blobs
 *     (ver lib/db.js).
 * ════════════════════════════════════════════════════════════════════
 */

const APP_INFO = {
  nomeInstituicao: 'Supremo Tribunal de Justiça',
  sigla: 'STJ',
  pais: 'República Portucalense',
  lema: 'Pela Defesa do Direito e da Justiça',
  portalNome: 'Portal de Legislação e Jurisprudência'
};

/** Nomes das "tabelas" (cada uma é um store de Netlify Blobs). */
const STORES = {
  LEIS: 'leis',
  ARTIGOS: 'artigos',
  ACORDAOS: 'acordaos',
  UTILIZADORES: 'utilizadores',
  AUDITORIA: 'auditoria',
  VERSOES: 'versoes',
  FAVORITOS: 'favoritos',
  PESQUISAS_GUARDADAS: 'pesquisas_guardadas',
  SINONIMOS: 'sinonimos',
  RELACOES: 'relacoes',
  SESSOES: 'sessoes' // substitui o CacheService do Apps Script
};

const ROLES = {
  ADMINISTRADOR: 'administrador',
  REDATOR: 'redator',
  REVISOR: 'revisor',
  LEITOR: 'leitor'
};

const PERMISSOES = {
  [ROLES.ADMINISTRADOR]: ['gerir_utilizadores', 'gerir_leis', 'gerir_artigos', 'gerir_acordaos', 'ver_auditoria', 'importar', 'restaurar_versao'],
  [ROLES.REDATOR]: ['gerir_leis', 'gerir_artigos', 'gerir_acordaos', 'importar'],
  [ROLES.REVISOR]: ['ver_auditoria'],
  [ROLES.LEITOR]: []
};

const SEGURANCA = {
  SESSAO_DURACAO_SEG: 6 * 60 * 60,
  MAX_TENTATIVAS_LOGIN: 5,
  BLOQUEIO_LOGIN_SEG: 15 * 60,
  CACHE_LISTAS_TTL_SEG: 5 * 60
};

const LIMITES_TEXTO = {
  curto: 300,
  medio: 3000,
  longo: 20000
};

module.exports = { APP_INFO, STORES, ROLES, PERMISSOES, SEGURANCA, LIMITES_TEXTO };
