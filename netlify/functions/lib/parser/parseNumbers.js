'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/parseNumbers.js
 * ════════════════════════════════════════════════════════════════════
 * Reconstrói a árvore de números ("1.", "2.", "(3)"), alíneas ("a)")
 * e subalíneas ("i)") dentro do corpo de um artigo, usando uma pilha
 * baseada em "rank" estrutural (número > alínea > subalínea), que é
 * robusta mesmo quando a indentação original se perde (frequente em
 * texto colado diretamente). Linhas que não correspondem a nenhum
 * marcador são anexadas como continuação ao nó aberto mais profundo.
 * ════════════════════════════════════════════════════════════════════
 */

const { ITEM_NUMERO, ITEM_NUMERO_PARENT } = require('./patterns');
const { detetarMarcadorLista } = require('./parseLists');
const { gerarIdNo } = require('./helpers');

const RANK = { numero: 1, item: 1, alinea: 2, subalinea: 3 };

function _novoNo(tipo, marcador) {
  return { id: gerarIdNo(), tipo, marcador, texto: '', filhos: [] };
}

/**
 * Constrói a árvore de números/alíneas/subalíneas a partir das linhas
 * (com indentação original preservada) do corpo de um artigo.
 * Devolve { arvore, temEstrutura } — `temEstrutura` indica se foi
 * encontrado pelo menos um marcador (caso contrário o corpo é texto
 * corrido simples e o chamador pode ignorar a árvore).
 */
function construirArvoreNumeros(linhasCorpo) {
  const raiz = [];
  const pilha = []; // { rank, no }
  let encontrouMarcador = false;

  const noAtual = () => (pilha.length ? pilha[pilha.length - 1].no : null);

  const adicionarTexto = (texto) => {
    const no = noAtual();
    if (no) {
      no.texto = no.texto ? no.texto + '\n' + texto : texto;
    }
    // Se ainda não há nenhum nó aberto, a linha pertence ao "caput" do
    // artigo (texto antes do primeiro número) — não faz parte da árvore.
  };

  const empilhar = (tipo, marcador, textoInicial) => {
    encontrouMarcador = true;
    const rank = RANK[tipo];
    while (pilha.length && pilha[pilha.length - 1].rank >= rank) pilha.pop();
    const no = _novoNo(tipo, marcador);
    no.texto = textoInicial || '';
    if (pilha.length) {
      pilha[pilha.length - 1].no.filhos.push(no);
    } else {
      raiz.push(no);
    }
    pilha.push({ rank, no });
  };

  for (const linhaOriginal of linhasCorpo) {
    const linha = linhaOriginal.trim();
    if (!linha) continue;

    let m = linha.match(ITEM_NUMERO);
    if (m) { empilhar('numero', m[1] + '.', m[2]); continue; }

    m = linha.match(ITEM_NUMERO_PARENT);
    if (m) { empilhar('numero', '(' + m[1] + ')', m[2]); continue; }

    const dentroDeAlinea = pilha.some((e) => e.rank === RANK.alinea);
    const marca = detetarMarcadorLista(linha, dentroDeAlinea);
    if (marca) { empilhar(marca.tipo, marca.marcador + ')', marca.texto); continue; }

    adicionarTexto(linha);
  }

  return { arvore: raiz, temEstrutura: encontrouMarcador };
}

module.exports = { construirArvoreNumeros };
