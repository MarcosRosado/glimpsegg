import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Info,
  LayoutGrid,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';

import { getHero } from '../../constants/heroes';
import { Tooltip } from '../ui/Tooltip';
import { useLanguage } from '../../context/LanguageContext';
import { UseHeroGridSyncResult } from '../../hooks/useHeroGridSync';
import type { TranslationKey } from '../../i18n/translations';
import type {
  HeroGridGroupView,
  HeroScore,
  MirrorSnapshot,
  RankingCriterion,
} from '../../types/heroGrid';
import { buildHeroTooltipRows } from '../../utils/heroGrid/heroTooltip';
import { PERSONAL_WEIGHT_K } from '../../utils/heroGrid/ranking';
import { handleHeroImageError } from '../../utils/imageFallback';
import {
  buildMirrorCanvas,
  buildScoreQualityScale,
  formatGlimpseScore,
  mirrorHeroDisplay,
  resolveMirrorLayout,
  scaleCanvas,
  scoreQuality,
  type MirrorCanvasBox,
  type MirrorHeroDisplay,
  type ScoreQuality,
  type ScoreQualityScale,
} from '../../utils/heroGrid/mirrorLayout';
import {
  describeDaysSince,
  formatRatioPercent,
  isMirrorStale,
  isScoreDisplayable,
} from '../../utils/heroGrid/tabFormat';
import { CRITERION_LABEL, DAYS_SINCE_LABEL, metaSourceKey } from './labels';
import { Chip, LayoutRef, Notice } from './primitives';

/**
 * Tela de replica do layout espelho.
 *
 * ## O que ela é, e o que ela nao é
 *
 * Ela mostra **o que esta gravado no arquivo do jogador**, datado — nao o que a proxima
 * sincronizacao produziria. Por isso a fonte é `sync.mirrorSnapshot`, persistido em config
 * apenas quando os bytes chegaram ao disco, e nunca `sync.groups`, que é o resultado em
 * memoria da sincronizacao desta sessao e existe mesmo quando a escrita foi RECUSADA.
 *
 * A distincao parece sutil e nao é: desenhar o espelho recusado com a moldura de "este é o
 * seu layout" seria a forma mais convincente de inventar dado que a feature tem ao alcance,
 * porque o jogador abriria o Dota esperando a ordem que viu aqui. Quando os dois divergem,
 * a tela mostra o snapshot e diz que a tentativa mais recente nao foi gravada.
 *
 * O painel (`HeroGridTab`) continua sendo o lugar de diagnostico e acao — sincronizar,
 * restaurar backup, ler o historico. Esta tela nao escreve nada.
 *
 * ## Por que a geometria importa
 *
 * O jogador posiciona os grupos no Dota, e essa disposicao é informacao dele. Reproduzi-la
 * é o que faz a tela ser uma replica e nao mais uma lista ordenada — o painel ja tem a
 * lista. As quatro coordenadas viajam no snapshot desde `HeroGridGroupView`, e
 * `buildMirrorCanvas` decide se sao utilizaveis: se nao forem, os grupos empilham em fluxo
 * e a tela DIZ isso, em vez de chutar posicao.
 *
 * ## Qual numero aparece
 *
 * `mirrorHeroDisplay` decide a partir do criterio que estava ativo NA GRAVACAO (o do
 * snapshot, nao o das preferencias de agora — mudar a config nao muda retroativamente o
 * arquivo). Meta em `COMBINED`/`META_ONLY`, pessoal em `PERSONAL_ONLY`, e nunca um caindo
 * no outro para preencher lacuna. Todo numero sai com fonte e amostra ao lado (FR-014).
 *
 * Como todo `.tsx` deste projeto, ela nao tem teste: o vitest roda em `environment: 'node'`.
 * Toda decisao testavel mora em `utils/heroGrid/mirrorLayout.ts` e `tabFormat.ts`.
 */

export interface HeroGridMirrorScreenProps {
  sync: UseHeroGridSyncResult;
  onOpenSettings: () => void;
  /** Leva ao painel, que é onde se sincroniza e se restaura backup. */
  onOpenPanel: () => void;
}

