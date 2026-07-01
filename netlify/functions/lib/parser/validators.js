'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/validators.js
 * ════════════════════════════════════════════════════════════════════
 * Validações heurísticas sobre a estrutura já reconstruída. Nunca
 * impedem a importação — geram avisos para o utilizador rever, porque
 * diplomas reais legitimamente têm exceções (artigos revogados e
 * removidos, séries "10.º-A/10.º-B" inseridas por alteração posterior,
 * capítulos com o mesmo número em partes diferentes, etc.).
 * ════════════════════════════════════════════════════════════════════
 */

function validarArtigos(artigos) {
  const avisos = [];

  // ── Artigos repetidos (mesmo número canónico) ──────────────────────
  const vistos = new Map();
  artigos.forEach((a) => {
    const chave = a.numero;
    if (vistos.has(chave)) {
      avisos.push({
        tipo: 'artigo_repetido', severidade: 'aviso',
        mensagem: chave + ' aparece mais do que uma vez no documento.',
        artigoIds: [vistos.get(chave), a.id]
      });
    } else {
      vistos.set(chave, a.id);
    }
  });

  // ── Numeração saltada / fora de ordem (apenas artigos numéricos, sem
  //    sufixo de inserção, que é o caso normal previsível) ────────────
  const sequencia = artigos.filter((a) => a.numeroInfo && a.numeroInfo.tipo === 'digito' && !a.numeroInfo.sufixo);
  for (let i = 1; i < sequencia.length; i++) {
    const anterior = sequencia[i - 1].numeroInfo.valorNum;
    const atual = sequencia[i].numeroInfo.valorNum;
    if (atual === anterior + 1) continue;
    if (atual <= anterior) {
      avisos.push({
        tipo: 'artigo_fora_de_ordem', severidade: 'aviso',
        mensagem: sequencia[i].numero + ' aparece depois de ' + sequencia[i - 1].numero + ', fora da ordem numérica.',
        artigoIds: [sequencia[i - 1].id, sequencia[i].id]
      });
    } else if (atual > anterior + 1) {
      avisos.push({
        tipo: 'numeracao_saltada', severidade: 'info',
        mensagem: 'Salto de numeração entre ' + sequencia[i - 1].numero + ' e ' + sequencia[i].numero + ' (pode ser normal, p.ex. artigos revogados).',
        artigoIds: [sequencia[i - 1].id, sequencia[i].id]
      });
    }
  }

  // ── Capítulos duplicados (mesmo número de capítulo reaparece depois
  //    de já ter sido "fechado" por outro capítulo diferente) ─────────
  let capAnteriorNum = null;
  const capsVistos = new Set();
  artigos.forEach((a) => {
    if (!a.capNum) return;
    if (a.capNum !== capAnteriorNum) {
      if (capsVistos.has(a.capNum)) {
        avisos.push({
          tipo: 'capitulo_duplicado', severidade: 'aviso',
          mensagem: 'Capítulo ' + a.capNum + ' reaparece mais adiante no documento, depois de outro capítulo.',
          artigoIds: [a.id]
        });
      }
      capsVistos.add(a.capNum);
      capAnteriorNum = a.capNum;
    }
  });

  // ── Secções sem capítulo associado ──────────────────────────────────
  artigos.forEach((a) => {
    if (a.secNum && !a.capNum) {
      avisos.push({
        tipo: 'seccao_sem_capitulo', severidade: 'info',
        mensagem: 'Secção ' + a.secNum + ' (em ' + a.numero + ') não está dentro de nenhum capítulo.',
        artigoIds: [a.id]
      });
    }
  });

  // ── Hierarquia inválida: subsecção sem secção ───────────────────────
  artigos.forEach((a) => {
    if (a.subSecNum && !a.secNum) {
      avisos.push({
        tipo: 'hierarquia_invalida', severidade: 'info',
        mensagem: 'Subsecção ' + a.subSecNum + ' (em ' + a.numero + ') não está dentro de nenhuma secção.',
        artigoIds: [a.id]
      });
    }
  });

  // ── Números desconhecidos (não foi possível interpretar o número) ──
  artigos.forEach((a) => {
    if (a.numeroInfo && a.numeroInfo.tipo === 'desconhecido') {
      avisos.push({
        tipo: 'numero_nao_interpretado', severidade: 'aviso',
        mensagem: a.numero + ': não foi possível interpretar o formato do número com confiança total — reveja manualmente.',
        artigoIds: [a.id]
      });
    }
  });

  if (!artigos.length) {
    avisos.push({
      tipo: 'nenhum_artigo', severidade: 'erro',
      mensagem: 'Nenhum artigo foi detetado no texto. Verifique se contém epígrafes do tipo "Artigo 1.º".',
      artigoIds: []
    });
  }

  return avisos;
}

module.exports = { validarArtigos };
