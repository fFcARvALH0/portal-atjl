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

async function exportarLeiParaPdf(id) {
  const lei = await entities.obterLei(id);
  if (!lei) throw new Error('Lei não encontrada.');
  const artigos = await entities.listarArtigos(id);

  const buffer = await _gerarPdfBuffer((doc) => {
    _cabecalho(doc, lei.numero + ' — ' + lei.titulo, 'Publicado em: ' + (lei.dataPublicacao || '—') + '  ·  Estado: ' + (lei.estado || '—'));
    if (lei.ementa) _paragrafo(doc, lei.ementa, { italic: true });
    artigos.forEach((a) => {
      _seccao(doc, a.numero + (a.titulo ? ' — ' + a.titulo : ''));
      _paragrafo(doc, a.texto || '');
      if (a.interpretacaoTexto) _paragrafo(doc, 'Interpretação do ' + APP_INFO.sigla + ': ' + a.interpretacaoTexto, { italic: true });
    });
  });

  return { ok: true, nomeFicheiro: lei.numero.replace(/[^\w.-]/g, '_') + '.pdf', base64: buffer.toString('base64') };
}

async function exportarAcordaoParaPdf(id) {
  const ac = await entities.obterAcordao(id);
  if (!ac) throw new Error('Acórdão não encontrado.');

  const buffer = await _gerarPdfBuffer((doc) => {
    _cabecalho(doc, ac.numero + ' — ' + ac.titulo, 'Data: ' + (ac.data || '—') + '  ·  Relator: ' + (ac.relator || '—'));
    [['Sumário', ac.sumario], ['Factos Provados', ac.factos], ['Questões Jurídicas', ac.questoes], ['Fundamentação', ac.fundamentacao], ['Decisão', ac.decisao]]
      .forEach(([titulo, texto]) => {
        if (!texto) return;
        _seccao(doc, titulo);
        _paragrafo(doc, texto);
      });
  });

  return { ok: true, nomeFicheiro: ac.numero.replace(/[^\w.-]/g, '_') + '.pdf', base64: buffer.toString('base64') };
}

module.exports = { exportarLeiParaPdf, exportarAcordaoParaPdf };
