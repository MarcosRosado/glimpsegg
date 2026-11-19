/**
 * Perfil público da Steam (`steamcommunity.com/profiles/{steamId64}?xml=1`): nome e foto da
 * conta, sem chave. É o que a confirmação do onboarding mostra antes de salvar.
 *
 * Por que a Steam e não só a OpenDota: nome e foto SÃO da Steam (a OpenDota só copia), e a
 * OpenDota sem chave tem cota diária por IP — quando ela esgota, a confirmação ficava só com o
 * número. A consulta roda no main porque a Steam não manda CORS para o renderer.
 *
 * Puro e sem rede: o handler em `main.cjs` faz o fetch e passa o texto para cá.
 */

const STEAM_ID64 = /^7656119\d{10}$/;

/** URL do XML público, ou `null` se o id não for um SteamID64. O main não busca nada sem isso. */
function steamProfileXmlUrl(steamId64) {
  const id = String(steamId64 ?? '').trim();
  return STEAM_ID64.test(id) ? `https://steamcommunity.com/profiles/${id}?xml=1` : null;
}

/** Conteúdo de uma tag do XML, com ou sem CDATA. */
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${name}>`));
  if (!m) return null;
  const value = (m[1] ?? m[2] ?? '').trim();
  return value || null;
}

/** Foto só de host da Valve, por https: o XML é dado externo, e a URL vira `src` de imagem. */
function safeAvatar(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'steamstatic.com' || u.hostname.endsWith('.steamstatic.com')) ? url : null;
  } catch {
    return null;
  }
}

/**
 * `{ found: true, personaname, avatar }` com o perfil, `{ found: false }` quando a Steam diz que
 * o perfil não existe (`<response><error>`), `null` quando o texto não é nenhum dos dois
 * (página de erro, limite, mudança de formato) — quem chama trata como indisponível.
 */
function parseSteamProfileXml(xml) {
  if (typeof xml !== 'string' || !xml) return null;
  if (/<response>[\s\S]*<error>/.test(xml)) return { found: false };
  if (!/<profile>/.test(xml)) return null;
  const personaname = tag(xml, 'steamID');
  if (!personaname) return null;
  return { found: true, personaname, avatar: safeAvatar(tag(xml, 'avatarFull')) };
}

module.exports = { steamProfileXmlUrl, parseSteamProfileXml };
