/**
 * js/modules/admin/laws/import.js
 * Admin: importação de documentos (wizard 3 passos).
 */
import * as api from '../../../services/api.js';
import { h } from '../../../utils/format.js';

function _wiz(s1, s2, s3) {
  const icone = (s) => s === 'done' ? '✓' : s === 'active' ? '●' : '○';
  return `<div class="wiz-steps">
    <div class="wiz-step ${s1}"><div class="step-n">${s1 === 'done' ? '✓' : '1'}</div>Origem</div>
    <div class="wiz-step ${s2}"><div class="step-n">${s2 === 'done' ? '✓' : '2'}</div>Pré-visualização</div>
    <div class="wiz-step ${s3}"><div class="step-n">3</div>Confirmar</div>
  </div>`;
}

export async function renderImportar(estado) {
  const leis  = await api.listarLeis();
  const step  = estado.importStep || 1;
  const leiId = estado.importLeiId || estado._leiId || (leis[0] ? leis[0].id : null);
  const optLeis = leis.map((l) =>
    `<option value="${h(l.id)}"${l.id === leiId ? ' selected' : ''}>${h(l.numero)} — ${h(l.titulo)}</option>`
  ).join('');

  if (step === 1) {
    return `<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Importar Documento</span></div>
      ${_wiz('active','','')}
      <div class="adm-body">
        ${!leis.length ? '<div style="background:var(--orange-bg);padding:.75rem;font-size:12.5px;color:var(--orange);border:1px solid rgba(191,54,12,.2);margin-bottom:1rem">⚠ Crie primeiro uma lei em "Nova Lei".</div>' : ''}
        <div class="f-row"><label for="imp-lei">Lei de Destino *</label>
          <select id="imp-lei" onchange="STJ.estado.importLeiId=this.value">${optLeis}</select></div>
        <div class="drop-zone" id="drop-zone" role="button" tabindex="0"
          aria-label="Arraste um ficheiro ou clique para selecionar"
          onclick="document.getElementById('file-input').click()"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="STJ.admin._handleDrop(event)">
          <div style="font-size:36px;margin-bottom:.6rem" aria-hidden="true">📄</div>
          <p><strong>Arraste o ficheiro aqui</strong> ou clique para selecionar</p>
          <small>Suporta: .docx · .txt · .md · .pdf — Máximo 10 MB</small>
        </div>
        <input type="file" id="file-input" accept=".docx,.txt,.md,.text,.pdf"
          onchange="STJ.admin._handleFileSelect(event)">
        <div class="or-div">ou cole o texto diretamente</div>
        <div class="f-row"><label for="imp-text">Texto do Documento</label>
          <textarea id="imp-text" rows="12"
            placeholder="TÍTULO I — Das Disposições Gerais&#10;Artigo 1.º&#10;Âmbito&#10;1. A presente lei..."></textarea></div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-red btn-lg" onclick="STJ.admin._importarPasso2()"
            ${!leis.length ? 'disabled' : ''}>Analisar Documento →</button>
          <button class="btn btn-outline" onclick="STJ.admin.nav('leis-list')">Cancelar</button>
        </div>
      </div>
    </div>`;
  }

  if (step === 2) {
    const pr     = estado.importParseResult || {};
    const parsed = pr.artigos || [];
    const avisos = pr.avisos  || [];
    const stats  = pr.estatisticas || {};
    const lei    = leis.find((l) => l.id === leiId);

    let avisosHTML = '';
    if (avisos.length) {
      avisosHTML = '<div class="import-avisos">' +
        avisos.filter((a) => a.severidade === 'erro').map((a) => `<div class="aviso aviso-erro">❌ ${h(a.mensagem)}</div>`).join('') +
        avisos.filter((a) => a.severidade === 'aviso').map((a) => `<div class="aviso aviso-warn">⚠ ${h(a.mensagem)}</div>`).join('') +
        avisos.filter((a) => a.severidade === 'info').map((a) => `<div class="aviso aviso-info">ℹ ${h(a.mensagem)}</div>`).join('') +
        '</div>';
    }

    let grHTML = '', ultiGr = null;
    parsed.forEach((a) => {
      const grKey = (a.grupoTipo || '') + '|' + (a.grupoNum || '') + '|' + (a.capNum || '');
      if (grKey !== ultiGr) {
        if (ultiGr !== null) grHTML += '</div>';
        const lbl = a.grupoTipo
          ? (a.grupoTipo + ' ' + (a.grupoNum || '') + (a.grupoTit ? ' — ' + a.grupoTit : ''))
          : (a.capNum ? ('Capítulo ' + a.capNum + (a.capTit ? ' — ' + a.capTit : '')) : 'Artigos gerais');
        grHTML += `<div class="pp-group"><div class="pp-group-hd"><span style="font-size:12.5px;font-weight:700;color:var(--charcoal)">📂 ${h(lbl)}</span></div>`;
        ultiGr = grKey;
      }
      grHTML += `<div class="pp-art">
        <span class="pp-art-n">${h(a.numero)}</span>
        <div>
          <div style="font-size:12px;color:var(--dark)">${h(a.titulo || '(sem epígrafe)')}</div>
          <div style="font-size:11px;color:var(--muted)">${h((a.texto || '').substring(0, 120))}${a.texto && a.texto.length > 120 ? '…' : ''}</div>
        </div>
      </div>`;
    });
    if (ultiGr !== null) grHTML += '</div>';

    let anexosHTML = '';
    if ((pr.anexos || []).length) {
      anexosHTML = `<div style="margin:0 0 .75rem;padding:.6rem .8rem;background:var(--blue-bg,#eef2ff);border-radius:6px;font-size:12.5px">
        📎 <strong>${pr.anexos.length} Anexo(s)</strong> detetado(s):
        ${pr.anexos.map((an) => h((an.tipo || 'ANEXO') + (an.numero ? ' ' + an.numero : '') + (an.titulo ? ' — ' + an.titulo : ''))).join(', ')}
      </div>`;
    }

    return `<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Importar Documento</span></div>
      ${_wiz('done','active','')}
      <div class="parse-stats">
        <span class="pstat">Lei: <strong>${h(lei ? lei.titulo : '—')}</strong></span>
        <span class="pstat">Artigos: <strong>${stats.totalArtigos || 0}</strong></span>
        <span class="pstat">Capítulos: <strong>${stats.totalCapitulos || 0}</strong></span>
        ${stats.totalSeccoes ? `<span class="pstat">Secções: <strong>${stats.totalSeccoes}</strong></span>` : ''}
        <span class="pstat" style="color:var(--muted)">⏱ ${stats.tempoMs || 0}ms</span>
      </div>
      ${avisosHTML}
      ${parsed.length
        ? `${anexosHTML}<div class="parse-preview">${grHTML}</div>`
        : '<div style="padding:1.5rem;background:var(--orange-bg);color:var(--orange);font-size:13px">⚠ Nenhum artigo detetado.</div>'}
      <div style="padding:1rem;display:flex;gap:.5rem">
        <button class="btn btn-outline" onclick="STJ.estado.importStep=1;STJ.render()">‹ Voltar</button>
        ${parsed.length ? '<button class="btn btn-red btn-lg" onclick="STJ.estado.importStep=3;STJ.render()">Confirmar Estrutura →</button>' : ''}
      </div>
    </div>`;
  }

  if (step === 3) {
    const lei3     = leis.find((l) => l.id === leiId);
    const total3   = ((estado.importParseResult || {}).artigos || []).length;
    return `<div class="adm-panel"><div class="adm-hd"><span class="adm-title">Importar Documento</span></div>
      ${_wiz('done','done','active')}
      <div class="adm-body">
        <div style="background:#FAFAFA;border:1px solid var(--border);border-left:4px solid var(--red);padding:1.1rem;margin-bottom:1rem;font-size:13.5px;line-height:1.8">
          Lei: <strong>${h(lei3 ? lei3.titulo : '—')}</strong><br>
          Artigos a importar: <strong>${total3}</strong><br>
          <span style="color:var(--orange)">⚠ Qualquer artigo existente será <strong>substituído</strong>.</span>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-outline btn-lg" onclick="STJ.estado.importStep=2;STJ.render()">‹ Rever</button>
          <button class="btn btn-red btn-lg" onclick="STJ.admin._confirmarImport()">✅ Importar ${total3} Artigos</button>
        </div>
      </div>
    </div>`;
  }
  return '';
}

