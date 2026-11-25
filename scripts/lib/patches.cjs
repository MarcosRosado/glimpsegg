/**
 * O patch de uma partida, para o coletor e para a régua do Glint.
 *
 * A OpenDota grava `patch` na partida (60 = 7.41, 61 = 7.42), mas NAO separa patch de letra: a
 * 7.42a sai com o mesmo 61 e `/constants/patch` nem a lista. Entao o patch de letra sai do
 * horario de inicio, contra uma virada fixada aqui.
 *
 * VIRADAS.
 *  - 7.42: 2026-11-18T21:28:07Z, a data de `/constants/patch` da OpenDota.
 *  - 7.42a: a noticia da Steam ("7.42a Gameplay Patch") é de 2026-11-24T23:39:04Z. O
 *    `patch_timestamp` do datafeed da Valve (08:00 UTC) NAO serve: é marcador de data, sempre
 *    08:00 — na 7.42 ele dizia 08:00 e a virada foi a noite. Como noticia e virada real divergem
 *    (na 7.42, noticia 20:00:46Z e OpenDota 21:28:07Z), a virada usada é a noticia MAIS 2 HORAS:
 *    partida que comecou nessa faixa fica como 7.42 e nenhuma trilha a colhe (a 7.42 desce a
 *    partir de 19/11, e a 7.42a para ao entrar nela). Perde-se pouco — a trilha desce uns 50
 *    minutos de jogo por dia — e nada de 7.42 entra como 7.42a.
 *
 * Patch de letra novo: acrescentar a virada aqui, a trilha em `LANES` e conferir o fim da trilha
 * anterior no coletor.
 */
const PATCH_BY_OD_ID = { 60: '7.41', 61: '7.42' };
const PATCH_742_START = Date.parse('2026-11-18T21:28:07Z') / 1000;
const PATCH_742A_START = Date.parse('2026-11-25T01:39:04Z') / 1000;

/** Da mais velha para a mais nova. A ultima comeca do topo de `/parsedMatches`. */
const LANES = ['7.41', '7.42', '7.42a'];
const TOP_LANE = LANES[LANES.length - 1];

/** Pela hora de inicio so (a triagem ainda nao tem a partida). */
function patchOfStart(start) {
  if (typeof start !== 'number') return null;
  if (start >= PATCH_742A_START) return '7.42a';
  return start >= PATCH_742_START ? '7.42' : '7.41';
}

/**
 * Pelo `patch` da OpenDota, refinado pela hora de inicio. Sem hora, o patch de letra nao se
 * afirma e fica o maior (7.42) — é o caso de toda entrada gravada antes de 2026-11-24, e todas
 * elas sao de antes da 7.42a (a trilha 7.42 parou em partidas de 19/11).
 */
function patchOf(odPatch, start) {
  const major = PATCH_BY_OD_ID[odPatch];
  if (!major) return null;
  if (major === '7.42' && typeof start === 'number' && start >= PATCH_742A_START) return '7.42a';
  return major;
}

module.exports = { PATCH_BY_OD_ID, PATCH_742_START, PATCH_742A_START, LANES, TOP_LANE, patchOfStart, patchOf };
