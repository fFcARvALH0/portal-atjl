'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/modules/pdf.js
 * ════════════════════════════════════════════════════════════════════
 * Geração de documentos PDF (leis completas e acórdãos) usando pdfkit.
 * ════════════════════════════════════════════════════════════════════
 */

const PDFDocument = require('pdfkit');
const { APP } = require('../config');
const { listarLeis, listarArtigos } = require('./legislation');
const { listarAcordaos } = require('./jurisprudence');
const { criarLogger } = require('../shared/logger');

const log = criarLogger('pdf');

/* ── Helpers de formatação ──────────────────────────────────────── */

function _cabecalho(doc, titulo) {
  doc.fontSize(18).font('Helvetica-Bold').text(APP.NOME || 'Portal Jurídico', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(14).font('Helvetica').text(titulo, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(0.7);
}

function _rodape(doc) {
  doc.fontSize(8).font('Helvetica')
    .text(
      `Gerado em ${new Date().toLocaleDateString('pt-PT')} — ${APP.NOME || 'Portal Jurídico'}`,
      50, doc.page.height - 40,
      { align: 'center', width: doc.page.width - 100 }
    );
}

function _texto(doc, label, valor) {
  if (!valor) return;
  doc.fontSize(10).font('Helvetica-Bold').text(label + ': ', { continued: true });
  doc.font('Helvetica').text(String(valor));
  doc.moveDown(0.2);
}

/* ── Exportações ─────────────────────────────────────────────────── */

/**
 * Gera PDF de uma lei com todos os seus artigos.
 * @param {string} leiId - ID da lei
 * @returns {Promise<Buffer>}
 */
async function exportarLei(leiId) {
  const leis = await listarLeis();
  const lei = leis.find((l) => l.id === leiId);
  if (!lei) throw new Error('Lei não encontrada.');

  const artigos = await listarArtigos(leiId);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => { log.info('PDF Lei gerado', { leiId }); resolve(Buffer.concat(buffers)); });
    doc.on('error', reject);

    _cabecalho(doc, `${lei.numero || ''} — ${lei.titulo || ''}`);
    _texto(doc, 'Ementa', lei.ementa);
    _texto(doc, 'Data', lei.data);
    _texto(doc, 'Publicação', lei.publicacao);
    doc.moveDown();

    if (artigos.length) {
      doc.fontSize(12).font('Helvetica-Bold').text('Artigos', { underline: true });
      doc.moveDown(0.5);
      artigos.forEach((a) => {
        doc.fontSize(11).font('Helvetica-Bold').text(`Artigo ${a.numero || ''}`);
        if (a.titulo) doc.fontSize(10).font('Helvetica-Oblique').text(a.titulo);
        doc.fontSize(10).font('Helvetica').text(a.texto || '', { lineGap: 2 });
        if (a.interpretacao) {
          doc.moveDown(0.3).fontSize(9).font('Helvetica-Oblique')
            .text('Interpretação: ' + a.interpretacao, { indent: 15 });
        }
        doc.moveDown(0.8);
        if (doc.y > doc.page.height - 120) doc.addPage();
      });
    } else {
      doc.fontSize(10).font('Helvetica-Oblique').text('Esta lei não tem artigos registados.');
    }

    _rodape(doc);
    doc.end();
  });
}

/**
 * Gera PDF de todos os acórdãos.
 * @returns {Promise<Buffer>}
 */
async function exportarAcordaos() {
  const acs = await listarAcordaos();
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => { log.info('PDF Acórdãos gerado', { total: acs.length }); resolve(Buffer.concat(buffers)); });
    doc.on('error', reject);

    _cabecalho(doc, 'Acórdãos — Jurisprudência');

    if (!acs.length) {
      doc.fontSize(11).text('Sem acórdãos registados.');
    } else {
      acs.forEach((ac, i) => {
        if (i > 0 && doc.y > doc.page.height - 200) doc.addPage();
        doc.fontSize(12).font('Helvetica-Bold').text(`${ac.numero || `Acórdão #${i + 1}`}`);
        _texto(doc, 'Data',    ac.data);
        _texto(doc, 'Relator', ac.relator);
        _texto(doc, 'Decisão', ac.decisao);
        if (ac.fundamentacao) {
          doc.fontSize(10).font('Helvetica-Bold').text('Fundamentação:');
          doc.font('Helvetica').text(ac.fundamentacao, { lineGap: 2 });
        }
        doc.moveDown(1.2);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).dash(3, { space: 3 }).stroke().undash();
        doc.moveDown(0.5);
      });
    }

    _rodape(doc);
    doc.end();
  });
}

module.exports = { exportarLei, exportarAcordaos };
