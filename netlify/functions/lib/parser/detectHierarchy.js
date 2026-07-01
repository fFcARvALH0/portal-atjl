'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/detectHierarchy.js
 * ════════════════════════════════════════════════════════════════════
 * Módulo central do parser: percorre as linhas do corpo do diploma
 * (já sem anexos) e reconstrói automaticamente a árvore jurídica
 * completa (Parte → Livro → Título → Subtítulo → Capítulo →
 * Subcapítulo → Secção → Subsecção → Divisão → Subdivisão → Artigo),
 * sem assumir que todos os níveis existem — cada diploma usa apenas os
 * níveis que tiver.
 *
 * Heurística principal: qualquer linha não reconhecida como cabeçalho
 * estrutural ou início de artigo pertence ao artigo aberto mais
 * recente (ou, antes do primeiro artigo, ao preâmbulo). Um cabeçalho
 * de nível N fecha automaticamente todos os níveis mais específicos
 * que N, mesmo que existam linhas em branco, paginação ou texto
 * intercalado entre o cabeçalho e o artigo seguinte.
 * ════════════════════════════════════════════════════════════════════
 */

const { NIVEIS } = require('./patterns');
const { detetarArtigo } = require('./detectArticles');
const { detetarTabelas } = require('./parseTables');
const { construirArvoreNumeros } = require('./parseNumbers');
const { gerarIdNo } = require('./helpers');

const ORDEM_RANKS = NIVEIS.slice().sort((a, b) => a.rank - b.rank).map((n) => n.chave);
const NIVEL_POR_CHAVE = Object.fromEntries(NIVEIS.map((n) => [n.chave, n]));

// Mapa para os nomes de campo "legacy" (compatibilidade com a UI/admin
// existente, que já consumia capNum/capTit/secNum/secTit/subSecNum/subSecTit
// e grupoTipo/grupoNum/grupoTit para o nível acima de Capítulo).
const CAMPO_LEGACY = {
  capitulo: 'cap', seccao: 'sec', subseccao: 'subSec'
};
// Níveis acima de Capítulo, do mais específico para o mais geral —
// o primeiro que estiver ativo torna-se o "grupo" legacy.
const NIVEIS_GRUPO_LEGACY = ['subtitulo', 'titulo', 'livro', 'parte'];

