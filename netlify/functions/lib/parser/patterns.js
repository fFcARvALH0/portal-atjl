'use strict';
/**
 * ════════════════════════════════════════════════════════════════════
 *  lib/parser/patterns.js
 * ════════════════════════════════════════════════════════════════════
 * Todas as expressões regulares do parser, num único sítio, construídas
 * a partir de fragmentos reutilizáveis. Nenhum outro módulo deve criar
 * regex de deteção estrutural por conta própria — isto evita duplicação
 * e mantém a deteção consistente em todos os formatos de entrada.
 * ════════════════════════════════════════════════════════════════════
 */

// ── Fragmentos reutilizáveis ─────────────────────────────────────────

// Separadores tipográficos aceites entre o número de uma unidade e a
// epígrafe que se segue (ponto, dois pontos, travessões, hífen).
const SEP = '[.:\\-–—]*\\s*';

// Numeração arábica de epígrafe estrutural (I, II, 1, A…), aceitando
// algarismos romanos OU arábicos OU a palavra ÚNICO/ÚNICA.
const NUM_ESTRUTURAL = '([IVXLCDM]+|\\d+|[ÚU]nico|[ÚU]nica|[A-Z])(?![a-zA-ZÀ-ÿ])';

/**
 * Constrói o padrão para um nível estrutural (Parte, Livro, Título…).
 * `palavras` é uma lista de variantes aceites para o rótulo (ex.: ['T[ÍI]TULO']).
 */
function _nivel(palavras) {
  const alt = palavras.join('|');
  return new RegExp('^(?:' + alt + ')\\s+' + NUM_ESTRUTURAL + SEP + '(.*)$', 'i');
}

// ── Hierarquia (do mais geral para o mais específico; a ordem de
//    avaliação no detector segue PATTERNS.niveis, do mais específico
//    para o mais geral, para evitar colisões tipo SUBTÍTULO vs TÍTULO) ──
const NIVEIS = [
  { chave: 'subdivisao', rotulo: 'Subdivisão', rank: 10, regex: _nivel(['SUBDIVIS[ÃA]O']) },
  { chave: 'divisao',    rotulo: 'Divisão',    rank: 9,  regex: _nivel(['DIVIS[ÃA]O']) },
  { chave: 'subseccao',  rotulo: 'Subsecção',  rank: 8,  regex: _nivel(['SUB[-\\s]?S[EE]C[ÇC][ÃA]O']) },
  { chave: 'seccao',     rotulo: 'Secção',     rank: 7,  regex: _nivel(['S[EE]C[ÇC][ÃA]O']) },
  { chave: 'subcapitulo',rotulo: 'Subcapítulo',rank: 6,  regex: _nivel(['SUBCAP[ÍI]TULO']) },
  { chave: 'capitulo',   rotulo: 'Capítulo',   rank: 5,  regex: _nivel(['CAP[ÍI]TULO']) },
  { chave: 'subtitulo',  rotulo: 'Subtítulo',  rank: 4,  regex: _nivel(['SUBT[ÍI]TULO']) },
  { chave: 'titulo',     rotulo: 'Título',     rank: 3,  regex: _nivel(['T[ÍI]TULO']) },
  { chave: 'livro',      rotulo: 'Livro',      rank: 2,  regex: _nivel(['LIVRO']) },
  { chave: 'parte',      rotulo: 'Parte',      rank: 1,  regex: _nivel(['PARTE']) }
];

// ── Artigos (e sinónimos usados em alguns diplomas: Norma, Disposição) ──
// Aceita: Artigo 1.º / Art. 5.º / Artº 20 / ARTIGO 1 / Artigo único /
// Artigo 10-A.º / Artigo 12.º-A / Artigo VII / Artigo Décimo / Norma 3.ª
// Prefixo aceite para cabeçalho de artigo. "Norma" e "Disposição" foram
// excluídos: com a flag /i são demasiado ambíguos (qualquer frase que
// comece por "Norma" ou "Disposição" seria detetada como artigo).
const PREFIXO_ARTIGO = '(?:Artigo|ARTIGO|Art(?:º|\\.º?)?)';

