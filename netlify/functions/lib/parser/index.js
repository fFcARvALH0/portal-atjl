'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/index.js
 * ════════════════════════════════════════════════════════════════════
 * Ponto de entrada do parser de importação de diplomas jurídicos.
 * Orquestra, por esta ordem:
 *   1. sanitização/normalização do texto bruto (normalize.js)
 *   2. separação de anexos/apêndices (detectAnnexes.js)
 *   3. reconstrução da hierarquia + artigos (detectHierarchy.js)
 *   4. validação heurística, gerando avisos (validators.js)
 *   5. estatísticas e logs de execução
 *
 * Suporta texto extraído de DOCX, PDF, TXT, Markdown, HTML ou colado
 * diretamente — a normalização trata das diferenças entre origens
 * antes de qualquer deteção estrutural, pelo que este módulo nunca
 * precisa de saber de onde o texto veio.
 *
 * COMPATIBILIDADE: `analisarDocumento` mantém o nome e a assinatura
 * usados em netlify/functions/api.js, mas o valor devolvido passou a
 * ser um objeto rico { artigos, arvore, anexos, avisos, estatisticas }
 * em vez de apenas o array de artigos. Os artigos continuam a incluir
 * todos os campos "legacy" (numero, titulo, texto, grupoTipo, grupoNum,
 * grupoTit, capNum, capTit, secNum, secTit, subSecNum, subSecTit,
 * ordem) consumidos por public/js/admin.js, vistas.js, searchEngine.js
 * e pdfExport.js, por isso nada nesses ficheiros tem de mudar para
 * continuar a funcionar — só public/js/admin.js foi atualizado, para
 * tirar partido dos avisos/anexos/tabelas na pré-visualização da
 * importação.
 * ════════════════════════════════════════════════════════════════════
 */

const { sanitizarTexto } = require('../security');
const { normalizarTexto } = require('./normalize');
const { separarAnexos } = require('./detectAnnexes');
const { analisarHierarquia } = require('./detectHierarchy');
const { validarArtigos } = require('./validators');
const { criarLogger } = require('./helpers');

// Limite de tamanho do documento completo. Bem acima do limite genérico
// de campos de texto da app (LIMITES_TEXTO, pensado para campos curtos
// como ementas) porque aqui o input é o diploma inteiro — diplomas
// extensos (ex.: Código Civil) facilmente ultrapassam várias centenas
// de milhares de caracteres.
const LIMITE_DOCUMENTO = 6 * 1024 * 1024; // 6 MB de texto

function analisarDocumento(textoBruto, opcoes) {
  const opts = opcoes || {};
  const logger = criarLogger(opts.logs !== false);

  const textoLimpo = sanitizarTexto(textoBruto, LIMITE_DOCUMENTO);
  logger.log('inicio', textoLimpo.length + ' caracteres após sanitização.');

  const linhas = normalizarTexto(textoLimpo);
  logger.log('normalizacao', linhas.length + ' linha(s) após normalização.');

  const linhasComIndice = linhas.map((texto, indice) => ({ texto, indice }));
  const { corpo, anexos } = separarAnexos(linhasComIndice);
  if (anexos.length) logger.log('anexos', anexos.length + ' anexo(s)/apêndice(s) detetado(s).');

  const { arvore, artigos, preambulo, tabelasSoltas } = analisarHierarquia(corpo, logger);
  logger.log('artigos', artigos.length + ' artigo(s) detetado(s).');

  // Os anexos passam a constar da árvore como nós de topo, a seguir ao
  // corpo articulado, mantendo a árvore como a representação completa
  // e única do documento (corpo + anexos).
  anexos.forEach((an) => {
    arvore.children.push({
      id: an.id, tipo: 'anexo', numero: an.numero, titulo: (an.tipo + (an.numero ? ' ' + an.numero : '')) + (an.titulo ? ' — ' + an.titulo : ''),
      texto: an.texto, parent: arvore.id, children: [],
      metadata: { tabelas: an.tabelas, elementosSuporte: an.elementosSuporte }
    });
  });

  const avisos = validarArtigos(artigos);
  avisos.forEach((a) => logger.log('aviso:' + a.tipo, a.mensagem));

  const capitulos = new Set(artigos.map((a) => a.capNum).filter(Boolean));
  const seccoes = new Set(artigos.map((a) => a.secNum).filter(Boolean));
  const grupos = new Set(artigos.map((a) => (a.grupoTipo || '') + '|' + (a.grupoNum || '')).filter((k) => k !== '|'));
  const totalTabelas = artigos.reduce((n, a) => n + (a.tabelas ? a.tabelas.length : 0), 0)
    + tabelasSoltas.length
    + anexos.reduce((n, an) => n + an.tabelas.length, 0);

  const estatisticas = {
    totalArtigos: artigos.length,
    totalGrupos: grupos.size,
    totalCapitulos: capitulos.size,
    totalSeccoes: seccoes.size,
    totalAnexos: anexos.length,
    totalTabelas,
    totalAvisos: avisos.length,
    tempoMs: logger.tempoDecorridoMs()
  };
  logger.log('fim', 'Concluído em ' + estatisticas.tempoMs + 'ms.');

  return {
    artigos,
    arvore,
    preambulo,
    anexos,
    tabelasSoltas,
    avisos,
    estatisticas,
    logs: logger.eventos()
  };
}

module.exports = { analisarDocumento };