export async function handleImportarPasso2() {
  const leiId = (document.getElementById('imp-lei') || {}).value || STJ.estado.importLeiId;
  if (!leiId) { STJ.toast('Selecione uma lei de destino.'); return; }
  const txt = (document.getElementById('imp-text') || {}).value || '';
  if (!txt.trim()) { STJ.toast('Introduza o texto ou carregue um ficheiro.'); return; }
  STJ.estado.importLeiId = leiId;
  STJ.toast('A analisar documento…');
  try {
    const resultado = await api.analisarDocumento(txt);
    STJ.estado.importParseResult = resultado;
    STJ.estado.importParsed = resultado.artigos || [];
    STJ.estado.importStep = 2;
    STJ.render();
  } catch (e) { STJ.toast(e.message); }
}

export async function handleConfirmarImport() {
  const leiId  = STJ.estado.importLeiId;
  const artigos = STJ.estado.importParsed;
  if (!leiId || !artigos || !artigos.length) { STJ.toast('Dados em falta.'); return; }
  try {
    await STJ.apiAuth('importarArtigos', { leiId, listaArtigos: artigos });
    STJ.toast('✅ ' + artigos.length + ' artigos importados.');
    STJ.estado.importStep = 1; STJ.estado.importParsed = null; STJ.estado.importParseResult = null;
    STJ.admin.nav('artigos');
  } catch (e) { STJ.toast(e.message); }
}

