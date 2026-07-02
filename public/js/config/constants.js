/**
 * js/config/constants.js
 * Constantes globais da aplicação.
 * Centraliza todos os valores repetidos — nunca usar strings literais
 * dispersas no código. Importado por todos os módulos que necessitem.
 */

export const VISTAS = {
  HOME:              'home',
  LEGISLACAO:        'legislacao',
  LEI_DETALHE:       'lei-detalhe',
  JURISPRUDENCIA:    'jurisprudencia',
  ACORDAO_DETALHE:   'acordao-detalhe',
  PESQUISA:          'pesquisa',
  PRIVACIDADE:       'privacidade',
  ADMIN_LOGIN:       'admin-login',
  ADMIN_LEIS:        'admin-leis',
  ADMIN_ARTIGOS:     'admin-artigos',
  ADMIN_ACORDAOS:    'admin-acordaos',
  ADMIN_UTILIZADORES: 'admin-utilizadores',
  ADMIN_AUDITORIA:   'admin-auditoria',
  ADMIN_FAVORITOS:   'admin-favoritos',
  ADMIN_VERSOES:     'admin-versoes',
};

export const ROLES = {
  ADMIN:     'admin',
  EDITOR:    'editor',
  LEITOR:    'leitor',
};

export const ROLES_LABELS = {
  admin:  'Administrador',
  editor: 'Editor',
  leitor: 'Leitor',
};

export const ESTADO_LEI = {
  VIGENTE:  'vigente',
  REVOGADA: 'revogada',
  PARCIAL:  'parcial',
  SUSPENSA: 'suspensa',
};

export const ESTADO_LEI_LABELS = {
  vigente:  'Vigente',
  revogada: 'Revogada',
  parcial:  'Parcialmente Revogada',
  suspensa: 'Suspensa',
};

export const TIPO_ACORDAO_LABELS = {
  acordao: 'Acórdão',
  despacho: 'Despacho',
  sentenca: 'Sentença',
};

export const TOAST_DURACAO = {
  CURTO:  2500,
  NORMAL: 3500,
  LONGO:  6000,
};

export const DEBOUNCE_PESQUISA_MS = 300;

export const PAGINACAO_DEFAULT = 20;

export const PERMISSOES = {
  admin:  ['gerir_leis', 'gerir_artigos', 'gerir_acordaos', 'gerir_utilizadores',
           'ver_auditoria', 'importar', 'restaurar_versao'],
  editor: ['gerir_leis', 'gerir_artigos', 'gerir_acordaos', 'importar'],
  leitor: [],
};