function analisarHierarquia(linhasComIndice, logger) {
  const raiz = { id: 'raiz', tipo: 'documento', titulo: null, numero: null, texto: null, parent: null, children: [] };

  // Tabelas do corpo (fora de anexos) são detetadas previamente para que
  // as suas linhas sejam ignoradas pelo scanner estrutural e anexadas
  // como metadata ao artigo (ou cabeçalho) mais próximo.
  const tabelas = detetarTabelas(linhasComIndice);
  const indiceParaTabela = new Map();
  tabelas.forEach((t) => { indiceParaTabela.set(t.inicioIndice, t); });
  const indicesDentroDeTabela = new Set();
  tabelas.forEach((t) => { for (let i = t.inicioIndice; i <= t.fimIndice; i++) indicesDentroDeTabela.add(i); });

  const contexto = {};       // chave de nível -> { num, tit }
  const pilhaNos = [];       // { chave, rank, no } — espelha `contexto` na árvore
  const noPai = () => (pilhaNos.length ? pilhaNos[pilhaNos.length - 1].no : raiz);

  function definirNivel(chave, num, tit) {
    const rank = NIVEL_POR_CHAVE[chave].rank;
    while (pilhaNos.length && pilhaNos[pilhaNos.length - 1].rank >= rank) pilhaNos.pop();
    ORDEM_RANKS.forEach((c) => { if (NIVEL_POR_CHAVE[c].rank > rank) delete contexto[c]; });
    contexto[chave] = { num, tit };
    const no = {
      id: gerarIdNo(), tipo: chave, numero: num, titulo: tit || null,
      texto: null, parent: noPai().id, children: [], metadata: {}
    };
    noPai().children.push(no);
    pilhaNos.push({ chave, rank, no });
    logger && logger.log('nivel', NIVEL_POR_CHAVE[chave].rotulo + ' ' + num + (tit ? ' — ' + tit : ''));
  }

  let artigoAtual = null;     // { meta..., linhasCorpo: [], tabelasAnexadas: [], no }
  let linhasPreambulo = [];
  const artigos = [];
  const tabelasSoltas = []; // tabelas que aparecem antes de qualquer artigo

  function finalizarArtigo() {
    if (!artigoAtual) return;
    const textoCompleto = artigoAtual.linhasCorpo.join('\n').trim();
    const { arvore: numeros, temEstrutura } = construirArvoreNumeros(artigoAtual.linhasCorpo);

    // Campos legacy (compatibilidade com public/js/admin.js, vistas.js, searchEngine.js)
    let grupoTipo = null, grupoNum = null, grupoTit = null;
    for (const chave of NIVEIS_GRUPO_LEGACY) {
      if (contexto[chave]) { grupoTipo = NIVEL_POR_CHAVE[chave].rotulo.toUpperCase(); grupoNum = contexto[chave].num; grupoTit = contexto[chave].tit; break; }
    }
    const capCtx = contexto.subcapitulo || contexto.capitulo;
    const secCtx = contexto.seccao;
    const subSecCtx = contexto.subseccao;

    const artigo = {
      id: gerarIdNo(),
      numero: artigoAtual.numero,
      titulo: artigoAtual.titulo,
      texto: textoCompleto,
      // legacy:
      grupoTipo, grupoNum, grupoTit,
      capNum: capCtx ? capCtx.num : null,
      capTit: capCtx ? capCtx.tit : null,
      secNum: secCtx ? secCtx.num : null,
      secTit: secCtx ? secCtx.tit : null,
      subSecNum: subSecCtx ? subSecCtx.num : null,
      subSecTit: subSecCtx ? subSecCtx.tit : null,
      // hierarquia completa (todos os níveis ativos, do mais geral ao mais específico):
      hierarquia: ORDEM_RANKS.filter((c) => contexto[c]).map((c) => ({
        tipo: c, rotulo: NIVEL_POR_CHAVE[c].rotulo, num: contexto[c].num, tit: contexto[c].tit
      })),
      numeroInfo: artigoAtual.numeroInfo,
      numeros: temEstrutura ? numeros : [],
      tabelas: artigoAtual.tabelasAnexadas,
      ordem: artigos.length,
      parentNoId: noPai().id
    };
    artigos.push(artigo);

    const noArtigo = {
      id: artigo.id, tipo: 'artigo', numero: artigo.numero, titulo: artigo.titulo,
      texto: textoCompleto, parent: noPai().id, children: numeros,
      metadata: { tabelas: artigoAtual.tabelasAnexadas, hierarquia: artigo.hierarquia }
    };
    noPai().children.push(noArtigo);

    artigoAtual = null;
  }

  for (const linha of linhasComIndice) {
    const idx = linha.indice;

    if (indicesDentroDeTabela.has(idx)) {
      if (indiceParaTabela.has(idx)) {
        const t = indiceParaTabela.get(idx);
        if (artigoAtual) artigoAtual.tabelasAnexadas.push(t);
        else tabelasSoltas.push(t);
        logger && logger.log('tabela', (t.linhas.length) + ' linha(s) × ' + (t.linhas[0] || []).length + ' coluna(s)');
      }
      continue;
    }

    const texto = linha.texto.trim();
    if (!texto) {
      if (artigoAtual) { artigoAtual.aguardandoEpigrafe = false; artigoAtual.linhasCorpo.push(''); }
      continue;
    }

    let casou = false;
    for (const nivel of NIVEIS) {
      const m = texto.match(nivel.regex);
      if (m) {
        finalizarArtigo();
        definirNivel(nivel.chave, m[1].trim(), (m[2] || '').trim());
        casou = true;
        break;
      }
    }
    if (casou) continue;

    const art = detetarArtigo(texto);
    if (art) {
      finalizarArtigo();
      artigoAtual = {
        numero: art.numero, titulo: art.titulo, numeroInfo: art.numeroInfo,
        linhasCorpo: [], tabelasAnexadas: [],
        // Quando a epígrafe não vem na mesma linha do número, é muito
        // frequente (DOCX/TXT/colado) que ocupe a linha imediatamente a
        // seguir, antes de uma linha em branco e do corpo do artigo.
        aguardandoEpigrafe: !art.titulo
      };
      logger && logger.log('artigo', art.numero + (art.titulo ? ' — ' + art.titulo : ''));
      continue;
    }

    if (artigoAtual) {
      if (artigoAtual.aguardandoEpigrafe) {
        artigoAtual.aguardandoEpigrafe = false;
        artigoAtual.titulo = linha.texto.trim();
        continue;
      }
      artigoAtual.linhasCorpo.push(linha.texto);
    } else {
      linhasPreambulo.push(linha.texto);
    }
  }
  finalizarArtigo();

  return {
    arvore: raiz,
    artigos,
    preambulo: linhasPreambulo.join('\n').trim(),
    tabelasSoltas
  };
}

module.exports = { analisarHierarquia, ORDEM_RANKS, NIVEL_POR_CHAVE };
