export interface AbilityInfo {
  name: string;
  displayName: string;
  slot: 'Q' | 'W' | 'E' | 'D' | 'F' | 'R' | 'TALENT';
  imageUrl: string;
  isUltimate?: boolean;
  isTalent?: boolean;
}

const VALVE_ABILITY_IMG_BASE = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities';

export const HERO_ABILITIES_MAP: Record<number, AbilityInfo[]> = {
  // 145: Kez
  145: [
    {
      name: 'kez_echo_slash',
      displayName: 'Echo Slash',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/kez_echo_slash.png`,
    },
    {
      name: 'kez_grappling_claw',
      displayName: 'Grappling Claw',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/kez_grappling_claw.png`,
    },
    {
      name: 'kez_kazurai_katana',
      displayName: 'Kazurai Katana',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/kez_kazurai_katana.png`,
    },
    {
      name: 'kez_raptor_dance',
      displayName: 'Raptor Dance',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/kez_raptor_dance.png`,
      isUltimate: true,
    },
  ],
  // 131: Ringmaster
  131: [
    {
      name: 'ringmaster_tame_the_beasts',
      displayName: 'Tame the Beasts',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/ringmaster_tame_the_beasts.png`,
    },
    {
      name: 'ringmaster_the_box',
      displayName: 'Escape Act',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/ringmaster_the_box.png`,
    },
    {
      name: 'ringmaster_impalement',
      displayName: 'Impalement',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/ringmaster_impalement.png`,
    },
    {
      name: 'ringmaster_wheel',
      displayName: 'Wheel of Wonder',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/ringmaster_wheel.png`,
      isUltimate: true,
    },
  ],
  // 1: Anti-Mage
  1: [
    {
      name: 'antimage_mana_break',
      displayName: 'Mana Break',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/antimage_mana_break.png`,
    },
    {
      name: 'antimage_blink',
      displayName: 'Blink',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/antimage_blink.png`,
    },
    {
      name: 'antimage_counterspell',
      displayName: 'Counterspell',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/antimage_counterspell.png`,
    },
    {
      name: 'antimage_mana_void',
      displayName: 'Mana Void',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/antimage_mana_void.png`,
      isUltimate: true,
    },
  ],
  // 2: Axe
  2: [
    {
      name: 'axe_berserkers_call',
      displayName: "Berserker's Call",
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/axe_berserkers_call.png`,
    },
    {
      name: 'axe_battle_hunger',
      displayName: 'Battle Hunger',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/axe_battle_hunger.png`,
    },
    {
      name: 'axe_counter_helix',
      displayName: 'Counter Helix',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/axe_counter_helix.png`,
    },
    {
      name: 'axe_culling_blade',
      displayName: 'Culling Blade',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/axe_culling_blade.png`,
      isUltimate: true,
    },
  ],
  // 8: Juggernaut
  8: [
    {
      name: 'juggernaut_blade_fury',
      displayName: 'Blade Fury',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/juggernaut_blade_fury.png`,
    },
    {
      name: 'juggernaut_healing_ward',
      displayName: 'Healing Ward',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/juggernaut_healing_ward.png`,
    },
    {
      name: 'juggernaut_blade_dance',
      displayName: 'Blade Dance',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/juggernaut_blade_dance.png`,
    },
    {
      name: 'juggernaut_omni_slash',
      displayName: 'Omnislash',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/juggernaut_omni_slash.png`,
      isUltimate: true,
    },
  ],
  // 17: Storm Spirit
  17: [
    {
      name: 'storm_spirit_static_remnant',
      displayName: 'Static Remnant',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/storm_spirit_static_remnant.png`,
    },
    {
      name: 'storm_spirit_electric_vortex',
      displayName: 'Electric Vortex',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/storm_spirit_electric_vortex.png`,
    },
    {
      name: 'storm_spirit_overload',
      displayName: 'Overload',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/storm_spirit_overload.png`,
    },
    {
      name: 'storm_spirit_ball_lightning',
      displayName: 'Ball Lightning',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/storm_spirit_ball_lightning.png`,
      isUltimate: true,
    },
  ],
  // 74: Invoker
  74: [
    {
      name: 'invoker_quas',
      displayName: 'Quas',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/invoker_quas.png`,
    },
    {
      name: 'invoker_wex',
      displayName: 'Wex',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/invoker_wex.png`,
    },
    {
      name: 'invoker_exort',
      displayName: 'Exort',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/invoker_exort.png`,
    },
    {
      name: 'invoker_invoke',
      displayName: 'Invoke',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/invoker_invoke.png`,
      isUltimate: true,
    },
  ],
  // 14: Pudge
  14: [
    {
      name: 'pudge_meat_hook',
      displayName: 'Meat Hook',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/pudge_meat_hook.png`,
    },
    {
      name: 'pudge_rot',
      displayName: 'Rot',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/pudge_rot.png`,
    },
    {
      name: 'pudge_flesh_heap',
      displayName: 'Flesh Heap',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/pudge_flesh_heap.png`,
    },
    {
      name: 'pudge_dismember',
      displayName: 'Dismember',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/pudge_dismember.png`,
      isUltimate: true,
    },
  ],
  // 44: Phantom Assassin
  44: [
    {
      name: 'phantom_assassin_stifling_dagger',
      displayName: 'Stifling Dagger',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/phantom_assassin_stifling_dagger.png`,
    },
    {
      name: 'phantom_assassin_phantom_strike',
      displayName: 'Phantom Strike',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/phantom_assassin_phantom_strike.png`,
    },
    {
      name: 'phantom_assassin_blur',
      displayName: 'Blur',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/phantom_assassin_blur.png`,
    },
    {
      name: 'phantom_assassin_coup_de_grace',
      displayName: 'Coup de Grâce',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/phantom_assassin_coup_de_grace.png`,
      isUltimate: true,
    },
  ],
  // 5: Crystal Maiden
  5: [
    {
      name: 'crystal_maiden_crystal_nova',
      displayName: 'Crystal Nova',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/crystal_maiden_crystal_nova.png`,
    },
    {
      name: 'crystal_maiden_frostbite',
      displayName: 'Frostbite',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/crystal_maiden_frostbite.png`,
    },
    {
      name: 'crystal_maiden_brilliance_aura',
      displayName: 'Arcane Aura',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/crystal_maiden_brilliance_aura.png`,
    },
    {
      name: 'crystal_maiden_freezing_field',
      displayName: 'Freezing Field',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/crystal_maiden_freezing_field.png`,
      isUltimate: true,
    },
  ],
  // 11: Shadow Fiend
  11: [
    {
      name: 'nevermore_shadowraze1',
      displayName: 'Shadowraze',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/nevermore_shadowraze1.png`,
    },
    {
      name: 'nevermore_necromastery',
      displayName: 'Necromastery',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/nevermore_necromastery.png`,
    },
    {
      name: 'nevermore_dark_lord',
      displayName: 'Presence of the Dark Lord',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/nevermore_dark_lord.png`,
    },
    {
      name: 'nevermore_requiem',
      displayName: 'Requiem of Souls',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/nevermore_requiem.png`,
      isUltimate: true,
    },
  ],
  // 26: Lion
  26: [
    {
      name: 'lion_impale',
      displayName: 'Earth Spike',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/lion_impale.png`,
    },
    {
      name: 'lion_voodoo',
      displayName: 'Hex',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/lion_voodoo.png`,
    },
    {
      name: 'lion_mana_drain',
      displayName: 'Mana Drain',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/lion_mana_drain.png`,
    },
    {
      name: 'lion_finger_of_death',
      displayName: 'Finger of Death',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/lion_finger_of_death.png`,
      isUltimate: true,
    },
  ],
  // 35: Sniper
  35: [
    {
      name: 'sniper_shrapnel',
      displayName: 'Shrapnel',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/sniper_shrapnel.png`,
    },
    {
      name: 'sniper_headshot',
      displayName: 'Headshot',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/sniper_headshot.png`,
    },
    {
      name: 'sniper_take_aim',
      displayName: 'Take Aim',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/sniper_take_aim.png`,
    },
    {
      name: 'sniper_assassinate',
      displayName: 'Assassinate',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/sniper_assassinate.png`,
      isUltimate: true,
    },
  ],
};

/**
 * Returns ability list for a given heroId with full names and CDN images
 */
export function getHeroAbilities(heroId: number, shortName: string): AbilityInfo[] {
  if (HERO_ABILITIES_MAP[heroId]) {
    return HERO_ABILITIES_MAP[heroId];
  }

  // Generic fallback using hero shortName
  return [
    {
      name: `${shortName}_ability_q`,
      displayName: 'Skill Q',
      slot: 'Q',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/${shortName}_ability_q.png`,
    },
    {
      name: `${shortName}_ability_w`,
      displayName: 'Skill W',
      slot: 'W',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/${shortName}_ability_w.png`,
    },
    {
      name: `${shortName}_ability_e`,
      displayName: 'Skill E',
      slot: 'E',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/${shortName}_ability_e.png`,
    },
    {
      name: `${shortName}_ability_r`,
      displayName: 'Ultimate R',
      slot: 'R',
      imageUrl: `${VALVE_ABILITY_IMG_BASE}/${shortName}_ability_r.png`,
      isUltimate: true,
    },
  ];
}
