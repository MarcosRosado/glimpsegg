import React, { useMemo, useState } from 'react';
import { Clock, Eye, EyeOff, Info, Skull, Sparkles } from 'lucide-react';
import { MatchDetails, MatchPlayer, MapTeam, WardPlacement, WardType } from '../../types/dota';
import { stratzCellToPercent } from '../../utils/minimapCoords';
import {
  MAP_CELL_MAX,
  MAP_CELL_MIN,
  MAP_CELL_SPAN,
  MAP_IMAGE_INSET,
  MAP_LANDMARKS,
  OBSERVER_DURATION_SEC,
  WARD_VISION_CELLS,
} from '../../constants/mapGeometry';
import { formatMatchClock } from '../../utils/dotaFormatters';
import { observerUptimePct } from '../../services/visionMapper';
import { getHero } from '../../constants/heroes';
import { handleHeroImageError } from '../../utils/imageFallback';
import { useLanguage } from '../../context/LanguageContext';

interface WardMinimapTabProps {
  player: MatchPlayer;
  match: MatchDetails;
}

type TeamFilter = 'MINE' | 'ENEMY' | 'BOTH';
type TypeFilter = 'ALL' | WardType;

function teamsForFilter(filter: TeamFilter, isRadiant: boolean): MapTeam[] {
  const mine: MapTeam = isRadiant ? 'RADIANT' : 'DIRE';
  const enemy: MapTeam = isRadiant ? 'DIRE' : 'RADIANT';
  if (filter === 'MINE') return [mine];
  if (filter === 'ENEMY') return [enemy];
  return [mine, enemy];
}

/** Cobertura do mapa: rasteriza a uniao dos raios num grid booleano 128x128. */
function computeMapCoveragePct(wards: WardPlacement[]): number {
  if (wards.length === 0) return 0;
  const grid = new Uint8Array(MAP_CELL_SPAN * MAP_CELL_SPAN);
  for (const w of wards) {
    const r = WARD_VISION_CELLS[w.type];
    const cx = w.x - MAP_CELL_MIN;
    const cy = MAP_CELL_MAX - w.y;
    const r2 = r * r;
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(MAP_CELL_SPAN - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(MAP_CELL_SPAN - 1, Math.ceil(cy + r));
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) grid[y * MAP_CELL_SPAN + x] = 1;
      }
    }
  }
  let covered = 0;
  for (let i = 0; i < grid.length; i += 1) covered += grid[i];
  return Math.round((covered / grid.length) * 100);
}

