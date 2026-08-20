import { ItemMetadata } from "../types/dota";

const VALVE_ITEM_IMG_BASE = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items";

export const ITEMS_MAP: Record<number, ItemMetadata> = {
  "0": {
    "id": 0,
    "name": "item_ability_base",
    "displayName": "Ability Base",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ability_base.png"
  },
  "1": {
    "id": 1,
    "name": "item_blink",
    "displayName": "Blink Dagger",
    "cost": 2250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blink.png"
  },
  "2": {
    "id": 2,
    "name": "item_blades_of_attack",
    "displayName": "Blades of Attack",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blades_of_attack.png"
  },
  "3": {
    "id": 3,
    "name": "item_broadsword",
    "displayName": "Broadsword",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/broadsword.png"
  },
  "4": {
    "id": 4,
    "name": "item_chainmail",
    "displayName": "Chainmail",
    "cost": 500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/chainmail.png"
  },
  "5": {
    "id": 5,
    "name": "item_claymore",
    "displayName": "Claymore",
    "cost": 1350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/claymore.png"
  },
  "6": {
    "id": 6,
    "name": "item_helm_of_iron_will",
    "displayName": "Helm of Iron Will",
    "cost": 975,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/helm_of_iron_will.png"
  },
  "7": {
    "id": 7,
    "name": "item_javelin",
    "displayName": "Javelin",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/javelin.png"
  },
  "8": {
    "id": 8,
    "name": "item_mithril_hammer",
    "displayName": "Mithril Hammer",
    "cost": 1600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mithril_hammer.png"
  },
  "9": {
    "id": 9,
    "name": "item_platemail",
    "displayName": "Platemail",
    "cost": 1400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/platemail.png"
  },
  "10": {
    "id": 10,
    "name": "item_quarterstaff",
    "displayName": "Quarterstaff",
    "cost": 875,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/quarterstaff.png"
  },
  "11": {
    "id": 11,
    "name": "item_quelling_blade",
    "displayName": "Quelling Blade",
    "cost": 100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/quelling_blade.png"
  },
  "12": {
    "id": 12,
    "name": "item_ring_of_protection",
    "displayName": "Ring of Protection",
    "cost": 175,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ring_of_protection.png"
  },
  "13": {
    "id": 13,
    "name": "item_gauntlets",
    "displayName": "Gauntlets of Strength",
    "cost": 140,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gauntlets.png"
  },
  "14": {
    "id": 14,
    "name": "item_slippers",
    "displayName": "Slippers of Agility",
    "cost": 140,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/slippers.png"
  },
  "15": {
    "id": 15,
    "name": "item_mantle",
    "displayName": "Mantle of Intelligence",
    "cost": 140,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mantle.png"
  },
  "16": {
    "id": 16,
    "name": "item_branches",
    "displayName": "Iron Branch",
    "cost": 55,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/branches.png"
  },
  "17": {
    "id": 17,
    "name": "item_belt_of_strength",
    "displayName": "Belt of Strength",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/belt_of_strength.png"
  },
  "18": {
    "id": 18,
    "name": "item_boots_of_elves",
    "displayName": "Band of Elvenskin",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/boots_of_elves.png"
  },
  "19": {
    "id": 19,
    "name": "item_robe",
    "displayName": "Robe of the Magi",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/robe.png"
  },
  "20": {
    "id": 20,
    "name": "item_circlet",
    "displayName": "Circlet",
    "cost": 155,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/circlet.png"
  },
  "21": {
    "id": 21,
    "name": "item_ogre_axe",
    "displayName": "Ogre Axe",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ogre_axe.png"
  },
  "22": {
    "id": 22,
    "name": "item_blade_of_alacrity",
    "displayName": "Blade of Alacrity",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blade_of_alacrity.png"
  },
  "23": {
    "id": 23,
    "name": "item_staff_of_wizardry",
    "displayName": "Staff of Wizardry",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/staff_of_wizardry.png"
  },
  "24": {
    "id": 24,
    "name": "item_ultimate_orb",
    "displayName": "Ultimate Orb",
    "cost": 2800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ultimate_orb.png"
  },
  "25": {
    "id": 25,
    "name": "item_gloves",
    "displayName": "Gloves of Haste",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gloves.png"
  },
  "26": {
    "id": 26,
    "name": "item_lifesteal",
    "displayName": "Morbid Mask",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/lifesteal.png"
  },
  "27": {
    "id": 27,
    "name": "item_ring_of_regen",
    "displayName": "Ring of Regen",
    "cost": 175,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ring_of_regen.png"
  },
  "28": {
    "id": 28,
    "name": "item_sobi_mask",
    "displayName": "Sage's Mask",
    "cost": 175,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/sobi_mask.png"
  },
  "29": {
    "id": 29,
    "name": "item_boots",
    "displayName": "Boots of Speed",
    "cost": 500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/boots.png"
  },
  "30": {
    "id": 30,
    "name": "item_gem",
    "displayName": "Gem of True Sight",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gem.png"
  },
  "31": {
    "id": 31,
    "name": "item_cloak",
    "displayName": "Cloak",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/cloak.png"
  },
  "32": {
    "id": 32,
    "name": "item_talisman_of_evasion",
    "displayName": "Talisman of Evasion",
    "cost": 1300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/talisman_of_evasion.png"
  },
  "33": {
    "id": 33,
    "name": "item_cheese",
    "displayName": "Cheese",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/cheese.png"
  },
  "34": {
    "id": 34,
    "name": "item_magic_stick",
    "displayName": "Magic Stick",
    "cost": 200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/magic_stick.png"
  },
  "35": {
    "id": 35,
    "name": "item_recipe_magic_wand",
    "displayName": "Magic Wand Recipe",
    "cost": 150,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "36": {
    "id": 36,
    "name": "item_magic_wand",
    "displayName": "Magic Wand",
    "cost": 460,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/magic_wand.png"
  },
  "37": {
    "id": 37,
    "name": "item_ghost",
    "displayName": "Ghost Scepter",
    "cost": 1500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ghost.png"
  },
  "38": {
    "id": 38,
    "name": "item_clarity",
    "displayName": "Clarity",
    "cost": 60,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/clarity.png"
  },
  "39": {
    "id": 39,
    "name": "item_flask",
    "displayName": "Healing Salve",
    "cost": 100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/flask.png"
  },
  "40": {
    "id": 40,
    "name": "item_dust",
    "displayName": "Dust of Appearance",
    "cost": 80,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dust.png"
  },
  "41": {
    "id": 41,
    "name": "item_bottle",
    "displayName": "Bottle",
    "cost": 675,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/bottle.png"
  },
  "42": {
    "id": 42,
    "name": "item_ward_observer",
    "displayName": "Observer Ward",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png"
  },
  "43": {
    "id": 43,
    "name": "item_ward_sentry",
    "displayName": "Sentry Ward",
    "cost": 50,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_sentry.png"
  },
  "44": {
    "id": 44,
    "name": "item_tango",
    "displayName": "Tango",
    "cost": 90,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tango.png"
  },
  "45": {
    "id": 45,
    "name": "item_courier",
    "displayName": "Animal Courier",
    "cost": 50,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/courier.png"
  },
  "46": {
    "id": 46,
    "name": "item_tpscroll",
    "displayName": "Town Portal Scroll",
    "cost": 100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tpscroll.png"
  },
  "47": {
    "id": 47,
    "name": "item_recipe_travel_boots",
    "displayName": "Boots of Travel Recipe",
    "cost": 2000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "48": {
    "id": 48,
    "name": "item_travel_boots",
    "displayName": "Boots of Travel",
    "cost": 2500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/travel_boots.png"
  },
  "49": {
    "id": 49,
    "name": "item_recipe_phase_boots",
    "displayName": "Recipe Phase Boots",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "50": {
    "id": 50,
    "name": "item_phase_boots",
    "displayName": "Phase Boots",
    "cost": 1450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/phase_boots.png"
  },
  "51": {
    "id": 51,
    "name": "item_demon_edge",
    "displayName": "Demon Edge",
    "cost": 2200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/demon_edge.png"
  },
  "52": {
    "id": 52,
    "name": "item_eagle",
    "displayName": "Eaglesong",
    "cost": 2800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/eagle.png"
  },
  "53": {
    "id": 53,
    "name": "item_reaver",
    "displayName": "Reaver",
    "cost": 2800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/reaver.png"
  },
  "54": {
    "id": 54,
    "name": "item_relic",
    "displayName": "Sacred Relic",
    "cost": 3400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/relic.png"
  },
  "55": {
    "id": 55,
    "name": "item_hyperstone",
    "displayName": "Hyperstone",
    "cost": 2000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/hyperstone.png"
  },
  "56": {
    "id": 56,
    "name": "item_ring_of_health",
    "displayName": "Ring of Health",
    "cost": 700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ring_of_health.png"
  },
  "57": {
    "id": 57,
    "name": "item_void_stone",
    "displayName": "Void Stone",
    "cost": 700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/void_stone.png"
  },
  "58": {
    "id": 58,
    "name": "item_mystic_staff",
    "displayName": "Mystic Staff",
    "cost": 2800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mystic_staff.png"
  },
  "59": {
    "id": 59,
    "name": "item_energy_booster",
    "displayName": "Energy Booster",
    "cost": 800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/energy_booster.png"
  },
  "60": {
    "id": 60,
    "name": "item_point_booster",
    "displayName": "Point Booster",
    "cost": 1200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/point_booster.png"
  },
  "61": {
    "id": 61,
    "name": "item_vitality_booster",
    "displayName": "Vitality Booster",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/vitality_booster.png"
  },
  "62": {
    "id": 62,
    "name": "item_recipe_power_treads",
    "displayName": "Recipe Power Treads",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "63": {
    "id": 63,
    "name": "item_power_treads",
    "displayName": "Power Treads",
    "cost": 1400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/power_treads.png"
  },
  "64": {
    "id": 64,
    "name": "item_recipe_hand_of_midas",
    "displayName": "Hand of Midas Recipe",
    "cost": 1750,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "65": {
    "id": 65,
    "name": "item_hand_of_midas",
    "displayName": "Hand of Midas",
    "cost": 2200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/hand_of_midas.png"
  },
  "66": {
    "id": 66,
    "name": "item_recipe_oblivion_staff",
    "displayName": "Recipe Oblivion Staff",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "67": {
    "id": 67,
    "name": "item_oblivion_staff",
    "displayName": "Oblivion Staff",
    "cost": 1625,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/oblivion_staff.png"
  },
  "68": {
    "id": 68,
    "name": "item_recipe_pers",
    "displayName": "Recipe Pers",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "69": {
    "id": 69,
    "name": "item_pers",
    "displayName": "Perseverance",
    "cost": 1400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pers.png"
  },
  "70": {
    "id": 70,
    "name": "item_recipe_poor_mans_shield",
    "displayName": "Recipe Poor Mans Shield",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "71": {
    "id": 71,
    "name": "item_poor_mans_shield",
    "displayName": "Poor Man's Shield",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/poor_mans_shield.png"
  },
  "72": {
    "id": 72,
    "name": "item_recipe_bracer",
    "displayName": "Bracer Recipe",
    "cost": 210,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "73": {
    "id": 73,
    "name": "item_bracer",
    "displayName": "Bracer",
    "cost": 505,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/bracer.png"
  },
  "74": {
    "id": 74,
    "name": "item_recipe_wraith_band",
    "displayName": "Wraith Band Recipe",
    "cost": 210,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "75": {
    "id": 75,
    "name": "item_wraith_band",
    "displayName": "Wraith Band",
    "cost": 505,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wraith_band.png"
  },
  "76": {
    "id": 76,
    "name": "item_recipe_null_talisman",
    "displayName": "Null Talisman Recipe",
    "cost": 210,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "77": {
    "id": 77,
    "name": "item_null_talisman",
    "displayName": "Null Talisman",
    "cost": 505,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/null_talisman.png"
  },
  "78": {
    "id": 78,
    "name": "item_recipe_mekansm",
    "displayName": "Mekansm Recipe",
    "cost": 850,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "79": {
    "id": 79,
    "name": "item_mekansm",
    "displayName": "Mekansm",
    "cost": 1775,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mekansm.png"
  },
  "80": {
    "id": 80,
    "name": "item_recipe_vladmir",
    "displayName": "Recipe Vladmir",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "81": {
    "id": 81,
    "name": "item_vladmir",
    "displayName": "Vladmir's Offering",
    "cost": 2200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/vladmir.png"
  },
  "85": {
    "id": 85,
    "name": "item_recipe_buckler",
    "displayName": "Buckler Recipe",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "86": {
    "id": 86,
    "name": "item_buckler",
    "displayName": "Buckler",
    "cost": 425,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/buckler.png"
  },
  "87": {
    "id": 87,
    "name": "item_recipe_ring_of_basilius",
    "displayName": "Ring of Basilius Recipe",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "88": {
    "id": 88,
    "name": "item_ring_of_basilius",
    "displayName": "Ring of Basilius",
    "cost": 425,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ring_of_basilius.png"
  },
  "89": {
    "id": 89,
    "name": "item_recipe_pipe",
    "displayName": "Pipe of Insight Recipe",
    "cost": 675,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "90": {
    "id": 90,
    "name": "item_pipe",
    "displayName": "Pipe of Insight",
    "cost": 3725,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pipe.png"
  },
  "91": {
    "id": 91,
    "name": "item_recipe_urn_of_shadows",
    "displayName": "Urn of Shadows Recipe",
    "cost": 320,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "92": {
    "id": 92,
    "name": "item_urn_of_shadows",
    "displayName": "Urn of Shadows",
    "cost": 825,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/urn_of_shadows.png"
  },
  "93": {
    "id": 93,
    "name": "item_recipe_headdress",
    "displayName": "Headdress Recipe",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "94": {
    "id": 94,
    "name": "item_headdress",
    "displayName": "Headdress",
    "cost": 425,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/headdress.png"
  },
  "95": {
    "id": 95,
    "name": "item_recipe_sheepstick",
    "displayName": "Scythe of Vyse Recipe",
    "cost": 700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "96": {
    "id": 96,
    "name": "item_sheepstick",
    "displayName": "Scythe of Vyse",
    "cost": 5200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/sheepstick.png"
  },
  "97": {
    "id": 97,
    "name": "item_recipe_orchid",
    "displayName": "Orchid Malevolence Recipe",
    "cost": 300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "98": {
    "id": 98,
    "name": "item_orchid",
    "displayName": "Orchid Malevolence",
    "cost": 3275,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/orchid.png"
  },
  "99": {
    "id": 99,
    "name": "item_recipe_cyclone",
    "displayName": "Eul's Scepter Recipe",
    "cost": 675,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "100": {
    "id": 100,
    "name": "item_cyclone",
    "displayName": "Eul's Scepter of Divinity",
    "cost": 2600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/cyclone.png"
  },
  "101": {
    "id": 101,
    "name": "item_recipe_force_staff",
    "displayName": "Force Staff Recipe",
    "cost": 950,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "102": {
    "id": 102,
    "name": "item_force_staff",
    "displayName": "Force Staff",
    "cost": 2200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/force_staff.png"
  },
  "103": {
    "id": 103,
    "name": "item_recipe_dagon",
    "displayName": "Dagon Recipe",
    "cost": 1150,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "104": {
    "id": 104,
    "name": "item_dagon",
    "displayName": "Dagon",
    "cost": 3050,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dagon.png"
  },
  "105": {
    "id": 105,
    "name": "item_recipe_necronomicon",
    "displayName": "Necronomicon Recipe",
    "cost": 1250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "106": {
    "id": 106,
    "name": "item_necronomicon",
    "displayName": "Necronomicon",
    "cost": 2050,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/necronomicon.png"
  },
  "107": {
    "id": 107,
    "name": "item_recipe_ultimate_scepter",
    "displayName": "Recipe Ultimate Scepter",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "108": {
    "id": 108,
    "name": "item_ultimate_scepter",
    "displayName": "Aghanim's Scepter",
    "cost": 4200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ultimate_scepter.png"
  },
  "109": {
    "id": 109,
    "name": "item_recipe_refresher",
    "displayName": "Refresher Orb Recipe",
    "cost": 1600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "110": {
    "id": 110,
    "name": "item_refresher",
    "displayName": "Refresher Orb",
    "cost": 5000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/refresher.png"
  },
  "111": {
    "id": 111,
    "name": "item_recipe_assault",
    "displayName": "Assault Cuirass Recipe",
    "cost": 1300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "112": {
    "id": 112,
    "name": "item_assault",
    "displayName": "Assault Cuirass",
    "cost": 5125,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/assault.png"
  },
  "113": {
    "id": 113,
    "name": "item_recipe_heart",
    "displayName": "Heart of Tarrasque Recipe",
    "cost": 600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "114": {
    "id": 114,
    "name": "item_heart",
    "displayName": "Heart of Tarrasque",
    "cost": 5100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/heart.png"
  },
  "115": {
    "id": 115,
    "name": "item_recipe_black_king_bar",
    "displayName": "Black King Bar Recipe",
    "cost": 1450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "116": {
    "id": 116,
    "name": "item_black_king_bar",
    "displayName": "Black King Bar",
    "cost": 4050,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/black_king_bar.png"
  },
  "117": {
    "id": 117,
    "name": "item_aegis",
    "displayName": "Aegis of the Immortal",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aegis.png"
  },
  "118": {
    "id": 118,
    "name": "item_recipe_shivas_guard",
    "displayName": "Shiva's Guard Recipe",
    "cost": 1350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "119": {
    "id": 119,
    "name": "item_shivas_guard",
    "displayName": "Shiva's Guard",
    "cost": 4500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/shivas_guard.png"
  },
  "120": {
    "id": 120,
    "name": "item_recipe_bloodstone",
    "displayName": "Recipe Bloodstone",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "121": {
    "id": 121,
    "name": "item_bloodstone",
    "displayName": "Bloodstone",
    "cost": 4700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/bloodstone.png"
  },
  "122": {
    "id": 122,
    "name": "item_recipe_sphere",
    "displayName": "Linken's Sphere Recipe",
    "cost": 600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "123": {
    "id": 123,
    "name": "item_sphere",
    "displayName": "Linken's Sphere",
    "cost": 4800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/sphere.png"
  },
  "124": {
    "id": 124,
    "name": "item_recipe_vanguard",
    "displayName": "Recipe Vanguard",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "125": {
    "id": 125,
    "name": "item_vanguard",
    "displayName": "Vanguard",
    "cost": 1700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/vanguard.png"
  },
  "126": {
    "id": 126,
    "name": "item_recipe_blade_mail",
    "displayName": "Blade Mail Recipe",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "127": {
    "id": 127,
    "name": "item_blade_mail",
    "displayName": "Blade Mail",
    "cost": 2400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blade_mail.png"
  },
  "128": {
    "id": 128,
    "name": "item_recipe_soul_booster",
    "displayName": "Recipe Soul Booster",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "129": {
    "id": 129,
    "name": "item_soul_booster",
    "displayName": "Soul Booster",
    "cost": 3000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/soul_booster.png"
  },
  "130": {
    "id": 130,
    "name": "item_recipe_hood_of_defiance",
    "displayName": "Recipe Hood Of Defiance",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "131": {
    "id": 131,
    "name": "item_hood_of_defiance",
    "displayName": "Hood of Defiance",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/hood_of_defiance.png"
  },
  "132": {
    "id": 132,
    "name": "item_recipe_rapier",
    "displayName": "Recipe Rapier",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "133": {
    "id": 133,
    "name": "item_rapier",
    "displayName": "Divine Rapier",
    "cost": 5600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/rapier.png"
  },
  "134": {
    "id": 134,
    "name": "item_recipe_monkey_king_bar",
    "displayName": "Monkey King Bar Recipe",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "135": {
    "id": 135,
    "name": "item_monkey_king_bar",
    "displayName": "Monkey King Bar",
    "cost": 5000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/monkey_king_bar.png"
  },
  "136": {
    "id": 136,
    "name": "item_recipe_radiance",
    "displayName": "Recipe Radiance",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "137": {
    "id": 137,
    "name": "item_radiance",
    "displayName": "Radiance",
    "cost": 4700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/radiance.png"
  },
  "138": {
    "id": 138,
    "name": "item_recipe_butterfly",
    "displayName": "Recipe Butterfly",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "139": {
    "id": 139,
    "name": "item_butterfly",
    "displayName": "Butterfly",
    "cost": 5450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/butterfly.png"
  },
  "140": {
    "id": 140,
    "name": "item_recipe_greater_crit",
    "displayName": "Daedalus Recipe",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "141": {
    "id": 141,
    "name": "item_greater_crit",
    "displayName": "Daedalus",
    "cost": 5100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/greater_crit.png"
  },
  "142": {
    "id": 142,
    "name": "item_recipe_basher",
    "displayName": "Skull Basher Recipe",
    "cost": 825,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "143": {
    "id": 143,
    "name": "item_basher",
    "displayName": "Skull Basher",
    "cost": 2875,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/basher.png"
  },
  "144": {
    "id": 144,
    "name": "item_recipe_bfury",
    "displayName": "Battle Fury Recipe",
    "cost": 400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "145": {
    "id": 145,
    "name": "item_bfury",
    "displayName": "Battle Fury",
    "cost": 3900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/bfury.png"
  },
  "146": {
    "id": 146,
    "name": "item_recipe_manta",
    "displayName": "Manta Style Recipe",
    "cost": 1550,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "147": {
    "id": 147,
    "name": "item_manta",
    "displayName": "Manta Style",
    "cost": 4650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/manta.png"
  },
  "148": {
    "id": 148,
    "name": "item_recipe_lesser_crit",
    "displayName": "Crystalys Recipe",
    "cost": 200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "149": {
    "id": 149,
    "name": "item_lesser_crit",
    "displayName": "Crystalys",
    "cost": 2000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/lesser_crit.png"
  },
  "150": {
    "id": 150,
    "name": "item_recipe_armlet",
    "displayName": "Armlet of Mordiggian Recipe",
    "cost": 625,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "151": {
    "id": 151,
    "name": "item_armlet",
    "displayName": "Armlet of Mordiggian",
    "cost": 2500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/armlet.png"
  },
  "152": {
    "id": 152,
    "name": "item_invis_sword",
    "displayName": "Shadow Blade",
    "cost": 3250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/invis_sword.png"
  },
  "153": {
    "id": 153,
    "name": "item_recipe_sange_and_yasha",
    "displayName": "Recipe Sange And Yasha",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "154": {
    "id": 154,
    "name": "item_sange_and_yasha",
    "displayName": "Sange and Yasha",
    "cost": 4200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/sange_and_yasha.png"
  },
  "155": {
    "id": 155,
    "name": "item_recipe_satanic",
    "displayName": "Recipe Satanic",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "156": {
    "id": 156,
    "name": "item_satanic",
    "displayName": "Satanic",
    "cost": 5050,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/satanic.png"
  },
  "157": {
    "id": 157,
    "name": "item_recipe_mjollnir",
    "displayName": "Mjollnir Recipe",
    "cost": 550,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "158": {
    "id": 158,
    "name": "item_mjollnir",
    "displayName": "Mjollnir",
    "cost": 5500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mjollnir.png"
  },
  "159": {
    "id": 159,
    "name": "item_recipe_skadi",
    "displayName": "Recipe Skadi",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "160": {
    "id": 160,
    "name": "item_skadi",
    "displayName": "Eye of Skadi",
    "cost": 5900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/skadi.png"
  },
  "161": {
    "id": 161,
    "name": "item_recipe_sange",
    "displayName": "Sange Recipe",
    "cost": 650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "162": {
    "id": 162,
    "name": "item_sange",
    "displayName": "Sange",
    "cost": 2100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/sange.png"
  },
  "163": {
    "id": 163,
    "name": "item_recipe_helm_of_the_dominator",
    "displayName": "Helm of the Dominator Recipe",
    "cost": 1125,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "164": {
    "id": 164,
    "name": "item_helm_of_the_dominator",
    "displayName": "Helm of the Dominator",
    "cost": 2550,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/helm_of_the_dominator.png"
  },
  "165": {
    "id": 165,
    "name": "item_recipe_maelstrom",
    "displayName": "Recipe Maelstrom",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "166": {
    "id": 166,
    "name": "item_maelstrom",
    "displayName": "Maelstrom",
    "cost": 2950,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/maelstrom.png"
  },
  "167": {
    "id": 167,
    "name": "item_recipe_desolator",
    "displayName": "Recipe Desolator",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "168": {
    "id": 168,
    "name": "item_desolator",
    "displayName": "Desolator",
    "cost": 3500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/desolator.png"
  },
  "169": {
    "id": 169,
    "name": "item_recipe_yasha",
    "displayName": "Yasha Recipe",
    "cost": 650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "170": {
    "id": 170,
    "name": "item_yasha",
    "displayName": "Yasha",
    "cost": 2100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/yasha.png"
  },
  "171": {
    "id": 171,
    "name": "item_recipe_mask_of_madness",
    "displayName": "Recipe Mask Of Madness",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "172": {
    "id": 172,
    "name": "item_mask_of_madness",
    "displayName": "Mask of Madness",
    "cost": 1900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mask_of_madness.png"
  },
  "173": {
    "id": 173,
    "name": "item_recipe_diffusal_blade",
    "displayName": "Diffusal Blade Recipe",
    "cost": 1050,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "174": {
    "id": 174,
    "name": "item_diffusal_blade",
    "displayName": "Diffusal Blade",
    "cost": 2500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/diffusal_blade.png"
  },
  "175": {
    "id": 175,
    "name": "item_recipe_ethereal_blade",
    "displayName": "Ethereal Blade Recipe",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "176": {
    "id": 176,
    "name": "item_ethereal_blade",
    "displayName": "Ethereal Blade",
    "cost": 5200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ethereal_blade.png"
  },
  "177": {
    "id": 177,
    "name": "item_recipe_soul_ring",
    "displayName": "Soul Ring Recipe",
    "cost": 350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "178": {
    "id": 178,
    "name": "item_soul_ring",
    "displayName": "Soul Ring",
    "cost": 805,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/soul_ring.png"
  },
  "179": {
    "id": 179,
    "name": "item_recipe_arcane_boots",
    "displayName": "Arcane Boots Recipe",
    "cost": 325,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "180": {
    "id": 180,
    "name": "item_arcane_boots",
    "displayName": "Arcane Boots",
    "cost": 1500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/arcane_boots.png"
  },
  "181": {
    "id": 181,
    "name": "item_orb_of_venom",
    "displayName": "Orb of Venom",
    "cost": 350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/orb_of_venom.png"
  },
  "182": {
    "id": 182,
    "name": "item_stout_shield",
    "displayName": "Stout Shield",
    "cost": 100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/stout_shield.png"
  },
  "183": {
    "id": 183,
    "name": "item_recipe_invis_sword",
    "displayName": "Recipe Invis Sword",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "184": {
    "id": 184,
    "name": "item_recipe_ancient_janggo",
    "displayName": "Drum of Endurance Recipe",
    "cost": 525,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "185": {
    "id": 185,
    "name": "item_ancient_janggo",
    "displayName": "Drum of Endurance",
    "cost": 1625,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ancient_janggo.png"
  },
  "186": {
    "id": 186,
    "name": "item_recipe_medallion_of_courage",
    "displayName": "Recipe Medallion Of Courage",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "187": {
    "id": 187,
    "name": "item_medallion_of_courage",
    "displayName": "Medallion of Courage",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/medallion_of_courage.png"
  },
  "188": {
    "id": 188,
    "name": "item_smoke_of_deceit",
    "displayName": "Smoke of Deceit",
    "cost": 50,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/smoke_of_deceit.png"
  },
  "189": {
    "id": 189,
    "name": "item_recipe_veil_of_discord",
    "displayName": "Veil of Discord Recipe",
    "cost": 350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "190": {
    "id": 190,
    "name": "item_veil_of_discord",
    "displayName": "Veil of Discord",
    "cost": 1700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/veil_of_discord.png"
  },
  "191": {
    "id": 191,
    "name": "item_recipe_necronomicon_2",
    "displayName": "Recipe Necronomicon 2",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "192": {
    "id": 192,
    "name": "item_recipe_necronomicon_3",
    "displayName": "Recipe Necronomicon 3",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "193": {
    "id": 193,
    "name": "item_necronomicon_2",
    "displayName": "Necronomicon",
    "cost": 3300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/necronomicon_2.png"
  },
  "194": {
    "id": 194,
    "name": "item_necronomicon_3",
    "displayName": "Necronomicon",
    "cost": 4550,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/necronomicon_3.png"
  },
  "196": {
    "id": 196,
    "name": "item_diffusal_blade_2",
    "displayName": "Diffusal Blade",
    "cost": 3850,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/diffusal_blade_2.png"
  },
  "197": {
    "id": 197,
    "name": "item_recipe_dagon_2",
    "displayName": "Recipe Dagon 2",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "198": {
    "id": 198,
    "name": "item_recipe_dagon_3",
    "displayName": "Recipe Dagon 3",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "199": {
    "id": 199,
    "name": "item_recipe_dagon_4",
    "displayName": "Recipe Dagon 4",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "200": {
    "id": 200,
    "name": "item_recipe_dagon_5",
    "displayName": "Recipe Dagon 5",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "201": {
    "id": 201,
    "name": "item_dagon_2",
    "displayName": "Dagon",
    "cost": 4200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dagon_2.png"
  },
  "202": {
    "id": 202,
    "name": "item_dagon_3",
    "displayName": "Dagon",
    "cost": 5350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dagon_3.png"
  },
  "203": {
    "id": 203,
    "name": "item_dagon_4",
    "displayName": "Dagon",
    "cost": 6500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dagon_4.png"
  },
  "204": {
    "id": 204,
    "name": "item_dagon_5",
    "displayName": "Dagon",
    "cost": 7650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dagon_5.png"
  },
  "205": {
    "id": 205,
    "name": "item_recipe_rod_of_atos",
    "displayName": "Rod of Atos Recipe",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "206": {
    "id": 206,
    "name": "item_rod_of_atos",
    "displayName": "Rod of Atos",
    "cost": 2250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/rod_of_atos.png"
  },
  "207": {
    "id": 207,
    "name": "item_recipe_abyssal_blade",
    "displayName": "Abyssal Blade Recipe",
    "cost": 1275,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "208": {
    "id": 208,
    "name": "item_abyssal_blade",
    "displayName": "Abyssal Blade",
    "cost": 6250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/abyssal_blade.png"
  },
  "209": {
    "id": 209,
    "name": "item_recipe_heavens_halberd",
    "displayName": "Heaven's Halberd Recipe",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "210": {
    "id": 210,
    "name": "item_heavens_halberd",
    "displayName": "Heaven's Halberd",
    "cost": 3400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/heavens_halberd.png"
  },
  "211": {
    "id": 211,
    "name": "item_recipe_ring_of_aquila",
    "displayName": "Recipe Ring Of Aquila",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "212": {
    "id": 212,
    "name": "item_ring_of_aquila",
    "displayName": "Ring of Aquila",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ring_of_aquila.png"
  },
  "213": {
    "id": 213,
    "name": "item_recipe_tranquil_boots",
    "displayName": "Recipe Tranquil Boots",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "214": {
    "id": 214,
    "name": "item_tranquil_boots",
    "displayName": "Tranquil Boots",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tranquil_boots.png"
  },
  "215": {
    "id": 215,
    "name": "item_shadow_amulet",
    "displayName": "Shadow Amulet",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/shadow_amulet.png"
  },
  "216": {
    "id": 216,
    "name": "item_enchanted_mango",
    "displayName": "Enchanted Mango",
    "cost": 65,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enchanted_mango.png"
  },
  "217": {
    "id": 217,
    "name": "item_recipe_ward_dispenser",
    "displayName": "Recipe Ward Dispenser",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "218": {
    "id": 218,
    "name": "item_ward_dispenser",
    "displayName": "Observer and Sentry Wards",
    "cost": 50,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_dispenser.png"
  },
  "219": {
    "id": 219,
    "name": "item_recipe_travel_boots_2",
    "displayName": "Recipe Travel Boots 2",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "220": {
    "id": 220,
    "name": "item_travel_boots_2",
    "displayName": "Boots of Travel 2",
    "cost": 4500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/travel_boots_2.png"
  },
  "221": {
    "id": 221,
    "name": "item_recipe_lotus_orb",
    "displayName": "Lotus Orb Recipe",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "222": {
    "id": 222,
    "name": "item_recipe_meteor_hammer",
    "displayName": "Meteor Hammer Recipe",
    "cost": 300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "223": {
    "id": 223,
    "name": "item_meteor_hammer",
    "displayName": "Meteor Hammer",
    "cost": 2850,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/meteor_hammer.png"
  },
  "224": {
    "id": 224,
    "name": "item_recipe_nullifier",
    "displayName": "Recipe Nullifier",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "225": {
    "id": 225,
    "name": "item_nullifier",
    "displayName": "Nullifier",
    "cost": 4350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/nullifier.png"
  },
  "226": {
    "id": 226,
    "name": "item_lotus_orb",
    "displayName": "Lotus Orb",
    "cost": 3850,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/lotus_orb.png"
  },
  "227": {
    "id": 227,
    "name": "item_recipe_solar_crest",
    "displayName": "Solar Crest Recipe",
    "cost": 500,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "228": {
    "id": 228,
    "name": "item_recipe_octarine_core",
    "displayName": "Octarine Core Recipe",
    "cost": 200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "229": {
    "id": 229,
    "name": "item_solar_crest",
    "displayName": "Solar Crest",
    "cost": 2575,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/solar_crest.png"
  },
  "230": {
    "id": 230,
    "name": "item_recipe_guardian_greaves",
    "displayName": "Guardian Greaves Recipe",
    "cost": 1175,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "231": {
    "id": 231,
    "name": "item_guardian_greaves",
    "displayName": "Guardian Greaves",
    "cost": 4450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/guardian_greaves.png"
  },
  "232": {
    "id": 232,
    "name": "item_aether_lens",
    "displayName": "Aether Lens",
    "cost": 2275,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aether_lens.png"
  },
  "233": {
    "id": 233,
    "name": "item_recipe_aether_lens",
    "displayName": "Aether Lens Recipe",
    "cost": 775,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "234": {
    "id": 234,
    "name": "item_recipe_dragon_lance",
    "displayName": "Dragon Lance Recipe",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "235": {
    "id": 235,
    "name": "item_octarine_core",
    "displayName": "Octarine Core",
    "cost": 4900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/octarine_core.png"
  },
  "236": {
    "id": 236,
    "name": "item_dragon_lance",
    "displayName": "Dragon Lance",
    "cost": 1900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dragon_lance.png"
  },
  "237": {
    "id": 237,
    "name": "item_faerie_fire",
    "displayName": "Faerie Fire",
    "cost": 65,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/faerie_fire.png"
  },
  "238": {
    "id": 238,
    "name": "item_recipe_iron_talon",
    "displayName": "Iron Talon Recipe",
    "cost": 125,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "239": {
    "id": 239,
    "name": "item_iron_talon",
    "displayName": "Iron Talon",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/iron_talon.png"
  },
  "240": {
    "id": 240,
    "name": "item_blight_stone",
    "displayName": "Orb of Blight",
    "cost": 300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blight_stone.png"
  },
  "241": {
    "id": 241,
    "name": "item_tango_single",
    "displayName": "Tango (Shared)",
    "cost": 30,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tango_single.png"
  },
  "242": {
    "id": 242,
    "name": "item_crimson_guard",
    "displayName": "Crimson Guard",
    "cost": 3725,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/crimson_guard.png"
  },
  "243": {
    "id": 243,
    "name": "item_recipe_crimson_guard",
    "displayName": "Crimson Guard Recipe",
    "cost": 1050,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "244": {
    "id": 244,
    "name": "item_wind_lace",
    "displayName": "Wind Lace",
    "cost": 225,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wind_lace.png"
  },
  "245": {
    "id": 245,
    "name": "item_recipe_bloodthorn",
    "displayName": "Bloodthorn Recipe",
    "cost": 600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "246": {
    "id": 246,
    "name": "item_recipe_moon_shard",
    "displayName": "Recipe Moon Shard",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "247": {
    "id": 247,
    "name": "item_moon_shard",
    "displayName": "Moon Shard",
    "cost": 4000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/moon_shard.png"
  },
  "248": {
    "id": 248,
    "name": "item_recipe_silver_edge",
    "displayName": "Silver Edge Recipe",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "249": {
    "id": 249,
    "name": "item_silver_edge",
    "displayName": "Silver Edge",
    "cost": 5700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/silver_edge.png"
  },
  "250": {
    "id": 250,
    "name": "item_bloodthorn",
    "displayName": "Bloodthorn",
    "cost": 6400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/bloodthorn.png"
  },
  "251": {
    "id": 251,
    "name": "item_recipe_echo_sabre",
    "displayName": "Recipe Echo Sabre",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "252": {
    "id": 252,
    "name": "item_echo_sabre",
    "displayName": "Echo Sabre",
    "cost": 2700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/echo_sabre.png"
  },
  "253": {
    "id": 253,
    "name": "item_recipe_glimmer_cape",
    "displayName": "Glimmer Cape Recipe",
    "cost": 800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "254": {
    "id": 254,
    "name": "item_glimmer_cape",
    "displayName": "Glimmer Cape",
    "cost": 2150,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/glimmer_cape.png"
  },
  "255": {
    "id": 255,
    "name": "item_recipe_aeon_disk",
    "displayName": "Aeon Disk Recipe",
    "cost": 1200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "256": {
    "id": 256,
    "name": "item_aeon_disk",
    "displayName": "Aeon Disk",
    "cost": 3000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aeon_disk.png"
  },
  "257": {
    "id": 257,
    "name": "item_tome_of_knowledge",
    "displayName": "Tome of Knowledge",
    "cost": 75,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tome_of_knowledge.png"
  },
  "258": {
    "id": 258,
    "name": "item_recipe_kaya",
    "displayName": "Kaya Recipe",
    "cost": 650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "259": {
    "id": 259,
    "name": "item_kaya",
    "displayName": "Kaya",
    "cost": 2100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/kaya.png"
  },
  "260": {
    "id": 260,
    "name": "item_refresher_shard",
    "displayName": "Refresher Shard",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/refresher_shard.png"
  },
  "261": {
    "id": 261,
    "name": "item_crown",
    "displayName": "Crown",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/crown.png"
  },
  "262": {
    "id": 262,
    "name": "item_recipe_hurricane_pike",
    "displayName": "Hurricane Pike Recipe",
    "cost": 350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "263": {
    "id": 263,
    "name": "item_hurricane_pike",
    "displayName": "Hurricane Pike",
    "cost": 4450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/hurricane_pike.png"
  },
  "265": {
    "id": 265,
    "name": "item_infused_raindrop",
    "displayName": "Infused Raindrops",
    "cost": 225,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/infused_raindrop.png"
  },
  "266": {
    "id": 266,
    "name": "item_recipe_spirit_vessel",
    "displayName": "Spirit Vessel Recipe",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "267": {
    "id": 267,
    "name": "item_spirit_vessel",
    "displayName": "Spirit Vessel",
    "cost": 2725,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/spirit_vessel.png"
  },
  "268": {
    "id": 268,
    "name": "item_recipe_holy_locket",
    "displayName": "Holy Locket Recipe",
    "cost": 1340,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "269": {
    "id": 269,
    "name": "item_holy_locket",
    "displayName": "Holy Locket",
    "cost": 2250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/holy_locket.png"
  },
  "270": {
    "id": 270,
    "name": "item_recipe_ultimate_scepter_2",
    "displayName": "Aghanim's Blessing Recipe",
    "cost": 1600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "271": {
    "id": 271,
    "name": "item_ultimate_scepter_2",
    "displayName": "Aghanim's Blessing",
    "cost": 5800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ultimate_scepter_2.png"
  },
  "272": {
    "id": 272,
    "name": "item_recipe_kaya_and_sange",
    "displayName": "Recipe Kaya And Sange",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "273": {
    "id": 273,
    "name": "item_kaya_and_sange",
    "displayName": "Kaya and Sange",
    "cost": 4200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/kaya_and_sange.png"
  },
  "274": {
    "id": 274,
    "name": "item_recipe_yasha_and_kaya",
    "displayName": "Recipe Yasha And Kaya",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "275": {
    "id": 275,
    "name": "item_recipe_trident",
    "displayName": "Trident Recipe",
    "cost": 1,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "276": {
    "id": 276,
    "name": "item_combo_breaker",
    "displayName": "Combo Breaker",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/combo_breaker.png"
  },
  "277": {
    "id": 277,
    "name": "item_yasha_and_kaya",
    "displayName": "Yasha and Kaya",
    "cost": 4200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/yasha_and_kaya.png"
  },
  "279": {
    "id": 279,
    "name": "item_ring_of_tarrasque",
    "displayName": "Ring of Tarrasque",
    "cost": 1700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ring_of_tarrasque.png"
  },
  "286": {
    "id": 286,
    "name": "item_flying_courier",
    "displayName": "Flying Courier",
    "cost": 100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/flying_courier.png"
  },
  "287": {
    "id": 287,
    "name": "item_keen_optic",
    "displayName": "Keen Optic",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/keen_optic.png"
  },
  "288": {
    "id": 288,
    "name": "item_grove_bow",
    "displayName": "Grove Bow",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/grove_bow.png"
  },
  "289": {
    "id": 289,
    "name": "item_quickening_charm",
    "displayName": "Quickening Charm",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/quickening_charm.png"
  },
  "290": {
    "id": 290,
    "name": "item_philosophers_stone",
    "displayName": "Philosopher's Stone",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/philosophers_stone.png"
  },
  "291": {
    "id": 291,
    "name": "item_force_boots",
    "displayName": "Force Boots",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/force_boots.png"
  },
  "292": {
    "id": 292,
    "name": "item_desolator_2",
    "displayName": "Stygian Desolator",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/desolator_2.png"
  },
  "293": {
    "id": 293,
    "name": "item_phoenix_ash",
    "displayName": "Phoenix Ash",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/phoenix_ash.png"
  },
  "294": {
    "id": 294,
    "name": "item_seer_stone",
    "displayName": "Seer Stone",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/seer_stone.png"
  },
  "295": {
    "id": 295,
    "name": "item_greater_mango",
    "displayName": "Greater Mango",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/greater_mango.png"
  },
  "297": {
    "id": 297,
    "name": "item_vampire_fangs",
    "displayName": "Vampire Fangs",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/vampire_fangs.png"
  },
  "298": {
    "id": 298,
    "name": "item_craggy_coat",
    "displayName": "Craggy Coat",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/craggy_coat.png"
  },
  "299": {
    "id": 299,
    "name": "item_greater_faerie_fire",
    "displayName": "Greater Faerie Fire",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/greater_faerie_fire.png"
  },
  "300": {
    "id": 300,
    "name": "item_timeless_relic",
    "displayName": "Timeless Relic",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/timeless_relic.png"
  },
  "301": {
    "id": 301,
    "name": "item_mirror_shield",
    "displayName": "Mirror Shield",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mirror_shield.png"
  },
  "302": {
    "id": 302,
    "name": "item_elixer",
    "displayName": "Elixir",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/elixer.png"
  },
  "303": {
    "id": 303,
    "name": "item_recipe_ironwood_tree",
    "displayName": "Recipe Ironwood Tree",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "304": {
    "id": 304,
    "name": "item_ironwood_tree",
    "displayName": "Ironwood Tree",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ironwood_tree.png"
  },
  "305": {
    "id": 305,
    "name": "item_royal_jelly",
    "displayName": "Royal Jelly",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/royal_jelly.png"
  },
  "306": {
    "id": 306,
    "name": "item_pupils_gift",
    "displayName": "Pupil's Gift",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pupils_gift.png"
  },
  "307": {
    "id": 307,
    "name": "item_tome_of_aghanim",
    "displayName": "Tome of Aghanim",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tome_of_aghanim.png"
  },
  "308": {
    "id": 308,
    "name": "item_repair_kit",
    "displayName": "Repair Kit",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/repair_kit.png"
  },
  "309": {
    "id": 309,
    "name": "item_mind_breaker",
    "displayName": "Mind Breaker",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mind_breaker.png"
  },
  "310": {
    "id": 310,
    "name": "item_third_eye",
    "displayName": "Third Eye",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/third_eye.png"
  },
  "311": {
    "id": 311,
    "name": "item_spell_prism",
    "displayName": "Spell Prism",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/spell_prism.png"
  },
  "312": {
    "id": 312,
    "name": "item_horizon",
    "displayName": "Horizon",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/horizon.png"
  },
  "313": {
    "id": 313,
    "name": "item_fusion_rune",
    "displayName": "Fusion Rune",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/fusion_rune.png"
  },
  "317": {
    "id": 317,
    "name": "item_recipe_fallen_sky",
    "displayName": "Recipe Fallen Sky",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "325": {
    "id": 325,
    "name": "item_princes_knife",
    "displayName": "Prince's Knife",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/princes_knife.png"
  },
  "326": {
    "id": 326,
    "name": "item_spider_legs",
    "displayName": "Spider Legs",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/spider_legs.png"
  },
  "327": {
    "id": 327,
    "name": "item_helm_of_the_undying",
    "displayName": "Helm of the Undying",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/helm_of_the_undying.png"
  },
  "328": {
    "id": 328,
    "name": "item_mango_tree",
    "displayName": "Mango Tree",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mango_tree.png"
  },
  "330": {
    "id": 330,
    "name": "item_witless_shako",
    "displayName": "Witless Shako",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/witless_shako.png"
  },
  "331": {
    "id": 331,
    "name": "item_vambrace",
    "displayName": "Vambrace",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/vambrace.png"
  },
  "334": {
    "id": 334,
    "name": "item_imp_claw",
    "displayName": "Imp Claw",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/imp_claw.png"
  },
  "335": {
    "id": 335,
    "name": "item_flicker",
    "displayName": "Flicker",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/flicker.png"
  },
  "336": {
    "id": 336,
    "name": "item_spy_gadget",
    "displayName": "Telescope",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/spy_gadget.png"
  },
  "349": {
    "id": 349,
    "name": "item_arcane_ring",
    "displayName": "Arcane Ring",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/arcane_ring.png"
  },
  "354": {
    "id": 354,
    "name": "item_ocean_heart",
    "displayName": "Ocean Heart",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ocean_heart.png"
  },
  "355": {
    "id": 355,
    "name": "item_broom_handle",
    "displayName": "Broom Handle",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/broom_handle.png"
  },
  "356": {
    "id": 356,
    "name": "item_trusty_shovel",
    "displayName": "Trusty Shovel",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/trusty_shovel.png"
  },
  "357": {
    "id": 357,
    "name": "item_nether_shawl",
    "displayName": "Nether Shawl",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/nether_shawl.png"
  },
  "358": {
    "id": 358,
    "name": "item_dragon_scale",
    "displayName": "Dragon Scale",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dragon_scale.png"
  },
  "359": {
    "id": 359,
    "name": "item_essence_ring",
    "displayName": "Essence Ring",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/essence_ring.png"
  },
  "360": {
    "id": 360,
    "name": "item_clumsy_net",
    "displayName": "Clumsy Net",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/clumsy_net.png"
  },
  "361": {
    "id": 361,
    "name": "item_enchanted_quiver",
    "displayName": "Enchanted Quiver",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enchanted_quiver.png"
  },
  "362": {
    "id": 362,
    "name": "item_ninja_gear",
    "displayName": "Ninja Gear",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ninja_gear.png"
  },
  "363": {
    "id": 363,
    "name": "item_illusionsts_cape",
    "displayName": "Illusionist's Cape",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/illusionsts_cape.png"
  },
  "364": {
    "id": 364,
    "name": "item_havoc_hammer",
    "displayName": "Havoc Hammer",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/havoc_hammer.png"
  },
  "365": {
    "id": 365,
    "name": "item_panic_button",
    "displayName": "Magic Lamp",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/panic_button.png"
  },
  "366": {
    "id": 366,
    "name": "item_apex",
    "displayName": "Apex",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/apex.png"
  },
  "367": {
    "id": 367,
    "name": "item_ballista",
    "displayName": "Ballista",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ballista.png"
  },
  "368": {
    "id": 368,
    "name": "item_woodland_striders",
    "displayName": "Woodland Striders",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/woodland_striders.png"
  },
  "369": {
    "id": 369,
    "name": "item_trident",
    "displayName": "Trident",
    "cost": 6301,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/trident.png"
  },
  "370": {
    "id": 370,
    "name": "item_demonicon",
    "displayName": "Book of the Dead",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/demonicon.png"
  },
  "371": {
    "id": 371,
    "name": "item_fallen_sky",
    "displayName": "Fallen Sky",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/fallen_sky.png"
  },
  "372": {
    "id": 372,
    "name": "item_pirate_hat",
    "displayName": "Pirate Hat",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pirate_hat.png"
  },
  "373": {
    "id": 373,
    "name": "item_dimensional_doorway",
    "displayName": "Dimensional Doorway",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dimensional_doorway.png"
  },
  "374": {
    "id": 374,
    "name": "item_ex_machina",
    "displayName": "Ex Machina",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ex_machina.png"
  },
  "375": {
    "id": 375,
    "name": "item_faded_broach",
    "displayName": "Faded Broach",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/faded_broach.png"
  },
  "376": {
    "id": 376,
    "name": "item_paladin_sword",
    "displayName": "Paladin Sword",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/paladin_sword.png"
  },
  "377": {
    "id": 377,
    "name": "item_minotaur_horn",
    "displayName": "Minotaur Horn",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/minotaur_horn.png"
  },
  "378": {
    "id": 378,
    "name": "item_orb_of_destruction",
    "displayName": "Orb of Destruction",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/orb_of_destruction.png"
  },
  "379": {
    "id": 379,
    "name": "item_the_leveller",
    "displayName": "The Leveller",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/the_leveller.png"
  },
  "381": {
    "id": 381,
    "name": "item_titan_sliver",
    "displayName": "Titan Sliver",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/titan_sliver.png"
  },
  "473": {
    "id": 473,
    "name": "item_voodoo_mask",
    "displayName": "Voodoo Mask",
    "cost": 650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/voodoo_mask.png"
  },
  "485": {
    "id": 485,
    "name": "item_blitz_knuckles",
    "displayName": "Blitz Knuckles",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blitz_knuckles.png"
  },
  "533": {
    "id": 533,
    "name": "item_recipe_witch_blade",
    "displayName": "Witch Blade Recipe",
    "cost": 300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "534": {
    "id": 534,
    "name": "item_witch_blade",
    "displayName": "Witch Blade",
    "cost": 2775,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/witch_blade.png"
  },
  "565": {
    "id": 565,
    "name": "item_chipped_vest",
    "displayName": "Chipped Vest",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/chipped_vest.png"
  },
  "566": {
    "id": 566,
    "name": "item_wizard_glass",
    "displayName": "Wizard Glass",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wizard_glass.png"
  },
  "569": {
    "id": 569,
    "name": "item_orb_of_corrosion",
    "displayName": "Orb of Corrosion",
    "cost": 1050,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/orb_of_corrosion.png"
  },
  "570": {
    "id": 570,
    "name": "item_gloves_of_travel",
    "displayName": "Gloves Of Travel",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gloves_of_travel.png"
  },
  "571": {
    "id": 571,
    "name": "item_trickster_cloak",
    "displayName": "Trickster Cloak",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/trickster_cloak.png"
  },
  "573": {
    "id": 573,
    "name": "item_elven_tunic",
    "displayName": "Elven Tunic",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/elven_tunic.png"
  },
  "574": {
    "id": 574,
    "name": "item_cloak_of_flames",
    "displayName": "Cloak of Flames",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/cloak_of_flames.png"
  },
  "575": {
    "id": 575,
    "name": "item_venom_gland",
    "displayName": "Venom Gland",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/venom_gland.png"
  },
  "576": {
    "id": 576,
    "name": "item_gladiator_helm",
    "displayName": "Gladiator Helm",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gladiator_helm.png"
  },
  "577": {
    "id": 577,
    "name": "item_possessed_mask",
    "displayName": "Possessed Mask",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/possessed_mask.png"
  },
  "578": {
    "id": 578,
    "name": "item_ancient_perseverance",
    "displayName": "Ancient Perseverance",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ancient_perseverance.png"
  },
  "582": {
    "id": 582,
    "name": "item_oakheart",
    "displayName": "Oakheart",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/oakheart.png"
  },
  "585": {
    "id": 585,
    "name": "item_stormcrafter",
    "displayName": "Stormcrafter",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/stormcrafter.png"
  },
  "588": {
    "id": 588,
    "name": "item_overflowing_elixir",
    "displayName": "Overflowing Elixir",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/overflowing_elixir.png"
  },
  "589": {
    "id": 589,
    "name": "item_mysterious_hat",
    "displayName": "Fairy's Trinket",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mysterious_hat.png"
  },
  "593": {
    "id": 593,
    "name": "item_fluffy_hat",
    "displayName": "Fluffy Hat",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/fluffy_hat.png"
  },
  "596": {
    "id": 596,
    "name": "item_falcon_blade",
    "displayName": "Falcon Blade",
    "cost": 1125,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/falcon_blade.png"
  },
  "597": {
    "id": 597,
    "name": "item_recipe_mage_slayer",
    "displayName": "Recipe Mage Slayer",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "598": {
    "id": 598,
    "name": "item_mage_slayer",
    "displayName": "Mage Slayer",
    "cost": 3100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mage_slayer.png"
  },
  "599": {
    "id": 599,
    "name": "item_recipe_falcon_blade",
    "displayName": "Falcon Blade Recipe",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "600": {
    "id": 600,
    "name": "item_overwhelming_blink",
    "displayName": "Overwhelming Blink",
    "cost": 6800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/overwhelming_blink.png"
  },
  "603": {
    "id": 603,
    "name": "item_swift_blink",
    "displayName": "Swift Blink",
    "cost": 6800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/swift_blink.png"
  },
  "604": {
    "id": 604,
    "name": "item_arcane_blink",
    "displayName": "Arcane Blink",
    "cost": 6800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/arcane_blink.png"
  },
  "606": {
    "id": 606,
    "name": "item_recipe_arcane_blink",
    "displayName": "Arcane Blink Recipe",
    "cost": 1750,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "607": {
    "id": 607,
    "name": "item_recipe_swift_blink",
    "displayName": "Swift Blink Recipe",
    "cost": 1750,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "608": {
    "id": 608,
    "name": "item_recipe_overwhelming_blink",
    "displayName": "Overwhelming Blink Recipe",
    "cost": 1750,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "609": {
    "id": 609,
    "name": "item_aghanims_shard",
    "displayName": "Aghanim's Shard",
    "cost": 1400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aghanims_shard.png"
  },
  "610": {
    "id": 610,
    "name": "item_wind_waker",
    "displayName": "Wind Waker",
    "cost": 6800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wind_waker.png"
  },
  "612": {
    "id": 612,
    "name": "item_recipe_wind_waker",
    "displayName": "Wind Waker Recipe",
    "cost": 1400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "633": {
    "id": 633,
    "name": "item_recipe_helm_of_the_overlord",
    "displayName": "Helm of the Overlord Recipe",
    "cost": 300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "635": {
    "id": 635,
    "name": "item_helm_of_the_overlord",
    "displayName": "Helm of the Overlord",
    "cost": 5650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/helm_of_the_overlord.png"
  },
  "637": {
    "id": 637,
    "name": "item_star_mace",
    "displayName": "Star Mace",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/star_mace.png"
  },
  "638": {
    "id": 638,
    "name": "item_penta_edged_sword",
    "displayName": "Penta-Edged Sword",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/penta_edged_sword.png"
  },
  "640": {
    "id": 640,
    "name": "item_recipe_orb_of_corrosion",
    "displayName": "Recipe Orb Of Corrosion",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "653": {
    "id": 653,
    "name": "item_recipe_grandmasters_glaive",
    "displayName": "Recipe Grandmasters Glaive",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "655": {
    "id": 655,
    "name": "item_grandmasters_glaive",
    "displayName": "Grandmasters Glaive",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/grandmasters_glaive.png"
  },
  "674": {
    "id": 674,
    "name": "item_warhammer",
    "displayName": "Warhammer",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/warhammer.png"
  },
  "675": {
    "id": 675,
    "name": "item_psychic_headband",
    "displayName": "Psychic Headband",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/psychic_headband.png"
  },
  "676": {
    "id": 676,
    "name": "item_ceremonial_robe",
    "displayName": "Ceremonial Robe",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ceremonial_robe.png"
  },
  "677": {
    "id": 677,
    "name": "item_book_of_shadows",
    "displayName": "Book of Shadows",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/book_of_shadows.png"
  },
  "678": {
    "id": 678,
    "name": "item_giants_ring",
    "displayName": "Giant's Ring",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/giants_ring.png"
  },
  "679": {
    "id": 679,
    "name": "item_vengeances_shadow",
    "displayName": "Vengeances Shadow",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/vengeances_shadow.png"
  },
  "680": {
    "id": 680,
    "name": "item_bullwhip",
    "displayName": "Bullwhip",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/bullwhip.png"
  },
  "686": {
    "id": 686,
    "name": "item_quicksilver_amulet",
    "displayName": "Quicksilver Amulet",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/quicksilver_amulet.png"
  },
  "691": {
    "id": 691,
    "name": "item_recipe_eternal_shroud",
    "displayName": "Eternal Shroud Recipe",
    "cost": 900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "692": {
    "id": 692,
    "name": "item_eternal_shroud",
    "displayName": "Eternal Shroud",
    "cost": 3900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/eternal_shroud.png"
  },
  "725": {
    "id": 725,
    "name": "item_aghanims_shard_roshan",
    "displayName": "Aghanim's Shard - Consumable",
    "cost": 1400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aghanims_shard_roshan.png"
  },
  "727": {
    "id": 727,
    "name": "item_ultimate_scepter_roshan",
    "displayName": "Aghanim's Blessing - Roshan",
    "cost": 5800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ultimate_scepter_roshan.png"
  },
  "731": {
    "id": 731,
    "name": "item_satchel",
    "displayName": "Satchel",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/satchel.png"
  },
  "824": {
    "id": 824,
    "name": "item_assassins_dagger",
    "displayName": "Assassins Dagger",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/assassins_dagger.png"
  },
  "825": {
    "id": 825,
    "name": "item_ascetic_cap",
    "displayName": "Ascetic's Cap",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ascetic_cap.png"
  },
  "826": {
    "id": 826,
    "name": "item_sample_picker",
    "displayName": "Sample Picker",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/sample_picker.png"
  },
  "827": {
    "id": 827,
    "name": "item_icarus_wings",
    "displayName": "Icarus Wings",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/icarus_wings.png"
  },
  "828": {
    "id": 828,
    "name": "item_misericorde",
    "displayName": "Brigand's Blade",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/misericorde.png"
  },
  "829": {
    "id": 829,
    "name": "item_force_field",
    "displayName": "Arcanist's Armor",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/force_field.png"
  },
  "834": {
    "id": 834,
    "name": "item_black_powder_bag",
    "displayName": "Blast Rig",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/black_powder_bag.png"
  },
  "835": {
    "id": 835,
    "name": "item_paintball",
    "displayName": "Fae Grenade",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/paintball.png"
  },
  "836": {
    "id": 836,
    "name": "item_light_robes",
    "displayName": "Light Robes",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/light_robes.png"
  },
  "837": {
    "id": 837,
    "name": "item_heavy_blade",
    "displayName": "Witchbane",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/heavy_blade.png"
  },
  "838": {
    "id": 838,
    "name": "item_unstable_wand",
    "displayName": "Pig Pole",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/unstable_wand.png"
  },
  "839": {
    "id": 839,
    "name": "item_fortitude_ring",
    "displayName": "Fortitude Ring",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/fortitude_ring.png"
  },
  "840": {
    "id": 840,
    "name": "item_pogo_stick",
    "displayName": "Tumbler's Toy",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pogo_stick.png"
  },
  "849": {
    "id": 849,
    "name": "item_mechanical_arm",
    "displayName": "Mechanical Arm",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mechanical_arm.png"
  },
  "907": {
    "id": 907,
    "name": "item_recipe_wraith_pact",
    "displayName": "Recipe Wraith Pact",
    "cost": 400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "908": {
    "id": 908,
    "name": "item_wraith_pact",
    "displayName": "Wraith Pact",
    "cost": 3800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wraith_pact.png"
  },
  "910": {
    "id": 910,
    "name": "item_recipe_revenants_brooch",
    "displayName": "Revenant's Brooch Recipe",
    "cost": 650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "911": {
    "id": 911,
    "name": "item_revenants_brooch",
    "displayName": "Revenant's Brooch",
    "cost": 3300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/revenants_brooch.png"
  },
  "930": {
    "id": 930,
    "name": "item_recipe_boots_of_bearing",
    "displayName": "Recipe Boots Of Bearing",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "931": {
    "id": 931,
    "name": "item_boots_of_bearing",
    "displayName": "Boots of Bearing",
    "cost": 4225,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/boots_of_bearing.png"
  },
  "938": {
    "id": 938,
    "name": "item_slime_vial",
    "displayName": "Slime Vial",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/slime_vial.png"
  },
  "939": {
    "id": 939,
    "name": "item_harpoon",
    "displayName": "Harpoon",
    "cost": 4700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/harpoon.png"
  },
  "940": {
    "id": 940,
    "name": "item_wand_of_the_brine",
    "displayName": "Wand Of The Brine",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wand_of_the_brine.png"
  },
  "945": {
    "id": 945,
    "name": "item_seeds_of_serenity",
    "displayName": "Seeds of Serenity",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/seeds_of_serenity.png"
  },
  "946": {
    "id": 946,
    "name": "item_lance_of_pursuit",
    "displayName": "Lance of Pursuit",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/lance_of_pursuit.png"
  },
  "947": {
    "id": 947,
    "name": "item_occult_bracelet",
    "displayName": "Occult Bracelet",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/occult_bracelet.png"
  },
  "948": {
    "id": 948,
    "name": "item_tome_of_omniscience",
    "displayName": "Tome Of Omniscience",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tome_of_omniscience.png"
  },
  "949": {
    "id": 949,
    "name": "item_ogre_seal_totem",
    "displayName": "Ogre Seal Totem",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ogre_seal_totem.png"
  },
  "950": {
    "id": 950,
    "name": "item_defiant_shell",
    "displayName": "Defiant Shell",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/defiant_shell.png"
  },
  "968": {
    "id": 968,
    "name": "item_arcane_scout",
    "displayName": "Arcane Scout",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/arcane_scout.png"
  },
  "969": {
    "id": 969,
    "name": "item_barricade",
    "displayName": "Barricade",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/barricade.png"
  },
  "990": {
    "id": 990,
    "name": "item_eye_of_the_vizier",
    "displayName": "Eye of the Vizier",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/eye_of_the_vizier.png"
  },
  "998": {
    "id": 998,
    "name": "item_manacles_of_power",
    "displayName": "Manacles Of Power",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/manacles_of_power.png"
  },
  "1000": {
    "id": 1000,
    "name": "item_bottomless_chalice",
    "displayName": "Bottomless Chalice",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/bottomless_chalice.png"
  },
  "1017": {
    "id": 1017,
    "name": "item_wand_of_sanctitude",
    "displayName": "Wand Of Sanctitude",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wand_of_sanctitude.png"
  },
  "1021": {
    "id": 1021,
    "name": "item_river_painter",
    "displayName": "River Vial: Chrome",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/river_painter.png"
  },
  "1022": {
    "id": 1022,
    "name": "item_river_painter2",
    "displayName": "River Vial: Dry",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/river_painter2.png"
  },
  "1023": {
    "id": 1023,
    "name": "item_river_painter3",
    "displayName": "River Vial: Slime",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/river_painter3.png"
  },
  "1024": {
    "id": 1024,
    "name": "item_river_painter4",
    "displayName": "River Vial: Oil",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/river_painter4.png"
  },
  "1025": {
    "id": 1025,
    "name": "item_river_painter5",
    "displayName": "River Vial: Electrified",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/river_painter5.png"
  },
  "1026": {
    "id": 1026,
    "name": "item_river_painter6",
    "displayName": "River Vial: Potion",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/river_painter6.png"
  },
  "1027": {
    "id": 1027,
    "name": "item_river_painter7",
    "displayName": "River Vial: Blood",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/river_painter7.png"
  },
  "1028": {
    "id": 1028,
    "name": "item_mutation_tombstone",
    "displayName": "Tombstone",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mutation_tombstone.png"
  },
  "1029": {
    "id": 1029,
    "name": "item_super_blink",
    "displayName": "Super Blink",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/super_blink.png"
  },
  "1030": {
    "id": 1030,
    "name": "item_pocket_tower",
    "displayName": "Pocket Tower",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pocket_tower.png"
  },
  "1032": {
    "id": 1032,
    "name": "item_pocket_roshan",
    "displayName": "Pocket Roshan",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pocket_roshan.png"
  },
  "1076": {
    "id": 1076,
    "name": "item_specialists_array",
    "displayName": "Specialist's Array",
    "cost": 2550,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/specialists_array.png"
  },
  "1077": {
    "id": 1077,
    "name": "item_dagger_of_ristul",
    "displayName": "Dagger of Ristul",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dagger_of_ristul.png"
  },
  "1090": {
    "id": 1090,
    "name": "item_muertas_gun",
    "displayName": "Mercy & Grace",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/muertas_gun.png"
  },
  "1091": {
    "id": 1091,
    "name": "item_samurai_tabi",
    "displayName": "Samurai Tabi",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/samurai_tabi.png"
  },
  "1092": {
    "id": 1092,
    "name": "item_recipe_hermes_sandals",
    "displayName": "Recipe Hermes Sandals",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1093": {
    "id": 1093,
    "name": "item_hermes_sandals",
    "displayName": "Hermes Sandals",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/hermes_sandals.png"
  },
  "1094": {
    "id": 1094,
    "name": "item_recipe_lunar_crest",
    "displayName": "Recipe Lunar Crest",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1095": {
    "id": 1095,
    "name": "item_lunar_crest",
    "displayName": "Lunar Crest",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/lunar_crest.png"
  },
  "1096": {
    "id": 1096,
    "name": "item_recipe_disperser",
    "displayName": "Disperser Recipe",
    "cost": 800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1097": {
    "id": 1097,
    "name": "item_disperser",
    "displayName": "Disperser",
    "cost": 6100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/disperser.png"
  },
  "1098": {
    "id": 1098,
    "name": "item_recipe_samurai_tabi",
    "displayName": "Recipe Samurai Tabi",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1099": {
    "id": 1099,
    "name": "item_recipe_witches_switch",
    "displayName": "Recipe Witches Switch",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1100": {
    "id": 1100,
    "name": "item_witches_switch",
    "displayName": "Witches Switch",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/witches_switch.png"
  },
  "1101": {
    "id": 1101,
    "name": "item_recipe_harpoon",
    "displayName": "Harpoon Recipe",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1106": {
    "id": 1106,
    "name": "item_recipe_phylactery",
    "displayName": "Phylactery Recipe",
    "cost": 200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1107": {
    "id": 1107,
    "name": "item_phylactery",
    "displayName": "Phylactery",
    "cost": 2600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/phylactery.png"
  },
  "1122": {
    "id": 1122,
    "name": "item_diadem",
    "displayName": "Diadem",
    "cost": 1000,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/diadem.png"
  },
  "1123": {
    "id": 1123,
    "name": "item_blood_grenade",
    "displayName": "Blood Grenade",
    "cost": 50,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blood_grenade.png"
  },
  "1124": {
    "id": 1124,
    "name": "item_spark_of_courage",
    "displayName": "Spark of Courage",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/spark_of_courage.png"
  },
  "1125": {
    "id": 1125,
    "name": "item_cornucopia",
    "displayName": "Cornucopia",
    "cost": 1200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/cornucopia.png"
  },
  "1127": {
    "id": 1127,
    "name": "item_recipe_pavise",
    "displayName": "Pavise Recipe",
    "cost": 675,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1128": {
    "id": 1128,
    "name": "item_pavise",
    "displayName": "Pavise",
    "cost": 1350,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pavise.png"
  },
  "1154": {
    "id": 1154,
    "name": "item_royale_with_cheese",
    "displayName": "Block of Cheese",
    "cost": 2,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/royale_with_cheese.png"
  },
  "1156": {
    "id": 1156,
    "name": "item_ancient_guardian",
    "displayName": "Ancient Guardian",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ancient_guardian.png"
  },
  "1157": {
    "id": 1157,
    "name": "item_safety_bubble",
    "displayName": "Safety Bubble",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/safety_bubble.png"
  },
  "1158": {
    "id": 1158,
    "name": "item_whisper_of_the_dread",
    "displayName": "Whisper of the Dread",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/whisper_of_the_dread.png"
  },
  "1159": {
    "id": 1159,
    "name": "item_nemesis_curse",
    "displayName": "Nemesis Curse",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/nemesis_curse.png"
  },
  "1160": {
    "id": 1160,
    "name": "item_avianas_feather",
    "displayName": "Aviana's Feather",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/avianas_feather.png"
  },
  "1161": {
    "id": 1161,
    "name": "item_unwavering_condition",
    "displayName": "Unwavering Condition",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/unwavering_condition.png"
  },
  "1162": {
    "id": 1162,
    "name": "item_halo",
    "displayName": "Halo",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/halo.png"
  },
  "1163": {
    "id": 1163,
    "name": "item_recipe_aetherial_halo",
    "displayName": "Recipe Aetherial Halo",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1164": {
    "id": 1164,
    "name": "item_aetherial_halo",
    "displayName": "Aetherial Halo",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aetherial_halo.png"
  },
  "1167": {
    "id": 1167,
    "name": "item_light_collector",
    "displayName": "Light Collector",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/light_collector.png"
  },
  "1168": {
    "id": 1168,
    "name": "item_rattlecage",
    "displayName": "Rattlecage",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/rattlecage.png"
  },
  "1440": {
    "id": 1440,
    "name": "item_black_grimoire",
    "displayName": "Black Grimoire\\n(Warlock)",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/black_grimoire.png"
  },
  "1441": {
    "id": 1441,
    "name": "item_grisgris",
    "displayName": "Gris-Gris",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/grisgris.png"
  },
  "1466": {
    "id": 1466,
    "name": "item_gungir",
    "displayName": "Gleipnir",
    "cost": 4650,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gungir.png"
  },
  "1487": {
    "id": 1487,
    "name": "item_claddish_spyglass",
    "displayName": "Claddish Spyglass",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/spyglass.png"
  },
  "1565": {
    "id": 1565,
    "name": "item_recipe_gungir",
    "displayName": "Gleipnir Recipe",
    "cost": 400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1575": {
    "id": 1575,
    "name": "item_orb_of_frost",
    "displayName": "Orb of Frost",
    "cost": 300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/orb_of_frost.png"
  },
  "1576": {
    "id": 1576,
    "name": "item_enhancement_vast",
    "displayName": "Vast",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_vast.png"
  },
  "1577": {
    "id": 1577,
    "name": "item_enhancement_quickened",
    "displayName": "Quickened",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_quickened.png"
  },
  "1578": {
    "id": 1578,
    "name": "item_cursed_circlet",
    "displayName": "Cursed Circlet",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/cursed_circlet.png"
  },
  "1579": {
    "id": 1579,
    "name": "item_ogre_heart",
    "displayName": "Ogre Heart",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ogre_heart.png"
  },
  "1580": {
    "id": 1580,
    "name": "item_neutral_tabi",
    "displayName": "Neutral Tabi",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/neutral_tabi.png"
  },
  "1581": {
    "id": 1581,
    "name": "item_enhancement_audacious",
    "displayName": "Audacious",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_audacious.png"
  },
  "1582": {
    "id": 1582,
    "name": "item_hellbear_totem",
    "displayName": "Hellbear Totem",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/hellbear_totem.png"
  },
  "1583": {
    "id": 1583,
    "name": "item_enhancement_mystical",
    "displayName": "Mystical",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_mystical.png"
  },
  "1584": {
    "id": 1584,
    "name": "item_enhancement_alert",
    "displayName": "Alert",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_alert.png"
  },
  "1585": {
    "id": 1585,
    "name": "item_enhancement_brawny",
    "displayName": "Brawny",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_brawny.png"
  },
  "1586": {
    "id": 1586,
    "name": "item_enhancement_tough",
    "displayName": "Tough",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_tough.png"
  },
  "1587": {
    "id": 1587,
    "name": "item_enhancement_feverish",
    "displayName": "Feverish",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_feverish.png"
  },
  "1588": {
    "id": 1588,
    "name": "item_enhancement_fleetfooted",
    "displayName": "Fleetfooted",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_fleetfooted.png"
  },
  "1589": {
    "id": 1589,
    "name": "item_enhancement_crude",
    "displayName": "Crude",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_crude.png"
  },
  "1590": {
    "id": 1590,
    "name": "item_enhancement_boundless",
    "displayName": "Boundless",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_boundless.png"
  },
  "1591": {
    "id": 1591,
    "name": "item_enhancement_wise",
    "displayName": "Wise",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_wise.png"
  },
  "1592": {
    "id": 1592,
    "name": "item_enhancement_timeless",
    "displayName": "Timeless",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_timeless.png"
  },
  "1593": {
    "id": 1593,
    "name": "item_enhancement_greedy",
    "displayName": "Greedy",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_greedy.png"
  },
  "1594": {
    "id": 1594,
    "name": "item_enhancement_vampiric",
    "displayName": "Vampiric",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_vampiric.png"
  },
  "1595": {
    "id": 1595,
    "name": "item_enhancement_keen_eyed",
    "displayName": "Keen-eyed",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_keen_eyed.png"
  },
  "1596": {
    "id": 1596,
    "name": "item_enhancement_evolved",
    "displayName": "Evolved",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_evolved.png"
  },
  "1597": {
    "id": 1597,
    "name": "item_enhancement_titanic",
    "displayName": "Titanic",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_titanic.png"
  },
  "1598": {
    "id": 1598,
    "name": "item_unrelenting_eye",
    "displayName": "Unrelenting Eye",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/unrelenting_eye.png"
  },
  "1599": {
    "id": 1599,
    "name": "item_mana_draught",
    "displayName": "Mana Draught",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/mana_draught.png"
  },
  "1600": {
    "id": 1600,
    "name": "item_rippers_lash",
    "displayName": "Ripper's Lash",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/rippers_lash.png"
  },
  "1601": {
    "id": 1601,
    "name": "item_crippling_crossbow",
    "displayName": "Crippling Crossbow",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/crippling_crossbow.png"
  },
  "1602": {
    "id": 1602,
    "name": "item_gale_guard",
    "displayName": "Gale Guard",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gale_guard.png"
  },
  "1603": {
    "id": 1603,
    "name": "item_gunpowder_gauntlets",
    "displayName": "Gunpowder Gauntlet",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gunpowder_gauntlets.png"
  },
  "1604": {
    "id": 1604,
    "name": "item_searing_signet",
    "displayName": "Searing Signet",
    "cost": 0,
    "isNeutral": true,
    "tier": 2,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/searing_signet.png"
  },
  "1605": {
    "id": 1605,
    "name": "item_serrated_shiv",
    "displayName": "Serrated Shiv",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/serrated_shiv.png"
  },
  "1606": {
    "id": 1606,
    "name": "item_polliwog_charm",
    "displayName": "Pollywog Charm",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/polliwog_charm.png"
  },
  "1607": {
    "id": 1607,
    "name": "item_magnifying_monocle",
    "displayName": "Magnifying Monocle",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/magnifying_monocle.png"
  },
  "1608": {
    "id": 1608,
    "name": "item_pyrrhic_cloak",
    "displayName": "Pyrrhic Cloak",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/pyrrhic_cloak.png"
  },
  "1609": {
    "id": 1609,
    "name": "item_madstone_bundle",
    "displayName": "Madstone Bundle",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/madstone_bundle.png"
  },
  "1610": {
    "id": 1610,
    "name": "item_miniboss_minion_summoner",
    "displayName": "Miniboss Minion Summoner",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/miniboss_minion_summoner.png"
  },
  "1636": {
    "id": 1636,
    "name": "item_crystal_raindrop",
    "displayName": "Crystal Raindrop",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/crystal_raindrop.png"
  },
  "1637": {
    "id": 1637,
    "name": "item_kobold_cup",
    "displayName": "Kobold Cup",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/kobold_cup.png"
  },
  "1638": {
    "id": 1638,
    "name": "item_dormant_curio",
    "displayName": "Dormant Curio",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dormant_curio.png"
  },
  "1639": {
    "id": 1639,
    "name": "item_sisters_shroud",
    "displayName": "Sister's Shroud",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/sisters_shroud.png"
  },
  "1640": {
    "id": 1640,
    "name": "item_jidi_pollen_bag",
    "displayName": "Jidi Pollen Bag",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/jidi_pollen_bag.png"
  },
  "1641": {
    "id": 1641,
    "name": "item_outworld_staff",
    "displayName": "Outworld Staff",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/outworld_staff.png"
  },
  "1642": {
    "id": 1642,
    "name": "item_dezun_bloodrite",
    "displayName": "Dezun Bloodrite",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dezun_bloodrite.png"
  },
  "1643": {
    "id": 1643,
    "name": "item_giant_maul",
    "displayName": "Giant's Maul",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/giant_maul.png"
  },
  "1644": {
    "id": 1644,
    "name": "item_divine_regalia",
    "displayName": "Divine Regalia",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/divine_regalia.png"
  },
  "1645": {
    "id": 1645,
    "name": "item_divine_regalia_broken",
    "displayName": "Disgraced Regalia",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/divine_regalia_broken.png"
  },
  "1646": {
    "id": 1646,
    "name": "item_circlet_of_the_flayed_twins",
    "displayName": "Circlet Of The Flayed Twins",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/circlet_of_the_flayed_twins.png"
  },
  "1647": {
    "id": 1647,
    "name": "item_enhancement_fierce",
    "displayName": "Fierce",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_fierce.png"
  },
  "1648": {
    "id": 1648,
    "name": "item_enhancement_dominant",
    "displayName": "Dominant",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_dominant.png"
  },
  "1649": {
    "id": 1649,
    "name": "item_enhancement_restorative",
    "displayName": "Restorative",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_restorative.png"
  },
  "1650": {
    "id": 1650,
    "name": "item_enhancement_thick",
    "displayName": "Thick",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_thick.png"
  },
  "1651": {
    "id": 1651,
    "name": "item_enhancement_curious",
    "displayName": "Unleashed",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_curious.png"
  },
  "1652": {
    "id": 1652,
    "name": "item_furion_gold_bag",
    "displayName": "Bag of Gold",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/furion_gold_bag.png"
  },
  "1715": {
    "id": 1715,
    "name": "item_recipe_specialists_array",
    "displayName": "Recipe Specialists Array",
    "cost": 550,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1716": {
    "id": 1716,
    "name": "item_weighted_dice",
    "displayName": "Weighted Dice",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/weighted_dice.png"
  },
  "1717": {
    "id": 1717,
    "name": "item_ash_legion_shield",
    "displayName": "Ash Legion Shield",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ash_legion_shield.png"
  },
  "1718": {
    "id": 1718,
    "name": "item_riftshadow_prism",
    "displayName": "Riftshadow Prism",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/riftshadow_prism.png"
  },
  "1719": {
    "id": 1719,
    "name": "item_metamorphic_mandible",
    "displayName": "Metamorphic Mandible",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/metamorphic_mandible.png"
  },
  "1720": {
    "id": 1720,
    "name": "item_idol_of_screeauk",
    "displayName": "Idol of Scree'auk",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/idol_of_screeauk.png"
  },
  "1721": {
    "id": 1721,
    "name": "item_flayers_bota",
    "displayName": "Flayer's Bota",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/flayers_bota.png"
  },
  "1800": {
    "id": 1800,
    "name": "item_recipe_caster_rapier",
    "displayName": "Recipe Caster Rapier",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1801": {
    "id": 1801,
    "name": "item_caster_rapier",
    "displayName": "Caster Rapier",
    "cost": 5600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/caster_rapier.png"
  },
  "1802": {
    "id": 1802,
    "name": "item_tiara_of_selemene",
    "displayName": "Tiara of Selemene",
    "cost": 1700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tiara_of_selemene.png"
  },
  "1803": {
    "id": 1803,
    "name": "item_doubloon",
    "displayName": "Doubloon",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/doubloon.png"
  },
  "1804": {
    "id": 1804,
    "name": "item_roshans_banner",
    "displayName": "Roshan's Banner",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/roshans_banner.png"
  },
  "1805": {
    "id": 1805,
    "name": "item_recipe_devastator",
    "displayName": "Parasma Recipe",
    "cost": 400,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1806": {
    "id": 1806,
    "name": "item_devastator",
    "displayName": "Parasma",
    "cost": 5975,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/devastator.png"
  },
  "1807": {
    "id": 1807,
    "name": "item_recipe_angels_demise",
    "displayName": "Recipe Angels Demise",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1808": {
    "id": 1808,
    "name": "item_angels_demise",
    "displayName": "Khanda",
    "cost": 5600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/angels_demise.png"
  },
  "1847": {
    "id": 1847,
    "name": "item_splintmail",
    "displayName": "Splintmail",
    "cost": 950,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/splintmail.png"
  },
  "1848": {
    "id": 1848,
    "name": "item_shawl",
    "displayName": "Shawl",
    "cost": 450,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/shawl.png"
  },
  "1849": {
    "id": 1849,
    "name": "item_wizard_hat",
    "displayName": "Wizard Hat",
    "cost": 250,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/wizard_hat.png"
  },
  "1850": {
    "id": 1850,
    "name": "item_eldwurms_edda",
    "displayName": "Eldwurm's Edda",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/eldwurms_edda.png"
  },
  "1851": {
    "id": 1851,
    "name": "item_recipe_essence_distiller",
    "displayName": "Essence Distiller Recipe",
    "cost": 200,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1852": {
    "id": 1852,
    "name": "item_essence_distiller",
    "displayName": "Essence Distiller",
    "cost": 1775,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/essence_distiller.png"
  },
  "1853": {
    "id": 1853,
    "name": "item_recipe_consecrated_wraps",
    "displayName": "Consecrated Wraps Recipe",
    "cost": 700,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1854": {
    "id": 1854,
    "name": "item_consecrated_wraps",
    "displayName": "Consecrated Wraps",
    "cost": 2600,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/consecrated_wraps.png"
  },
  "1855": {
    "id": 1855,
    "name": "item_recipe_crellas_crozier",
    "displayName": "Crella's Crozier Recipe",
    "cost": 300,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1856": {
    "id": 1856,
    "name": "item_crellas_crozier",
    "displayName": "Crella's Crozier",
    "cost": 4800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/crellas_crozier.png"
  },
  "1857": {
    "id": 1857,
    "name": "item_recipe_hydras_breath",
    "displayName": "Recipe Hydras Breath",
    "cost": 1100,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "1858": {
    "id": 1858,
    "name": "item_hydras_breath",
    "displayName": "Hydra's Breath",
    "cost": 5900,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/hydras_breath.png"
  },
  "1859": {
    "id": 1859,
    "name": "item_spellslinger",
    "displayName": "Spellslinger",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/spellslinger.png"
  },
  "1860": {
    "id": 1860,
    "name": "item_prophets_pendulum",
    "displayName": "Prophet's Pendulum",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/prophets_pendulum.png"
  },
  "1861": {
    "id": 1861,
    "name": "item_stonefeather_satchel",
    "displayName": "Stonefeather Satchel",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/stonefeather_satchel.png"
  },
  "1862": {
    "id": 1862,
    "name": "item_enchanters_bauble",
    "displayName": "Enchanter's Bauble",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enchanters_bauble.png"
  },
  "1863": {
    "id": 1863,
    "name": "item_harmonizer",
    "displayName": "Harmonizer",
    "cost": 0,
    "isNeutral": true,
    "tier": 5,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/harmonizer.png"
  },
  "1864": {
    "id": 1864,
    "name": "item_conjurers_catalyst",
    "displayName": "Conjurer's Catalyst",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/conjurers_catalyst.png"
  },
  "1865": {
    "id": 1865,
    "name": "item_enhancement_vital",
    "displayName": "Vital",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_vital.png"
  },
  "1866": {
    "id": 1866,
    "name": "item_enhancement_hulking",
    "displayName": "Hulking",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_hulking.png"
  },
  "1867": {
    "id": 1867,
    "name": "item_enhancement_manic",
    "displayName": "Manic",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_manic.png"
  },
  "1868": {
    "id": 1868,
    "name": "item_foragers_kit",
    "displayName": "Forager's Kit",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/foragers_kit.png"
  },
  "1869": {
    "id": 1869,
    "name": "item_foragers_health",
    "displayName": "Vital Toadstool",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/foragers_health.png"
  },
  "1870": {
    "id": 1870,
    "name": "item_foragers_stats",
    "displayName": "Ironwood Nut",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/foragers_stats.png"
  },
  "1871": {
    "id": 1871,
    "name": "item_foragers_mana",
    "displayName": "Tomo'kan Ringcap",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/foragers_mana.png"
  },
  "1872": {
    "id": 1872,
    "name": "item_chasm_stone",
    "displayName": "Chasm Stone",
    "cost": 800,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/chasm_stone.png"
  },
  "1873": {
    "id": 1873,
    "name": "item_partisans_brand",
    "displayName": "Partisan's Brand",
    "cost": 0,
    "isNeutral": true,
    "tier": 3,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/partisans_brand.png"
  },
  "1874": {
    "id": 1874,
    "name": "item_enhancement_nimble",
    "displayName": "Nimble",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/enhancement_nimble.png"
  },
  "1875": {
    "id": 1875,
    "name": "item_tidehunter_fish",
    "displayName": "Leviathan's Fish",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tidehunter_fish.png"
  },
  "2091": {
    "id": 2091,
    "name": "item_tier1_token",
    "displayName": "Tier 1 Token",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tier1_token.png"
  },
  "2092": {
    "id": 2092,
    "name": "item_tier2_token",
    "displayName": "Tier 2 Token",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tier2_token.png"
  },
  "2093": {
    "id": 2093,
    "name": "item_tier3_token",
    "displayName": "Tier 3 Token",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tier3_token.png"
  },
  "2094": {
    "id": 2094,
    "name": "item_tier4_token",
    "displayName": "Tier 4 Token",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tier4_token.png"
  },
  "2095": {
    "id": 2095,
    "name": "item_tier5_token",
    "displayName": "Tier 5 Token",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tier5_token.png"
  },
  "2096": {
    "id": 2096,
    "name": "item_vindicators_axe",
    "displayName": "Vindicator's Axe",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/vindicators_axe.png"
  },
  "2097": {
    "id": 2097,
    "name": "item_duelist_gloves",
    "displayName": "Duelist Gloves",
    "cost": 0,
    "isNeutral": true,
    "tier": 1,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/duelist_gloves.png"
  },
  "2098": {
    "id": 2098,
    "name": "item_horizons_equilibrium",
    "displayName": "Horizons Equilibrium",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/horizons_equilibrium.png"
  },
  "2099": {
    "id": 2099,
    "name": "item_blighted_spirit",
    "displayName": "Blighted Spirit",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blighted_spirit.png"
  },
  "2190": {
    "id": 2190,
    "name": "item_dandelion_amulet",
    "displayName": "Dandelion Amulet",
    "cost": 0,
    "isNeutral": true,
    "tier": 4,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/dandelion_amulet.png"
  },
  "2191": {
    "id": 2191,
    "name": "item_turtle_shell",
    "displayName": "Turtle Shell",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/turtle_shell.png"
  },
  "2192": {
    "id": 2192,
    "name": "item_martyrs_plate",
    "displayName": "Martyr's Plate",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/martyrs_plate.png"
  },
  "2193": {
    "id": 2193,
    "name": "item_gossamer_cape",
    "displayName": "Gossamer Cape",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/gossamer_cape.png"
  },
  "4204": {
    "id": 4204,
    "name": "item_famango",
    "displayName": "Healing Lotus",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/famango.png"
  },
  "4205": {
    "id": 4205,
    "name": "item_great_famango",
    "displayName": "Great Healing Lotus",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/great_famango.png"
  },
  "4206": {
    "id": 4206,
    "name": "item_greater_famango",
    "displayName": "Greater Healing Lotus",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/greater_famango.png"
  },
  "4207": {
    "id": 4207,
    "name": "item_recipe_great_famango",
    "displayName": "Recipe Great Famango",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "4208": {
    "id": 4208,
    "name": "item_recipe_greater_famango",
    "displayName": "Recipe Greater Famango",
    "cost": 0,
    "isNeutral": false,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/recipe.png"
  },
  "4300": {
    "id": 4300,
    "name": "item_ofrenda",
    "displayName": "Beloved Memory",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ofrenda.png"
  },
  "4301": {
    "id": 4301,
    "name": "item_ofrenda_shovel",
    "displayName": "Scrying Shovel",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ofrenda_shovel.png"
  },
  "4302": {
    "id": 4302,
    "name": "item_ofrenda_pledge",
    "displayName": "Forebearer's Fortune",
    "cost": 0,
    "isNeutral": true,
    "imageUrl": "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ofrenda_pledge.png"
  }
};

/**
 * Returns item metadata with dynamic fallback if not found
 */
export function getItem(itemId: number): ItemMetadata {
  if (!itemId || itemId === 0) {
    return {
      id: 0,
      name: "empty",
      displayName: "Empty Slot",
      cost: 0,
      isNeutral: false,
      imageUrl: "",
    };
  }

  const existing = ITEMS_MAP[itemId];
  if (existing) {
    if (existing.name.startsWith('item_recipe_') || existing.name.includes('recipe')) {
      return {
        ...existing,
        imageUrl: `${VALVE_ITEM_IMG_BASE}/recipe.png`,
      };
    }
    return existing;
  }

  const fallbackShort = `item_${itemId}`;
  return {
    id: itemId,
    name: fallbackShort,
    displayName: `Item #${itemId}`,
    cost: 0,
    isNeutral: false,
    imageUrl: `${VALVE_ITEM_IMG_BASE}/recipe.png`,
  };
}

export function isNeutralItem(itemId: number): boolean {
  const item = getItem(itemId);
  return item.isNeutral;
}
