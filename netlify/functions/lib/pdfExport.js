'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/pdfExport.js  (equivalente a PdfExport.gs)
 * ════════════════════════════════════════════════════════════════════
 * MIGRAÇÃO GOOGLE APPS SCRIPT → NETLIFY:
 *   A versão Apps Script criava um Google Doc temporário
 *   (DocumentApp), exportava para PDF via Drive e eliminava o
 *   documento temporário. Não há DocumentApp/Drive disponíveis fora
 *   do ecossistema Google.
 *
 *   Substituído por geração de PDF diretamente em memória usando a
 *   biblioteca "pdfkit" (Node.js) — o PDF nunca chega a tocar disco
 *   nem precisa de nenhum recurso externo a ser limpo depois.
 * ════════════════════════════════════════════════════════════════════
 */

const PDFDocument = require('pdfkit');
const { APP_INFO } = require('./config');
const entities = require('./entities');

function _gerarPdfBuffer(montarConteudo) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 56 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      montarConteudo(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function _cabecalho(doc, linha1, linha2) {
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#C8102E').text(APP_INFO.nomeInstituicao);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1A1A1A').text(linha1);
  if (linha2) doc.font('Helvetica').fontSize(10).fillColor('#555555').text(linha2);
  doc.moveDown(0.5);
  doc.strokeColor('#DEDEDE').lineWidth(1).moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fillColor('#000000');
}

function _paragrafo(doc, texto, opts) {
  String(texto || '').split('\n').forEach((l) => {
    if (l.trim()) doc.font(opts && opts.italic ? 'Helvetica-Oblique' : 'Helvetica').fontSize(10.5).text(l, { align: 'justify' }).moveDown(0.15);
  });
}

function _seccao(doc, titulo) {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#C8102E').text(titulo);
  doc.fillColor('#000000').moveDown(0.2);
}

/* ── Corpo de cada tipo de documento ────────────────────────────────
   Extraído das funções de export individual para ser reaproveitado
   também na exportação em lote (cada documento do lote usa o mesmo
   "corpo" que usaria no seu PDF individual, apenas sem o cabeçalho
   institucional repetido a cada página — ver _cabecalhoLote). */
function _corpoLei(doc, lei, artigos) {
  if (lei.ementa) _paragrafo(doc, lei.ementa, { italic: true });
  artigos.forEach((a) => {
    _seccao(doc, a.numero + (a.titulo ? ' — ' + a.titulo : ''));
    _paragrafo(doc, a.texto || '');
    if (a.interpretacaoTexto) _paragrafo(doc, 'Interpretação do ' + APP_INFO.sigla + ': ' + a.interpretacaoTexto, { italic: true });
  });
}

function _corpoAcordao(doc, ac) {
  [['Sumário', ac.sumario], ['Factos Provados', ac.factos], ['Questões Jurídicas', ac.questoes], ['Fundamentação', ac.fundamentacao], ['Decisão', ac.decisao]]
    .forEach(([titulo, texto]) => {
      if (!texto) return;
      _seccao(doc, titulo);
      _paragrafo(doc, texto);
    });
}

async function exportarLeiParaPdf(id) {
  const lei = await entities.obterLei(id);
  if (!lei) throw new Error('Lei não encontrada.');
  const artigos = await entities.listarArtigos(id);

  const buffer = await _gerarPdfBuffer((doc) => {
    _cabecalho(doc, lei.numero + ' — ' + lei.titulo, 'Publicado em: ' + (lei.dataPublicacao || '—') + '  ·  Estado: ' + (lei.estado || '—'));
    _corpoLei(doc, lei, artigos);
  });

  return { ok: true, nomeFicheiro: lei.numero.replace(/[^\w.-]/g, '_') + '.pdf', base64: buffer.toString('base64') };
}

async function exportarAcordaoParaPdf(id) {
  const ac = await entities.obterAcordao(id);
  if (!ac) throw new Error('Acórdão não encontrado.');

  const buffer = await _gerarPdfBuffer((doc) => {
    _cabecalho(doc, ac.numero + ' — ' + ac.titulo, 'Data: ' + (ac.data || '—') + '  ·  Relator: ' + (ac.relator || '—'));
    _corpoAcordao(doc, ac);
  });

  return { ok: true, nomeFicheiro: ac.numero.replace(/[^\w.-]/g, '_') + '.pdf', base64: buffer.toString('base64') };
}

/* ── Exportação em lote ───────────────────────────────────────────
   Gera UM ÚNICO PDF combinado para uma seleção de leis ou de
   acórdãos (não é possível misturar os dois tipos no mesmo lote).
   Em vez de um .zip com vários ficheiros — o que exigiria uma
   dependência extra só para compressão — optou-se por um único PDF
   com página de capa/índice seguida de uma secção por documento,
   cada uma começando em página nova. Mantém a mesma filosofia do
   resto do ficheiro: tudo gerado em memória, só com "pdfkit".

   MAX_LOTE evita que uma seleção excessivamente grande arrisque
   esgotar o tempo/memória da function (e o payload de resposta, que
   vai em base64 dentro do JSON). */
const MAX_LOTE = 30;

async function exportarLoteParaPdf(tipo, ids) {
  if (tipo !== 'lei' && tipo !== 'acordao') throw new Error('Tipo inválido para exportação em lote.');
  if (!Array.isArray(ids) || !ids.length) throw new Error('Nenhum documento selecionado para exportação.');

  const idsUnicos = [...new Set(ids)].slice(0, MAX_LOTE);

  const itens = [];
  if (tipo === 'lei') {
    for (const id of idsUnicos) {
      const lei = await entities.obterLei(id);
      if (!lei) continue;
      const artigos = await entities.listarArtigos(id);
      itens.push({ ref: lei.numero + ' — ' + lei.titulo, lei, artigos });
    }
  } else {
    for (const id of idsUnicos) {
      const ac = await entities.obterAcordao(id);
      if (!ac) continue;
      itens.push({ ref: ac.numero + ' — ' + ac.titulo, ac });
    }
  }
  if (!itens.length) throw new Error('Nenhum dos documentos selecionados foi encontrado (poderão ter sido entretanto eliminados).');

  const tituloLote = tipo === 'lei' ? 'Exportação em Lote — Legislação' : 'Exportação em Lote — Jurisprudência';

  const buffer = await _gerarPdfBuffer((doc) => {
    // Capa + índice.
    _cabecalho(doc, tituloLote, itens.length + ' documento(s) · gerado em ' + new Date().toLocaleDateString('pt-PT'));
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1A1A1A').text('Índice');
    doc.moveDown(0.3);
    itens.forEach((it, i) => {
      doc.font('Helvetica').fontSize(10.5).fillColor('#000000').text((i + 1) + '. ' + it.ref);
    });

    // Um documento por página(s), cada um com o seu próprio cabeçalho.
    itens.forEach((it) => {
      doc.addPage();
      if (tipo === 'lei') {
        _cabecalho(doc, it.lei.numero + ' — ' + it.lei.titulo, 'Publicado em: ' + (it.lei.dataPublicacao || '—') + '  ·  Estado: ' + (it.lei.estado || '—'));
        _corpoLei(doc, it.lei, it.artigos);
      } else {
        _cabecalho(doc, it.ac.numero + ' — ' + it.ac.titulo, 'Data: ' + (it.ac.data || '—') + '  ·  Relator: ' + (it.ac.relator || '—'));
        _corpoAcordao(doc, it.ac);
      }
    });
  });

  const nomeFicheiro = 'lote_' + (tipo === 'lei' ? 'legislacao' : 'jurisprudencia') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
  return {
    ok: true,
    nomeFicheiro,
    base64: buffer.toString('base64'),
    incluidos: itens.length,
    pedidos: idsUnicos.length
  };
}

module.exports = { exportarLeiParaPdf, exportarAcordaoParaPdf, exportarLoteParaPdf };