const Kpi: React.FC<{ label: string; value: string; hint?: string; tone?: string }> = ({
  label,
  value,
  hint,
  tone = 'text-slate-200',
}) => (
  <div className="glass-card rounded-xl p-3 border border-slate-800 bg-[#111724] text-center">
    <div className="text-[10px] text-slate-400 font-bold mb-0.5">{label}</div>
    <div className={`text-xl font-black font-mono ${tone}`}>{value}</div>
    {hint && <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">{hint}</div>}
  </div>
);

export const WardMinimapTab: React.FC<WardMinimapTabProps> = ({ player, match }) => {
  const { t } = useLanguage();
  const vision = match.vision;
  const duration = match.durationSeconds;

  // Domínio do scrubber em SEGUNDOS, começando antes de zero quando há ward pré-horn.
  const minTime = useMemo(() => {
    const earliest = vision.wards.reduce(
      (min, w) => (w.spawnTime < min ? w.spawnTime : min),
      0,
    );
    return Math.min(0, earliest);
  }, [vision.wards]);

  const [time, setTime] = useState<number>(duration);
  const [showRadius, setShowRadius] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeaths, setShowDeaths] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('MINE');
  const [slotFilter, setSlotFilter] = useState<number | null>(null);
  const [mapImageOk, setMapImageOk] = useState(true);
  // Spots de runa. Nasceu como ferramenta de calibracao interna e virou funcionalidade:
  // saber onde estao as runas ajuda a ler o posicionamento das wards. Desligado por
  // padrao porque é informacao extra, nao essencial para a leitura do mapa.
  const [showRunes, setShowRunes] = useState(false);

  const isRadiant = player.isRadiant;
  const myTeam: MapTeam = isRadiant ? 'RADIANT' : 'DIRE';

  // Wards que passam pelos filtros de time/tipo/jogador (independente do tempo).
  const scoped = useMemo(() => {
    const teams = teamsForFilter(teamFilter, isRadiant);
    return vision.wards.filter((w) => {
      if (!teams.includes(w.team)) return false;
      if (typeFilter !== 'ALL' && w.type !== typeFilter) return false;
      if (slotFilter !== null && w.placedBySlot !== slotFilter) return false;
      return true;
    });
  }, [vision.wards, teamFilter, typeFilter, slotFilter, isRadiant]);

  /**
   * VIVAS no instante do scrubber. A versão anterior só acumulava wards colocadas
   * até o minuto — nada expirava, então o mapa terminava coberto de pinos que já
   * não existiam no jogo.
   */
  const alive = useMemo(
    () => scoped.filter((w) => w.spawnTime <= time && w.expireTime >= time),
    [scoped, time],
  );
  const expired = useMemo(
    () => (showHistory ? scoped.filter((w) => w.expireTime < time) : []),
    [scoped, time, showHistory],
  );

  const myWards = vision.wards.filter((w) => w.team === myTeam);
  const myObs = myWards.filter((w) => w.type === 'OBSERVER');
  const myDewards = vision.dewards.filter((d) => d.team === myTeam);
  const uptime = observerUptimePct(vision, myTeam, duration);
  const coverage = computeMapCoveragePct(alive);
  const avgLifetime = myObs.length
    ? Math.round(myObs.reduce((s, w) => s + w.lifetimeSeconds, 0) / myObs.length)
    : 0;
  const lostEarly = myWards.filter(
    (w) => w.wasDestroyed && w.lifetimeSeconds < OBSERVER_DURATION_SEC * 0.5,
  ).length;

  const teammates = useMemo(
    () => match.players.filter((p) => p.isRadiant === player.isRadiant),
    [match.players, player.isRadiant],
  );
  const wardCountBySlot = useMemo(() => {
    const map = new Map<number, number>();
    for (const w of vision.wards) {
      if (w.placedBySlot === null) continue;
      map.set(w.placedBySlot, (map.get(w.placedBySlot) ?? 0) + 1);
    }
    return map;
  }, [vision.wards]);

  const myDeaths = vision.deaths.filter((d) => d.team === myTeam);
  const deathsInEnemyVision = myDeaths.filter((d) => d.isWardWalkThrough).length;
  const isEstimated = vision.source === 'PLAYER_STATS';

  // --- Estado vazio: nada de ward inventada ---
  if (vision.source === 'NONE') {
    return (
      <div className="glass-card rounded-2xl p-8 border border-slate-800 bg-[#111724] text-center">
        <EyeOff className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-200 mb-2">{t('visionNoDataTitle')}</h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          {vision.isReplayParsed ? t('visionNoDataParsedEmpty') : t('visionNoDataUnparsed')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Mapa */}
      <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-slate-800 bg-[#111724]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              {t('visionTitle')}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showRadius}
                onChange={(e) => setShowRadius(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
              />
              <span>{t('visionRangeToggle')}</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showHistory}
                onChange={(e) => setShowHistory(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
              />
              <span>{t('visionShowHistory')}</span>
            </label>
            {vision.deaths.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeaths}
                  onChange={(e) => setShowDeaths(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0"
                />
                <span>{t('visionShowDeaths')}</span>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showRunes}
                onChange={(e) => setShowRunes(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-fuchsia-500 focus:ring-0"
              />
              <span>{t('visionShowRunes')}</span>
            </label>
          </div>
        </div>

        {/* Filtros de time e tipo */}
        <div className="flex items-center gap-2 flex-wrap mb-3 text-xs">
          <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
            {(['MINE', 'ENEMY', 'BOTH'] as TeamFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTeamFilter(f)}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  teamFilter === f ? 'bg-slate-200 text-slate-900 shadow-sm' : 'text-slate-400'
                }`}
              >
                {f === 'MINE' ? t('visionTeamMine') : f === 'ENEMY' ? t('visionTeamEnemy') : t('visionTeamBoth')}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
            {(['ALL', 'OBSERVER', 'SENTRY'] as TypeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  typeFilter === f
                    ? f === 'SENTRY'
                      ? 'bg-cyan-500 text-slate-950'
                      : f === 'OBSERVER'
                        ? 'bg-yellow-400 text-slate-950'
                        : 'bg-amber-500 text-slate-950'
                    : 'text-slate-400'
                }`}
              >
                {f === 'ALL'
                  ? t('visionFilterAll')
                  : f === 'OBSERVER'
                    ? t('wardTypeObserver')
                    : t('wardTypeSentry')}
              </button>
            ))}
          </div>
        </div>

        {/* Chips por jogador — atribuição real, que antes não existia */}
        {teamFilter === 'MINE' && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <button
              onClick={() => setSlotFilter(null)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
                slotFilter === null
                  ? 'bg-slate-200 text-slate-900 border-slate-300'
                  : 'bg-slate-900/70 text-slate-400 border-slate-800'
              }`}
            >
              {t('visionAllPlayers')}
            </button>
            {teammates.map((p) => {
              const count = wardCountBySlot.get(p.playerSlot) ?? 0;
              const hero = getHero(p.heroId);
              const active = slotFilter === p.playerSlot;
              return (
                <button
                  key={p.playerSlot}
                  onClick={() => setSlotFilter(active ? null : p.playerSlot)}
                  title={hero.displayName}
                  className={`flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-lg border transition ${
                    active
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  } ${count === 0 ? 'opacity-45' : ''}`}
                >
                  <img
                    src={hero.iconUrl}
                    alt={hero.displayName}
                    onError={handleHeroImageError}
                    className="w-5 h-5 rounded object-cover"
                  />
                  <span className="text-[11px] font-mono font-bold text-slate-200">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Container do mapa */}
        <div className="relative w-full aspect-square max-w-[520px] mx-auto rounded-xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-[#090d14]">
          {mapImageOk ? (
            <img
              src="./minimap.png"
              alt=""
              aria-hidden="true"
              onError={() => setMapImageOk(false)}
              className="absolute inset-0 w-full h-full object-cover opacity-90 select-none pointer-events-none"
            />
          ) : (
            // Fallback procedural: melhor uma grade honesta que um retângulo vazio.
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundColor: '#0c131d',
                backgroundImage:
                  'linear-gradient(rgba(148,163,184,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.14) 1px, transparent 1px)',
                backgroundSize: '12.5% 12.5%',
              }}
            />
          )}

          {/* Camada SVG: raios, dewards e mortes — desenhados no MESMO espaço 0..128
              das coordenadas, então escalam com o container sem matemática no JSX. */}
          {/* Esta caixa é a AREA JOGAVEL dentro da arte. Com ela posicionada pelo
              inset, o viewBox 0..128 do SVG coincide celula a celula com os pinos
              HTML (que passam por stratzCellToPercent). Sem isso, raio e pino
              divergem — e o desalinhamento cresce em direcao as bordas. */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${MAP_IMAGE_INSET.left}%`,
              right: `${MAP_IMAGE_INSET.right}%`,
              top: `${MAP_IMAGE_INSET.top}%`,
              bottom: `${MAP_IMAGE_INSET.bottom}%`,
            }}
          >
          <svg
            viewBox={`0 0 ${MAP_CELL_SPAN} ${MAP_CELL_SPAN}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Um único grupo com opacidade de GRUPO: sobreposições não compõem, então
                a união de visão fica uniforme em vez de manchada onde há wards juntas. */}
            {showRadius && (
              <g opacity="0.18">
                {alive.map((w) => (
                  <circle
                    key={`r-${w.key}`}
                    cx={w.x - MAP_CELL_MIN}
                    cy={MAP_CELL_MAX - w.y}
                    r={WARD_VISION_CELLS[w.type]}
                    fill={w.type === 'OBSERVER' ? '#facc15' : '#22d3ee'}
                  />
                ))}
              </g>
            )}

            {showDeaths && (
              <g opacity="0.5">
                {vision.deaths
                  .filter((d) => d.time <= time && teamsForFilter(teamFilter, isRadiant).includes(d.team))
                  .map((d, i) => (
                    <circle
                      key={`d-${i}`}
                      cx={d.x - MAP_CELL_MIN}
                      cy={MAP_CELL_MAX - d.y}
                      r={2.2}
                      fill={d.isWardWalkThrough ? '#f472b6' : '#f43f5e'}
                    />
                  ))}
              </g>
            )}

            {showRunes && (
              // Estes quatro spots sao TAMBEM a referencia de calibracao do
              // enquadramento do PNG: as de poder tem de cair na agua do rio e as de
              // bounty nos spots da jungle. Se sairem do lugar, ajuste MAP_IMAGE_INSET
              // (ver o procedimento em constants/mapGeometry.ts).
              <g opacity="0.9">
                {Object.entries(MAP_LANDMARKS).map(([name, l]) => {
                  const isPower = name.startsWith('power');
                  const color = isPower ? '#e879f9' : '#a3e635';
                  return (
                    // pointerEvents reativado: a camada SVG é `pointer-events-none`,
                    // e sem isto o <title> nunca aparece no hover. Os pinos de ward
                    // vem depois no DOM e com z maior, entao seguem ganhando o hover
                    // onde houver sobreposicao.
                    <g key={`rune-${name}`} style={{ pointerEvents: 'auto' }}>
                      <title>{isPower ? t('runeSpotPower') : t('runeSpotBounty')}</title>
                      <circle
                        cx={l.x - MAP_CELL_MIN}
                        cy={MAP_CELL_MAX - l.y}
                        r={2.2}
                        fill="none"
                        stroke={color}
                        strokeWidth={0.7}
                      />
                      <circle
                        cx={l.x - MAP_CELL_MIN}
                        cy={MAP_CELL_MAX - l.y}
                        r={0.5}
                        fill={color}
                      />
                    </g>
                  );
                })}
                {/* Sem contorno da caixa de coordenadas de proposito: ela marca os
                    LIMITES DO MUNDO (celulas 64 e 192), que ficam fora do terreno
                    desenhado. Desenhar isso sugeria que devia coincidir com a borda da
                    arte, e essa leitura errada custou uma calibracao inteira. As
                    ancoras de runa sao a referencia; a moldura, nao. */}
              </g>
            )}
          </svg>
          </div>

          {/* Pinos: HTML posicionado, para hover e foco de teclado saírem de graça */}
          {[...expired, ...alive].map((w) => {
            const pos = stratzCellToPercent(w.x, w.y);
            if (!pos) return null;
            const isObserver = w.type === 'OBSERVER';
            const isAlive = w.spawnTime <= time && w.expireTime >= time;
            const owner = w.placedByHeroId ? getHero(w.placedByHeroId) : null;
            const killer = w.destroyedByHeroId ? getHero(w.destroyedByHeroId) : null;

            return (
              <div
                key={w.key}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group ${
                  isAlive ? 'z-20' : 'z-10 opacity-35'
                }`}
                style={{ left: `${pos.leftPercent}%`, top: `${pos.topPercent}%` }}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 shadow-lg ${
                    isObserver
                      ? 'bg-yellow-400 border-yellow-200'
                      : 'bg-cyan-400 border-cyan-200'
                  } ${w.expiryInferred ? 'border-dashed' : ''} ${
                    w.team !== myTeam ? 'ring-1 ring-rose-400/70' : ''
                  }`}
                />

                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 bg-[#0f172a] border border-slate-700 text-[10px] font-mono py-1.5 px-2 rounded-md shadow-2xl whitespace-nowrap text-slate-200">
                  <div className="font-bold text-amber-400">
                    {isObserver ? t('wardTypeObserver') : t('wardTypeSentry')}
                    {w.team !== myTeam && ' · ' + t('visionTeamEnemy')}
                  </div>
                  <div>{t('wardPlacedAt', { time: formatMatchClock(w.spawnTime) })}</div>
                  {w.spawnTime < 0 && <div className="text-slate-400">{t('wardPreHorn')}</div>}
                  {owner && <div>{t('wardPlacedBy', { hero: owner.displayName })}</div>}
                  {w.wasDestroyed ? (
                    <div className="text-rose-300">
                      {killer
                        ? t('wardDestroyedBy', { hero: killer.displayName })
                        : t('wardDestroyedAt', { time: formatMatchClock(w.expireTime) })}
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      {t('wardExpiredAt', { time: formatMatchClock(w.expireTime) })}
                    </div>
                  )}
                  <div className="text-slate-400">
                    {t('wardLifetime', { seconds: w.lifetimeSeconds })}
                    {w.expiryInferred && ` (${t('wardEstimatedBadge')})`}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-2 left-2 text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 pointer-events-none">
            {t('radiant').toUpperCase()}
          </div>
          <div className="absolute top-2 right-2 text-[10px] font-black text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40 pointer-events-none">
            {t('dire').toUpperCase()}
          </div>
        </div>

        {/* Scrubber em segundos, com domínio que inclui as wards pré-horn */}
        <div className="mt-5 space-y-2 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {t('visionScrubber')}: {formatMatchClock(time)}
              </span>
            </span>
            <span className="text-[11px] text-slate-400">
              {alive.length} {t('activeVision')}
              {coverage > 0 && ` · ${coverage}% ${t('visionKpiMapCoverage').toLowerCase()}`}
            </span>
          </div>
          <input
            type="range"
            min={minTime}
            max={duration}
            step={5}
            value={time}
            onChange={(e) => setTime(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Legenda so quando as runas estao visiveis: magenta vs verde nao é
            autoexplicativo, e o tooltip nativo só ajuda quem passa o mouse. */}
        {showRunes && (
          <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border-2 border-fuchsia-400" />
              {t('runeSpotPower')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border-2 border-lime-400" />
              {t('runeSpotBounty')}
            </span>
          </div>
        )}

        {!mapImageOk && (
          <p className="mt-2 text-[10px] text-slate-500">{t('visionMapImageMissing')}</p>
        )}
      </div>

      {/* KPIs e logs */}
      <div className="space-y-4">
        {isEstimated && (
          <div className="glass-card rounded-xl p-3 border border-amber-500/25 bg-amber-950/20 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-200/90 leading-relaxed">
              {t('visionSourceEstimated')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Kpi
            label={t('visionKpiObservers')}
            value={String(myObs.length)}
            hint={t('visionPlacedAcrossGame')}
            tone="text-yellow-400"
          />
          <Kpi
            label={t('visionKpiSentries')}
            value={String(myWards.length - myObs.length)}
            hint={t('visionPlacedAcrossGame')}
            tone="text-cyan-400"
          />
          <Kpi
            label={t('visionKpiUptime')}
            value={uptime === null ? '—' : `${uptime}%`}
            hint={t('visionKpiUptimeHint')}
            tone={uptime !== null && uptime < 50 ? 'text-rose-400' : 'text-emerald-400'}
          />
          <Kpi
            label={t('visionKpiDewards')}
            value={String(myDewards.length)}
            tone="text-fuchsia-400"
          />
          <Kpi
            label={t('visionKpiAvgLifetime')}
            value={avgLifetime > 0 ? `${avgLifetime}s` : '—'}
            hint={isEstimated ? t('wardLifetimeEstimated') : undefined}
          />
          <Kpi
            label={t('visionKpiWardsLostEarly')}
            value={String(lostEarly)}
            tone={lostEarly > 2 ? 'text-amber-400' : 'text-slate-200'}
          />
        </div>

        {deathsInEnemyVision > 0 && (
          <div className="glass-card rounded-xl p-3 border border-rose-500/25 bg-rose-950/20 flex items-center gap-2">
            <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <p className="text-[11px] text-rose-200">
              {t('visionDeathsInEnemyVision', {
                count: deathsInEnemyVision,
                total: myDeaths.length,
              })}
            </p>
          </div>
        )}

        {vision.unattributedWards > 0 && (
          <p className="text-[10px] text-slate-500 px-1">
            {t('visionUnattributedWards', { count: vision.unattributedWards })}
          </p>
        )}

        {/* Linha do tempo */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 bg-[#111724]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('visionTimelineEvents')}</span>
          </h4>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 text-xs font-mono">
            {scoped
              .slice()
              .sort((a, b) => a.spawnTime - b.spawnTime)
              .map((w) => {
                const seen = w.spawnTime <= time;
                const owner = w.placedByHeroId ? getHero(w.placedByHeroId) : null;
                return (
                  <button
                    key={`log-${w.key}`}
                    onClick={() => setTime(w.spawnTime)}
                    className={`w-full flex items-center justify-between p-1.5 rounded-lg border transition text-left ${
                      seen
                        ? 'bg-slate-900/80 border-slate-700/80 text-slate-200'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          w.type === 'OBSERVER' ? 'bg-yellow-400' : 'bg-cyan-400'
                        }`}
                      />
                      {owner && (
                        <img
                          src={owner.iconUrl}
                          alt=""
                          onError={handleHeroImageError}
                          className="w-4 h-4 rounded object-cover shrink-0"
                        />
                      )}
                      <span className="font-bold truncate">
                        {w.type === 'OBSERVER' ? t('wardTypeObserver') : t('wardTypeSentry')}
                      </span>
                      {w.wasDestroyed && <span className="text-rose-400 text-[10px]">×</span>}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {formatMatchClock(w.spawnTime)}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