/**
 * Largura minima de um tile de heroi, em pixels.
 *
 * O tile carrega icone, nome, porcentagem e NOTA em duas linhas, entao ele é bem maior que
 * o icone que o Dota desenha na mesma caixa. Este numero e o `MIRROR_UNIT_SCALE` de
 * `mirrorLayout.ts` foram calibrados JUNTOS contra a `hero-grid-real.json`: 156px de tile
 * com 1.75 de escala de unidade fazem os 8 grupos daquele grid caberem inteiros, sem rolagem
 * interna, com folga de 36px no grupo mais apertado.
 *
 * 156 e nao menos: descontando borda, `px-1.5`, o icone de 24px e o `gap-1.5`, sobram 112px
 * para a coluna de texto, e a linha de baixo precisa comportar o GlimpseScore em `text-sm`
 * ao lado do winrate em `text-xs` no PIOR caso — `100.0` com `100.0%`, que dá ~105px em fonte
 * monoespacada. `100.0%` nao é hipotese: em `PERSONAL_ONLY`, tres vitorias em tres partidas
 * produzem exatamente isso.
 *
 * Nao subir a escala de unidade para ganhar espaco: canvas maior encolhe mais na janela, e o
 * tamanho EFETIVO da fonte CAI. Em 1.75 o GlimpseScore sai a 13,5px numa janela de 1750px
 * uteis; em 1.85, a 12,7px.
 *
 * Mexer num sem refazer a conta do outro traz de volta o defeito que os dois corrigiram —
 * com 132px em escala 1.0, os 8 grupos transbordavam e metade colapsava para uma coluna.
 * A caixa continua com `overflow-y-auto` porque o grid de OUTRO jogador pode ser mais
 * apertado que a fixture, e rolar é a degradacao honesta; nao é o caminho esperado.
 */
const HERO_TILE_MIN_WIDTH = 156;

/**
 * Cor da NOTA por faixa de qualidade.
 *
 * Verde/amarelo/vermelho dizem em que terco DESTE layout o heroi caiu — nao "heroi bom" em
 * absoluto. A escala é relativa de proposito (ver `buildScoreQualityScale`), e por isso a
 * tela é obrigada a exibir os limiares e a explicar a leitura: cor relativa apresentada como
 * absoluta seria numero sem procedencia.
 */
/** Cada criterio tem a SUA formula: em META_ONLY e PERSONAL_ONLY o peso nao existe. */
const SCORE_FORMULA_LABEL: Record<RankingCriterion, TranslationKey> = {
  COMBINED: 'heroGridMirrorScoreFormulaCombined',
  META_ONLY: 'heroGridMirrorScoreFormulaMeta',
  PERSONAL_ONLY: 'heroGridMirrorScoreFormulaPersonal',
};

const SCORE_QUALITY_COLOR: Record<ScoreQuality, string> = {
  GOOD: 'text-emerald-400',
  FAIR: 'text-amber-400',
  POOR: 'text-rose-400',
};