export function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) processarFicheiro(f);
}

export function handleFileSelect(e) {
  const f = e.target && e.target.files && e.target.files[0];
  if (f) processarFicheiro(f);
}

export function processarFicheiro(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.docx')) {
    if (typeof mammoth === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      s.onload = () => lerDocx(file);
      document.head.appendChild(s);
    } else { lerDocx(file); }
  } else if (n.endsWith('.pdf')) {
    if (typeof pdfjsLib === 'undefined') {
      const sp = document.createElement('script');
      sp.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      sp.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; lerPdf(file); };
      document.head.appendChild(sp);
    } else { lerPdf(file); }
  } else {
    const r = new FileReader();
    r.onload = (ev) => { const el = document.getElementById('imp-text'); if (el) el.value = ev.target.result; STJ.toast('Ficheiro lido.'); };
    r.readAsText(file, 'UTF-8');
  }
}

export function lerDocx(file) {
  const r = new FileReader();
  r.onload = (ev) => {
    mammoth.extractRawText({ arrayBuffer: ev.target.result })
      .then((res) => { const el = document.getElementById('imp-text'); if (el) el.value = res.value; STJ.toast('Word lido.'); })
      .catch((e) => STJ.toast('Erro ao ler .docx: ' + e.message));
  };
  r.readAsArrayBuffer(file);
}

export function lerPdf(file) {
  STJ.toast('A ler PDF…');
  const r = new FileReader();
  r.onload = (ev) => {
    pdfjsLib.getDocument({ data: ev.target.result }).promise
      .then(async (pdf) => {
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent({ normalizeWhitespace: true });
          const linhasMap = {};
          tc.items.forEach((item) => {
            const y = Math.round(item.transform[5] / 2) * 2;
            if (!linhasMap[y]) linhasMap[y] = [];
            linhasMap[y].push({ x: item.transform[4], str: item.str, w: item.width || 0 });
          });
          const ys = Object.keys(linhasMap).map(Number).sort((a, b) => b - a);
          const linhas = ys.map((y) => {
            const itens = linhasMap[y].sort((a, b) => a.x - b.x);
            const textos = []; let xAnt = -Infinity;
            itens.forEach((it) => { if (xAnt > -Infinity && it.x - xAnt > 40) textos.push('\t'); textos.push(it.str); xAnt = it.x + it.w; });
            return textos.join('').replace(/\s{2,}/g, ' ').trim();
          }).filter((l) => l.length > 0);
          pages.push(linhas.join('\n'));
        }
        const el = document.getElementById('imp-text');
        if (el) el.value = pages.join('\n\n');
        STJ.toast(`PDF lido (${pages.length} página(s)).`);
      })
      .catch((e) => STJ.toast('Erro ao ler PDF: ' + (e.message || e)));
  };
  r.readAsArrayBuffer(file);
}
