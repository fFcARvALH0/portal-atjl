/**
 * js/modules/privacy/view.js
 * Vista pública: política de privacidade RGPD.
 */

export function renderPrivacidade(estado) {
  const temSessao = !!estado.sessao;
  return `
    <div class="section-title">Política de Privacidade (RGPD)</div>
    <div class="panel">
      <div style="padding:1.5rem;font-size:13.5px;line-height:1.9;color:var(--dark)">
        <p><strong>Responsável:</strong> Supremo Tribunal de Justiça.</p>
        <p style="margin-top:.75rem"><strong>Dados recolhidos:</strong> nome de utilizador, nome e registo
          de atividade de utilizadores autenticados. Visitantes anónimos não têm dados registados.</p>
        <p style="margin-top:.75rem"><strong>Finalidade:</strong> controlo de acesso e rastreabilidade
          das alterações.</p>
        <p style="margin-top:.75rem"><strong>Base legal:</strong> interesse legítimo e consentimento.</p>
        <p style="margin-top:.75rem"><strong>Prazo de conservação:</strong> registos de auditoria por
          5 anos; dados de conta até revogação.</p>
        <p style="margin-top:.75rem"><strong>Direitos:</strong> acesso, rectificação, apagamento e
          portabilidade. Contacte o administrador do sistema.</p>
        ${temSessao ? `
          <div style="margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border-lt)">
            <button class="btn btn-danger" onclick="_pedirEliminarConta()">
              Eliminar / anonimizar a minha conta
            </button>
          </div>` : ''}
      </div>
    </div>
    <button class="btn btn-outline btn-sm" onclick="history.back()" style="margin-top:1rem">‹ Voltar</button>`;
}

window._pedirEliminarConta = async function () {
  const ok = await STJ.modalConfirm({
    titulo: 'Eliminar conta',
    mensagem: 'Anonimizará permanentemente os seus dados. Confirma?',
    textoConfirmar: 'Eliminar'
  });
  if (!ok) return;
  await STJ.apiAuth('eliminarDadosUtilizador');
  STJ.guardarSessao(null);
  STJ.toast('Conta anonimizada.');
  STJ.navegar('home');
};
