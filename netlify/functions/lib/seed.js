'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/seed.js  (equivalente a SetupInicial.gs)
 * ════════════════════════════════════════════════════════════════════
 * MIGRAÇÃO GOOGLE APPS SCRIPT → NETLIFY:
 *   A versão Apps Script exigia executar manualmente a função
 *   `setupInicial()` no editor, uma única vez, para criar a
 *   Spreadsheet e o primeiro utilizador administrador.
 *
 *   No Netlify isso é substituído por uma inicialização automática e
 *   IDEMPOTENTE: sempre que a função da API arranca, verifica se já
 *   existe algum utilizador na tabela "utilizadores"; se não existir
 *   nenhum, cria o administrador inicial a partir das variáveis de
 *   ambiente ADMIN_USERNAME e ADMIN_PASSWORD configuradas no painel
 *   do Netlify (Site settings → Environment variables).
 *
 *   Também semeia os sinónimos jurídicos de exemplo, tal como o
 *   setupInicial original.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES, ROLES } = require('./config');
const { hashPassword } = require('./auth');

async function garantirSetupInicial() {
  const utilizadores = await db.listarTudo(STORES.UTILIZADORES);
  if (utilizadores.length === 0) {
    const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      console.warn('ADMIN_USERNAME/ADMIN_PASSWORD não definidos nas variáveis de ambiente do Netlify — nenhum administrador foi criado automaticamente.');
    } else {
      const hash = await hashPassword(password);
      await db.inserir(STORES.UTILIZADORES, {
        username,
        nome: 'Administrador Inicial',
        email: process.env.ADMIN_EMAIL || '',
        passwordHash: hash,
        role: ROLES.ADMINISTRADOR,
        ativo: true,
        criado: new Date().toISOString(),
        ultimoLogin: '',
        forcarMudancaPassword: true
      });
      console.log('Utilizador administrador inicial criado: ' + username);
    }
  }

  const sinonimos = await db.listarTudo(STORES.SINONIMOS);
  if (sinonimos.length === 0) {
    await db.inserirVarios(STORES.SINONIMOS, [
      { termo: 'furto', sinonimos: 'roubo,subtração,apropriação ilegítima' },
      { termo: 'homicídio', sinonimos: 'morte,assassínio,crime contra a vida' },
      { termo: 'contrato', sinonimos: 'acordo,convenção,ajuste' },
      { termo: 'recurso', sinonimos: 'apelação,impugnação,reclamação' },
      { termo: 'prazo', sinonimos: 'termo,período,tempo limite' }
    ]);
  }
}

module.exports = { garantirSetupInicial };