/** Uma caixa de grupo, posicionada pela geometria do arquivo. */
const GroupBox: React.FC<{
  group: HeroGridGroupView;
  box: MirrorCanvasBox | null;
  scoreOf: (heroId: number) => HeroScore | null;
  snapshot: MirrorSnapshot;
  bracketLabelKey: TranslationKey;
  qualityScale: ScoreQualityScale | null;
}> = ({ group, box, scoreOf, snapshot, bracketLabelKey, qualityScale }) => {
  const { t } = useLanguage();

  // `box` ausente => `usesGeometry: false`, e o grupo entra no fluxo normal da pagina.
  const positioned: React.CSSProperties | undefined = box
    ? {
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }
    : undefined;

  return (
    <div
      style={positioned}
      className="glass-card rounded-xl border border-slate-800/80 bg-[#0b101a] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-slate-800/80 shrink-0">
        <span className="text-xs font-bold text-slate-200 truncate" title={group.categoryName}>
          {group.categoryName}
        </span>
        <span className="text-[11px] font-mono text-slate-500 shrink-0">
          {t('heroGridMirrorGroupHeroes', { n: group.heroIds.length })}
        </span>
      </div>

      {group.heroIds.length === 0 ? (
        <p className="px-2 py-2 text-xs text-slate-500 italic">
          {t('heroGridMirrorGroupEmpty')}
        </p>
      ) : (
        <div
          className="flex-1 overflow-y-auto p-1 grid gap-0.5 content-start"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${HERO_TILE_MIN_WIDTH}px, 1fr))`,
          }}
        >
          {group.heroIds.map((heroId, position) => (
            <HeroTile
              key={`${heroId}-${position}`}
              heroId={heroId}
              score={scoreOf(heroId)}
              snapshot={snapshot}
              bracketLabelKey={bracketLabelKey}
              qualityScale={qualityScale}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Um heroi no espelho: icone, nome, a porcentagem do criterio ativo e a NOTA.
 *
 * ## Por que a nota aparece ao lado do winrate
 *
 * A ordem do grupo sai da nota, e a nota NAO é o winrate exibido. Em `COMBINED` ela mistura
 * o meta com o desempenho do proprio jogador; em qualquer criterio ela é o limite inferior
 * de Wilson, entao amostra pequena pesa menos. O efeito pratico, medido num grid real: num
 * grupo com peso pessoal entre 0,61 e 0,81, o heroi da 1a posicao tinha winrate de meta de
 * 48,8% e o da 6a tinha 51,7%.
 *
 * Mostrar so a porcentagem faz a ordem parecer arbitraria — e "parece arbitrario" é como o
 * jogador lê um numero cuja procedencia a tela escondeu. A nota é o que justifica a posicao,
 * entao ela fica visivel; a decomposicao (parcela do meta, parcela pessoal, peso) vai no
 * `title`, e inteira na aba de ranking.
 *
 * FR-030b: nota sem decomposicao NAO é exibivel — quem decide é `isScoreDisplayable`, e sem
 * ela o tile mostra o traco, nunca o numero pelado.
 *
 * Heroi sem dado NAO some e NAO recebe numero estimado — fica na posicao que ocupa no
 * arquivo, marcado, com o motivo no `title`. Some-lo esconderia que ele esta no espelho.
 */
const HeroTile: React.FC<{
  heroId: number;
  score: HeroScore | null;
  snapshot: MirrorSnapshot;
  /** CHAVE, nao texto: a afirmacao de I-13 nao pode depender de quem chamou traduzir certo. */
  bracketLabelKey: TranslationKey;
  qualityScale: ScoreQualityScale | null;
}> = ({ heroId, score, snapshot, bracketLabelKey, qualityScale }) => {
  const { t } = useLanguage();
  const hero = getHero(heroId);
  const display: MirrorHeroDisplay = mirrorHeroDisplay(score, snapshot.criterion);
  const percent = formatRatioPercent(display.ratio);
  const noData = display.kind === 'NONE';
  // GlimpseScore, 0..100 — `formatScoreValue` (0..1) ficou so para a aba de ranking, que
  // mostra a decomposicao tecnica.
  const scoreText = isScoreDisplayable(score) ? formatGlimpseScore(score?.score) : null;
  // Cor só quando a nota é exibivel: nota nao exibivel nao ganha faixa nem cor neutra que se
  // confunda com "intermediario".
  const quality = scoreText ? scoreQuality(score?.score, qualityScale) : null;

  /**
   * O conteudo do tooltip vem de `buildHeroTooltipRows`, que é PURA e testada. Aqui só se
   * traduz e se desenha: a decisao de quais linhas existem — e a invariante FR-014, de que
   * winrate nunca sai sem fonte e amostra — mora em `utils/heroGrid/heroTooltip.ts`, onde o
   * vitest alcanca. Enquanto isso era uma IIFE neste arquivo, nada verificava esse caminho.
   */
  const tooltip = (
    <div className="space-y-1">
      {buildHeroTooltipRows(
        { heroName: hero.displayName, score, criterion: snapshot.criterion, bracketLabelKey },
        metaSourceKey,
      ).map((row, i) => {
        if (row.kind === 'HEADER') {
          return (
            <div key={i} className="flex items-center gap-2 pb-1.5 mb-1 border-b border-slate-800">
              <img
                src={hero.iconUrl}
                alt=""
                onError={handleHeroImageError}
                className="w-7 h-7 rounded-full border border-slate-700 object-cover shrink-0"
              />
              <span className="text-xs font-bold text-slate-100">{row.value}</span>
            </div>
          );
        }
        if (row.kind === 'SCORE') {
          return (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-slate-400">{t(row.labelKey!)}</span>
              <span
                className={`text-base font-mono font-black tabular-nums ${
                  quality ? SCORE_QUALITY_COLOR[quality] : 'text-slate-500'
                }`}
              >
                {row.value}
              </span>
            </div>
          );
        }
        if (row.kind === 'NOTE') {
          return (
            <div key={i} className="text-xs text-slate-500 italic pt-0.5">
              {t(row.labelKey!, row.labelParams)}
            </div>
          );
        }
        return (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-slate-400">{t(row.labelKey!, row.labelParams)}</span>
            {row.value && (
              <span className="text-xs font-mono tabular-nums text-slate-200">{row.value}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Tooltip
      content={tooltip}
      className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md border min-w-0 outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60 ${
        noData ? 'border-slate-800 bg-slate-900/40' : 'border-slate-800/80 bg-slate-900/70'
      }`}
    >
      <img
        src={hero.iconUrl}
        alt={hero.displayName}
        onError={handleHeroImageError}
        className="w-6 h-6 rounded-full border border-slate-700 object-cover shrink-0"
      />

      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-xs font-medium text-slate-100 truncate">{hero.displayName}</div>
        <div className="flex items-baseline justify-between gap-1.5">
          {/* A NOTA vem primeiro e maior: é ELA que define a posicao no grupo. O winrate ao
              lado é a evidencia, nao o criterio — inverter os dois foi o que fez a ordem
              deixar de parecer aleatoria. */}
          <span
            className={`text-sm font-mono font-black tabular-nums shrink-0 ${
              quality ? SCORE_QUALITY_COLOR[quality] : 'text-slate-500'
            }`}
          >
            {scoreText ?? '—'}
          </span>
          {noData || !percent ? (
            <span className="text-xs font-mono text-slate-600 shrink-0">
              {t('heroGridNoData')}
            </span>
          ) : (
            <span
              className={`text-xs font-mono tabular-nums shrink-0 ${
                display.ratio !== null && display.ratio >= 0.5
                  ? 'text-emerald-400/75'
                  : 'text-rose-400/75'
              }`}
            >
              {percent}
            </span>
          )}
        </div>
      </div>
    </Tooltip>
  );
};

