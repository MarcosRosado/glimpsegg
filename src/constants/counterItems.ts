import { ThreatArchetype } from '../utils/insights/threatProfile';

/**
 * Itens de resposta por ARQUETIPO DE AMEACA.
 *
 * POR QUE ESTE ARQUIVO EXISTE, E POR QUE É PEQUENO
 * ------------------------------------------------
 * O `itemFullPurchase` da STRATZ sabe que BKB vence 73% num heroi/posicao/ranque, mas
 * nao sabe POR QUE. Sem esse "por que" nao da para produzir a frase que o usuario
 * pediu — "compre BKB porque 62% do dano que voce tomou foi magico". Essas ~40 linhas
 * de curadoria compram exatamente esse elo causal, e nada mais.
 *
 * As alternativas foram descartadas de proposito:
 *  - Matriz de counter por heroi (126x126): insustentavel entre patches. Apodreceria
 *    como os `roles` do HEROES_MAP, onde Axe e Bane sao ambos ["Carry","Support"].
 *  - Anotar `dispel`/`bkbPierce`/`components` no ITEMS_MAP: seria manter a mao um
 *    arquivo de 4.865 linhas que todo patch toca. Aqui a revisao de patch é um diff
 *    de 40 linhas.
 *
 * REGRA DE EDICAO: um item entra aqui so se for resposta CANONICA e pouco controversa
 * ao arquetipo. Nada especifico de heroi, nada situacional — quem filtra isso é o win
 * rate. O `buildAdvisor` intersecta esta lista com o `itemFullPurchase` do heroi e
 * posicao em questao e descarta o que nao vence de fato. Se BKB for ruim naquele heroi
 * naquele patch, ele sai sozinho, sem ninguem editar este arquivo.
 *
 * IDs conferidos contra src/constants/items.ts.
 */
export const COUNTER_ITEMS: Record<ThreatArchetype, number[]> = {
  // Dano magico concentrado: imunidade, resistencia magica, escudo.
  MAGIC_BURST: [
    116, // Black King Bar
    90, // Pipe of Insight
    692, // Eternal Shroud
    254, // Glimmer Cape
    256, // Aeon Disk
  ],
  // Ataque fisico sustentado: armadura, reducao de dano, evasao, reflexo.
  PHYSICAL_RIGHT_CLICK: [
    242, // Crimson Guard
    112, // Assault Cuirass
    139, // Butterfly
    37, // Ghost Scepter
    210, // Heaven's Halberd
    127, // Blade Mail
  ],
  // Lockdown longo: imunidade, dispel, quebra de alvo unico.
  HARD_LOCKDOWN: [
    116, // Black King Bar
    147, // Manta Style
    226, // Lotus Orb
    123, // Linken's Sphere
    256, // Aeon Disk
  ],
  // Dano puro ignora resistencia magica: sobra vida, cura e desengajamento.
  PURE_DAMAGE: [
    160, // Eye of Skadi
    156, // Satanic
    102, // Force Staff
    256, // Aeon Disk
  ],
  // Slow e kite: mobilidade e dispel.
  SLOW_KITE: [
    147, // Manta Style
    100, // Eul's Scepter of Divinity
    102, // Force Staff
    263, // Hurricane Pike
  ],
  // Invisibilidade: deteccao.
  INVISIBILITY: [
    43, // Sentry Ward
    40, // Dust of Appearance
    30, // Gem of True Sight
    249, // Silver Edge
  ],
  // Cura e sustain do inimigo: reducao de cura e silencio.
  HEAL_SUSTAIN: [
    267, // Spirit Vessel
    160, // Eye of Skadi
    98, // Orchid Malevolence
    225, // Nullifier
  ],
};
