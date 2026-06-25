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
 *
 * CORREÇÃO (BUG-04 / BUG-05):
 *   1. Uma flag de processo (_setupFeito) evita repetir as duas
 *      leituras a Netlify Blobs em todos os pedidos depois do
 *      primeiro sucesso nesta instância "warm" (BUG-05).
 *   2. Uma promise partilhada (_setupPromise) garante que, dentro do
 *      MESMO processo/instância, invocações concorrentes aguardam o
 *      mesmo setup em vez de cada uma fazer o seu próprio
 *      check-then-act (elimina a corrida descrita em BUG-04 quando
 *      várias invocações concorrentes caem na mesma instância).
 *   Nota honesta: se o Netlify arrancar DUAS instâncias "frias"
 *      verdadeiramente em paralelo (containers diferentes), ainda é
 *      teoricamente possível uma pequena janela de corrida entre
 *      processos distintos, porque o Netlify Blobs não oferece
 *      compare-and-swap/transações. Nesse caso residual, o pior
 *      cenário é ter 2 registos de admin com o mesmo username — a
 *      autenticação continua a funcionar (usa o primeiro encontrado).
 *      Para eliminar esse risco por completo, crie o admin inicial
 *      manualmente uma única vez em vez de depender só das variáveis
 *      de ambiente.
 * ════════════════════════════════════════════════════════════════════
 */

const db = require('./db');
const { STORES, ROLES } = require('./config');
const { hashPassword } = require('./auth');

let _setupFeito = false;
let _setupPromise = null;

async function garantirSetupInicial() {
  if (_setupFeito) return;
  if (_setupPromise) return _setupPromise;
  _setupPromise = _executarSetup();
  try {
    await _setupPromise;
  } finally {
    _setupPromise = null;
  }
}

async function _executarSetup() {
  const utilizadores = await db.listarTudo(STORES.UTILIZADORES);
  if (utilizadores.length > 0) {
    _setupFeito = true;
  } else {
    const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      console.warn('ADMIN_USERNAME/ADMIN_PASSWORD não definidos nas variáveis de ambiente do Netlify — nenhum administrador foi criado automaticamente.');
      // Marca como "feito" mesmo assim: evita repetir a leitura em cada
      // pedido nesta instância. Se as variáveis forem adicionadas depois,
      // um novo deploy (= nova instância/processo) volta a tentar.
      _setupFeito = true;
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
      _setupFeito = true;
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