export const HeroGridMirrorScreen: React.FC<HeroGridMirrorScreenProps> = ({
  sync,
  onOpenSettings,
  onOpenPanel,
}) => {
  const { t, language } = useLanguage();
  const { mirrorSnapshot, freshness, lastReport } = sync;

  /**
   * A escala é medida, nao adivinhada: o canvas tem a largura que o arquivo do jogador pede
   * (pode passar de 1100 unidades) e a janela tem a que tem. `ResizeObserver` em vez de
   * `window.resize` porque o que muda a largura util aqui é a barra lateral do layout, nao
   * so a janela.
   */
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  /**
   * Ref por CALLBACK, e nao `useRef` + efeito com deps vazias.
   *
   * O container so existe no ramo que tem snapshot: abrindo a tela sem espelho gravado, um
   * efeito de montagem sairia no `if (!node)` e nunca mais rodaria — e quando a
   * sincronizacao automatica do hook chegasse com o espelho, a replica renderizaria com
   * largura medida zero para sempre, sem se ajustar à janela. Com callback ref o observer
   * conecta no instante em que o no aparece, qualquer que seja o caminho.
   */
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  useEffect(() => {
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (typeof width === 'number') setAvailableWidth(width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  // `buildMirrorCanvas` responde o que o ARQUIVO diz; `scaleCanvas` converte unidade da
  // Valve em pixel. Ver `MIRROR_UNIT_SCALE`: a geometria do arquivo é calibrada para o
  // icone que o Dota desenha, e o tile daqui é maior que ele.
  const canvas = useMemo(
    () => scaleCanvas(buildMirrorCanvas(mirrorSnapshot?.groups || [])),
    [mirrorSnapshot],
  );

  // Duas decisoes num lugar so, e testadas: reproduzir a geometria ou empilhar, e com que
  // zoom. Empilhar por janela estreita e empilhar por arquivo sem geometria sao motivos
  // DIFERENTES, e a tela diz qual foi.
  const layout = resolveMirrorLayout(canvas, availableWidth);
  const scale = layout.scale;
  const usesGeometry = layout.mode === 'GEOMETRY';

  /** Nota por heroi, uma vez — o mesmo heroi aparece em varios grupos (I-8). */
  const scoresByHero = useMemo(() => {
    const map = new Map<number, HeroScore>();
    for (const entry of mirrorSnapshot?.scores || []) {
      if (!map.has(entry.heroId)) map.set(entry.heroId, entry);
    }
    return map;
  }, [mirrorSnapshot]);

  /**
   * A escala de cor é calibrada no espelho INTEIRO, nao por grupo.
   *
   * Por grupo, um grupo forte ficaria todo verde e um fraco todo vermelho, e a cor deixaria
   * de comparar o que o jogador quer comparar. Global, ela diz onde o heroi esta no layout —
   * e um grupo que sai quase todo vermelho é informacao legitima sobre aquele grupo.
   */
  const qualityScale = useMemo(
    () => buildScoreQualityScale(mirrorSnapshot?.scores || []),
    [mirrorSnapshot],
  );

  const boxesByCategory = useMemo(() => {
    const map = new Map<number, MirrorCanvasBox>();
    for (const box of canvas.boxes) map.set(box.categoryIndex, box);
    return map;
  }, [canvas]);

  // I-13 / FR-020: "no seu ranque" SÓ quando o bracket era de fato o do jogador na gravacao.
  // Mesmas chaves que o painel e `useBuildAdvice` usam — é a mesma afirmacao.
  // A CHAVE é a fonte; o texto resolvido é derivado dela. `HeroTile` precisa da chave
  // porque quem monta o conteudo do tooltip é uma funcao pura, que nao traduz.
  const bracketLabelKey: TranslationKey = mirrorSnapshot?.bracketIsPlayerSpecific
    ? 'coachBracketYours'
    : 'coachBracketGeneric';
  const bracketLabel = t(bracketLabelKey);

  const days = describeDaysSince(freshness?.daysSinceLastSuccess ?? null);
  // `{n}` só é consumido por `MANY`; as outras chaves ignoram o parametro.
  const daysText = t(DAYS_SINCE_LABEL[days.kind], { n: days.days });
  const stale = isMirrorStale(freshness?.daysSinceLastSuccess ?? null);

  const translateSources = (sources: readonly string[] | undefined) =>
    (sources || [])
      .map((source) => {
        const key = metaSourceKey(source);
        return key ? t(key) : source;
      })
      .join(', ');
  const sourcesUsed = translateSources(mirrorSnapshot?.sourcesUsed);
  const sourcesMissing = translateSources(mirrorSnapshot?.sourcesMissing);

  return (
    <div className="space-y-6">
      {/* ---------- Cabecalho: identidade dos layouts + a config que produziu ---------- */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800/80 bg-[#0c121e] space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                {t('heroGridMirrorScreenTitle')}
              </h3>
              <p className="text-xs text-slate-400">{t('heroGridMirrorScreenSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenPanel}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('heroGridMirrorOpenPanel')}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              {t('heroGridMirrorOpenSettings')}
            </button>
          </div>
        </div>

        {/* FR-035b: qual layout é a origem e qual é o espelho — do SNAPSHOT, que é o que
            estava valendo quando o arquivo foi escrito. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
          <LayoutRef
            label={t('heroGridSourceLayout')}
            configRef={mirrorSnapshot?.source ?? null}
            emptyLabel={t('heroGridSourceNone')}
          />
          <LayoutRef
            label={t('heroGridMirrorLayout')}
            configRef={mirrorSnapshot?.mirror ?? null}
            emptyLabel={t('heroGridMirrorNone')}
          />
        </div>

        {/* A data da gravacao, e a config que a produziu — juntas de proposito: o criterio
            que aparece aqui é o do snapshot, e mudar a config agora nao reescreve o arquivo. */}
        <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-800/80">
          <Chip>
            <Clock className="w-3 h-3" />
            {mirrorSnapshot
              ? t('heroGridMirrorLastSync', {
                  date: new Date(mirrorSnapshot.at).toLocaleString(language),
                })
              : t('heroGridMirrorNeverWritten')}
          </Chip>
          <Chip muted title={t('heroGridDaysSinceLabel')}>
            <span className={stale ? 'text-amber-300' : undefined}>{daysText}</span>
          </Chip>
          {mirrorSnapshot && (
            <>
              <Chip muted>
                {t('heroGridCriterionLabel')}: {t(CRITERION_LABEL[mirrorSnapshot.criterion])}
              </Chip>
              {/* I-13: o rotulo tem de estar VISIVEL, nao so no `title` de cada tile.
                  `heroGridBracketLabel` nao tem placeholder — passar `{bracket}` a ela
                  descarta o valor em silencio, e a afirmacao "media geral" some da tela. */}
              <Chip title={t('heroGridBracketFallbackNote')}>
                {t('heroGridBracketLabel')}: {bracketLabel}
              </Chip>
              {sourcesUsed && <Chip muted>{t('heroGridSourcesUsed', { sources: sourcesUsed })}</Chip>}
            </>
          )}
        </div>
      </div>

      {/* FR-024a: espelho velho por app fechado nao pode ser silencioso. */}
      {mirrorSnapshot && stale && (
        <Notice
          tone="warn"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          title={t('heroGridStaleTitle')}
        >
          {days.kind === 'NEVER'
            ? t('heroGridStaleNeverBody')
            : t('heroGridStaleBody', { days: daysText })}
        </Notice>
      )}

      {/* A replica mostra o gravado; a sessao pode ter produzido outro que foi recusado. */}
      {mirrorSnapshot && lastReport && !lastReport.written && (
        <Notice
          tone="warn"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          title={t('heroGridMirrorNotWrittenTitle')}
        >
          {t('heroGridMirrorNotWrittenBody')}
        </Notice>
      )}

      {/* FR-016: uma fonte fora ⇒ PARTIAL, ESCREVE, e tem de sair rotulado. Esta é a tela
          emoldurada como "este é o seu layout", entao omitir aqui é pior que omitir no
          painel: o jogador leria a ordem como se as duas fontes tivessem entrado. */}
      {mirrorSnapshot && sourcesMissing && (
        <Notice
          tone="warn"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          title={t('heroGridSourcesMissingTitle')}
        >
          {t('heroGridSourcesMissingBody', { sources: sourcesMissing })}
        </Notice>
      )}

      {/* ---------- O card unico de leitura da tela ----------

          Eram quatro avisos separados — ordem, winrate geral, espelho gerado, customizacao —
          e quatro caixas empilhadas com paragrafo cada uma ninguem lê. Um card, quatro linhas
          curtas: a obrigacao de FR-034b e FR-008f continua cumprida, e agora com chance de
          ser lida. */}
      {mirrorSnapshot && (
        <Notice
          tone="info"
          icon={<Info className="w-4 h-4 text-cyan-400" />}
          title={t('heroGridMirrorGuideTitle')}
        >
          <div className="space-y-2.5">
            {/* O comeco que faltava: o card explicava o GlimpseScore assumindo que a pessoa
                ja sabia o que é o espelho. RECOLHIVEL e fechado por padrao porque este card
                acabou de ser enxugado por excesso de texto — fechado, custa uma linha.
                O texto é reaproveitado das configuracoes, para nao existirem duas versoes
                da mesma promessa envelhecendo em paralelo. */}
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs font-bold text-cyan-300/90 hover:text-cyan-200 transition">
                <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-90" />
                <span>{t('heroGridMirrorWhatIsThis')}</span>
              </summary>
              <div className="pt-2 pl-5 space-y-1.5 text-slate-400">
                <p>{t('heroGridDesc')}</p>
                <p>{t('heroGridSourceDesc')}</p>
              </div>
            </details>

            <div className="space-y-1 pt-1 border-t border-slate-800/80">
              <p>
                <strong className="text-cyan-300">GlimpseScore</strong> — {t('heroGridMirrorScoreWhat')}
              </p>
              {/* A formula, explicita. O `{k}` vem de `PERSONAL_WEIGHT_K` em vez de estar
                  escrito no dicionario: texto que repete uma constante envelhece calado. */}
              <p className="font-mono text-xs text-slate-300 bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5 overflow-x-auto">
                {t(SCORE_FORMULA_LABEL[mirrorSnapshot.criterion], { k: PERSONAL_WEIGHT_K })}
              </p>
              <p>{t('heroGridMirrorScoreWhy')}</p>
            </div>

            {/* A cor é RELATIVA a este layout: a tela mostra os limiares e diz com quem
                compara, senao verde seria lido como "heroi bom" em absoluto. */}
            {qualityScale && (
              <p className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                <span className="text-emerald-400 font-bold">
                  ≥ {formatGlimpseScore(qualityScale.good)} {t('heroGridMirrorScoreBandGood')}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400 font-bold">
                  ≥ {formatGlimpseScore(qualityScale.fair)} {t('heroGridMirrorScoreBandFair')}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-rose-400 font-bold">
                  {t('heroGridMirrorScoreBandPoor')}
                </span>
                <span className="text-slate-500">
                  {t('heroGridMirrorScoreBands', { n: qualityScale.sampleSize })}
                </span>
              </p>
            )}

            <ul className="space-y-1 pt-2 border-t border-slate-800/80 text-slate-400">
              {/* FR-034b e FR-008f, em uma linha cada. */}
              <li>· {t('heroGridMirrorShortGeneral')}</li>
              <li>· {t('heroGridMirrorShortGenerated')}</li>
              <li>· {t('heroGridMirrorShortCustomize')}</li>
            </ul>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-bold transition"
              >
                {t('heroGridMirrorOpenSettings')}
              </button>
              <button
                type="button"
                onClick={onOpenPanel}
                className="px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-bold transition"
              >
                {t('heroGridMirrorOpenPanel')}
              </button>
            </div>
          </div>
        </Notice>
      )}

      {/* Geometria inutilizavel: os grupos empilham, e a tela diz que empilhou. */}
      {mirrorSnapshot && mirrorSnapshot.groups.length > 0 && layout.mode === 'FLOW_NO_GEOMETRY' && (
        <Notice
          tone="warn"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          title={t('heroGridMirrorGeometryFallbackTitle')}
        >
          {t('heroGridMirrorGeometryFallbackBody')}
        </Notice>
      )}

      {/* O outro motivo de empilhar: a geometria serve, a janela é que nao comporta. */}
      {mirrorSnapshot && layout.mode === 'FLOW_TOO_NARROW' && (
        <Notice
          tone="info"
          icon={<Info className="w-4 h-4 text-cyan-400" />}
          title={t('heroGridMirrorNarrowTitle')}
        >
          {t('heroGridMirrorNarrowBody')}
        </Notice>
      )}

      {/* ---------- A replica ---------- */}
      {!mirrorSnapshot ? (
        <Notice
          tone="info"
          icon={<Info className="w-4 h-4 text-cyan-400" />}
          title={t('heroGridMirrorEmptyTitle')}
        >
          {t('heroGridMirrorEmptyBody')}
        </Notice>
      ) : (
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80 bg-[#0b101a] space-y-3">
          {/* Sempre que a geometria é reproduzida, e nao so quando encolhe.
              "Reduzido a 88%" era um numero tecnico que respondia a pergunta errada: a escala
              é UNIFORME, entao grupos e posicoes saem identicos ao arquivo. O que nao bate com
              o jogo é o tamanho de cada heroi — o tile carrega nome e GlimpseScore, e ocupa
              varias vezes a area do icone que o Dota desenha. Essa é a diferenca que o jogador
              vai notar ao abrir o jogo, e é ela que a frase precisa antecipar. */}
          {usesGeometry && (
            <p className="text-xs text-slate-500">{t('heroGridMirrorFitNotice')}</p>
          )}

          <div ref={attachContainer} className="w-full overflow-x-auto">
            {usesGeometry ? (
              /* As DUAS medidas do canvas escalado sao reservadas aqui: `transform: scale`
                 é visual e nao encolhe a caixa de layout, entao sem a largura o container
                 rolaria horizontalmente o tamanho nao escalado e sobraria vazio à direita;
                 sem a altura o wrapper absoluto colapsaria e o card fecharia em cima da
                 replica. */
              <div
                style={{ width: canvas.width * scale, height: canvas.height * scale }}
                className="relative mx-auto"
              >
                <div
                  style={{
                    width: canvas.width,
                    height: canvas.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                  className="relative"
                >
                  {mirrorSnapshot.groups.map((group) => (
                    <GroupBox
                      key={group.categoryIndex}
                      group={group}
                      box={boxesByCategory.get(group.categoryIndex) ?? null}
                      scoreOf={(heroId) => scoresByHero.get(heroId) ?? null}
                      snapshot={mirrorSnapshot}
                      bracketLabelKey={bracketLabelKey}
                      qualityScale={qualityScale}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mirrorSnapshot.groups.map((group) => (
                  <GroupBox
                    key={group.categoryIndex}
                    group={group}
                    box={null}
                    scoreOf={(heroId) => scoresByHero.get(heroId) ?? null}
                    snapshot={mirrorSnapshot}
                    bracketLabelKey={bracketLabelKey}
                    qualityScale={qualityScale}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