// Dígitos + marca ordinal opcional (.º / º / .°) + sufixo de letra
// opcional ("-A" em "10-A.º" ou "12.º-A"). O lookahead negativo no
// sufixo evita confundir "Artigo 5-Bis" ou "Artigo 5 - Definições" (uma
// palavra a seguir ao travessão) com um verdadeiro sufixo de artigo
// inserido (que é sempre uma única letra isolada).
const NUM_ARTIGO_DIGITO = '\\d{1,4}(?:\\s*\\.?\\s*[º°ª])?(?:\\s*-\\s*[A-ZÀ-Ú](?![a-zà-ú]))?';
const NUM_ARTIGO_ROMANO = '[IVXLCDM]{1,7}';
const NUM_ARTIGO_EXTENSO = '(?:[ÚU]nic[oa]|Centésimo|Septuagésimo|Sexagésimo|Quinquagésimo|Quadragésimo|Trigésimo|Vigésimo|D[ée]cimo|Nono|Oitavo|S[ée]timo|Sexto|Quinto|Quarto|Terceiro|Segundo|Primeiro)(?:\\s+(?:Primeiro|Segundo|Terceiro|Quarto|Quinto|Sexto|S[ée]timo|Oitavo|Nono))?';

const ARTIGO = new RegExp(
  '^' + PREFIXO_ARTIGO + '\\s+' +
  '(' + NUM_ARTIGO_DIGITO + '|' + NUM_ARTIGO_ROMANO + '|' + NUM_ARTIGO_EXTENSO + ')' +
  '(?![a-zA-ZÀ-ÿ])' +
  '\\s*[.:\\-–—]?\\s*(.*)$',
  'i'
);

// ── Anexos / apêndices / material de suporte ─────────────────────────
const ANEXO = /^(ANEXO|AP[ÊE]NDICE)(?:\s+([A-Z]|[IVXLCDM]+|\d+))?\s*[.:\-–—]?\s*(.*)$/i;
const ELEMENTO_SUPORTE = /^(MODELO|MAPA|QUADRO|TABELA|FIGURA|IMAGEM)\s+([A-Z]|[IVXLCDM]+|\d+)?\s*[.:\-–—]?\s*(.*)$/i;

// ── Numeração de itens dentro do corpo de um artigo ──────────────────
const ITEM_NUMERO        = /^(\d{1,4})[.\-)]\s+(.*)$/;        // 1.  1)  1-
const ITEM_NUMERO_PARENT = /^\((\d{1,4})\)\s+(.*)$/;          // (1)
const ITEM_ALINEA        = /^([a-z]{1,2})\)\s+(.*)$/;         // a)  aa)
const ITEM_BULLET        = /^[•*▪◆▸►—-]\s+(.*)$/;             // •  *  —

// ── Linhas a ignorar (ruído típico de PDFs/cabeçalhos/rodapés) ───────
const RUIDO = [
  /^[-–—═=_*•·▪◆▸►]{2,}$/,                       // separadores visuais
  /^[Pp][aá]gina\s*\d+(\s*(de|\/)\s*\d+)?$/i,    // "Página 1 de 10"
  /^\d+\s*\/\s*\d+$/,                             // "1/10"
  /^\d{1,4}$/,                                    // número isolado de página
  /^www\.|https?:\/\//i,                          // URLs
  /^Di[áa]rio da Rep[úu]blica|^D\.R\.\s*n[.º°]?/i,// cabeçalhos do DR
  /^ISSN\s+\d/i,
  /^I\s+S[ÉE]RIE|^II\s+S[ÉE]RIE/i,
  /^_{3,}$/                                       // linhas de assinatura "_____"
];

module.exports = {
  NIVEIS,
  ARTIGO,
  ANEXO,
  ELEMENTO_SUPORTE,
  ITEM_NUMERO,
  ITEM_NUMERO_PARENT,
  ITEM_ALINEA,
  ITEM_BULLET,
  RUIDO
};
