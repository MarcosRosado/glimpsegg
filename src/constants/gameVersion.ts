/**
 * Patch do Dota 2 que serve de referência inicial/fallback para as análises.
 *
 * Versão atual de referência embutida: 7.42.
 * Em execução, o app consulta dinamicamente a Valve (Steam News API),
 * OpenDota e STRATZ para manter o patch sempre sincronizado e atualizado
 * em tempo real, sem necessidade de atualização do app.
 */
export const CURRENT_GAME_PATCH = '7.42';


export interface PatchTransitionConfig {
  /** Patch "maior" (sem letra): 7.42 cobre 7.42a, 7.42b... */
  patch: string;
  /** Instante de publicacao, ISO 8601 em UTC (`patch_timestamp` do datafeed da Valve). */
  releasedAt: string;
  /** Teto de seguranca: passado esse prazo o aviso some mesmo que ninguem edite aqui. */
  days: number;
}

/**
 * Janela de TRANSICAO de patch — temporaria, e a remocao é manual.
 *
 * Nos primeiros dias de um patch, `itemFullPurchase`, `heroVsHeroMatchup`, `heroAverage`
 * e os winrates semanais ainda sao quase todos partidas do patch anterior, mas o app ja
 * resolve e exibe o patch novo. Sem aviso, isso é numero com procedencia errada. Enquanto
 * esta constante estiver preenchida e dentro do prazo, `PatchTransitionNotice` avisa.
 *
 * QUANDO VOLTAR PARA `null`: assim que `node scripts/check-patch-readiness.cjs` mostrar
 * `[ok]` nas linhas de `itemFullPurchase` e `winWeek`. O `days` é so a rede para o caso
 * de ninguem lembrar — 14 dias cobre duas janelas semanais.
 *
 * Em patch novo: preencher de novo com os dados dele (ver docs/PATCH-CHECKLIST.md).
 */
export const PATCH_TRANSITION: PatchTransitionConfig | null = {
  patch: '7.42',
  releasedAt: '2026-11-18T08:00:00Z',
  days: 14,
};
