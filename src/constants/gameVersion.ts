/**
 * Patch do Dota 2 que serve de referência para as análises.
 *
 * Antes era um literal solto no JSX do Navbar, onde ninguém o encontrava para
 * atualizar. O ideal é puxar de `constants { gameVersions }` da STRATZ; até lá,
 * este é o único ponto a editar quando o patch virar.
 */
export const CURRENT_GAME_PATCH = '7.38c';
