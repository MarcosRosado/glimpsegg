import type { TranslationKey } from '../../i18n/translations';
import type { HeroScore, MetaSource, NoDataReason, RankingCriterion } from '../../types/heroGrid';
import { formatGlimpseScore, mirrorHeroDisplay, type MirrorHeroDisplay } from './mirrorLayout';
import { formatRatioPercent, isPersonalApplied, isScoreDisplayable } from './tabFormat';

/**
 * O CONTEUDO do tooltip de um heroi, como dado — nunca como frase.
 *
 * Era uma IIFE dentro do `HeroTile` que grudava tudo com ` · ` num atributo `title` nativo:
 * uma linha só, sem hierarquia, e — o que importa aqui — **sem teste**, porque `.tsx` nao é
 * testavel neste projeto (vitest em `environment: 'node'`). O que este modulo produz é uma
 * lista de linhas tipadas; quem desenha decide se vira `title`, popover ou tabela.
 *
 * **Nao produz texto.** Devolve `TranslationKey` literais e os numeros ja formatados, e a
 * formatacao por locale acontece na UI — o mesmo desenho de `RuleId` -> `RULE_TEXT` no
 * motor de coaching, e de `labels.ts` nesta feature. Montar frase aqui devolveria o
 * problema que aquela separacao resolve: texto de uma locale so, escondido na logica.
 *
 * FR-014 é invariante deste modulo: onde aparece um winrate, aparecem tambem a fonte e o
 * tamanho da amostra. Nao existe caminho que emita `ratio` sozinho.
 */

/**
 * `HEADER` é o nome do heroi, `SCORE` o GlimpseScore (o numero grande), `ROW` um par
 * rotulo/valor e `NOTE` uma ressalva sem valor proprio.
 */
export type TooltipRowKind = 'HEADER' | 'SCORE' | 'ROW' | 'NOTE';

export interface TooltipRow {
  kind: TooltipRowKind;
  /** Chave i18n do rotulo. Ausente em `HEADER`, que ja carrega o nome pronto. */
  labelKey?: TranslationKey;
  /** Parametros do `t()`, quando o texto tem placeholder. */
  labelParams?: Record<string, string | number>;
  /** Valor ja formatado (percentual, nota, peso). Ausente em `NOTE`. */
  value?: string;
}

export interface HeroTooltipInput {
  heroName: string;
  score: HeroScore | null;
  criterion: RankingCriterion;
  /**
   * `coachBracketYours` ou `coachBracketGeneric`, conforme `isPlayerSpecific`. Chega como
   * CHAVE e nao como string resolvida: é a afirmacao de honestidade de I-13, e ela nao pode
   * depender de quem chamou ter traduzido certo.
   */
  bracketLabelKey: TranslationKey;
}

/**
 * `metaSourceKey` de `components/heroGrid/labels.ts`, injetada.
 *
 * Recebida como parametro para este modulo nao importar de `components/` — `utils/` é a
 * camada que o vitest alcanca, e puxar componente para ca inverteria a dependencia que
 * torna o teste possivel.
 */
type SourceKeyResolver = (source: MetaSource) => TranslationKey | null;

/**
 * Mesma particao de `NO_DATA_LABEL` em `components/heroGrid/labels.ts`, repetida aqui pelo
 * motivo acima. A copia nao pode divergir em silencio: `heroTooltip.test.ts` compara as
 * duas tabelas chave a chave.
 */
const NO_DATA_REASON_KEY: Record<NoDataReason, TranslationKey> = {
  NO_META: 'heroGridNoDataNoMeta',
  NO_PERSONAL_IN_PERSONAL_ONLY: 'heroGridNoDataNoPersonal',
  HERO_UNKNOWN: 'heroGridNoDataHeroUnknown',
};

export function buildHeroTooltipRows(
  input: HeroTooltipInput,
  sourceKey: SourceKeyResolver,
): TooltipRow[] {
  const { heroName, score, criterion, bracketLabelKey } = input;
  const display: MirrorHeroDisplay = mirrorHeroDisplay(score, criterion);
  const rows: TooltipRow[] = [{ kind: 'HEADER', value: heroName }];

  // Sem dado, a saida é CURTA e para aqui: nao ha winrate, nao ha nota, e enfileirar
  // parcelas vazias so daria a impressao de que existe alguma medida por tras.
  if (display.kind === 'NONE') {
    rows.push({ kind: 'ROW', labelKey: 'heroGridNoData' });
    if (display.noDataReason) {
      rows.push({ kind: 'NOTE', labelKey: NO_DATA_REASON_KEY[display.noDataReason] });
    }
    return rows;
  }

  const percent = formatRatioPercent(display.ratio);
  if (percent) {
    // FR-014: o numero NUNCA sai sozinho. Fonte e amostra entram nas linhas seguintes, e a
    // ausencia de qualquer uma delas é o que este bloco existe para tornar visivel.
    rows.push({
      kind: 'ROW',
      labelKey: display.kind === 'META' ? 'heroGridMetaWinrate' : 'heroGridPersonalWinrate',
      value: percent,
    });

    const key = display.source ? sourceKey(display.source) : null;
    if (key) rows.push({ kind: 'ROW', labelKey: key });
    if (display.sampleSize !== null) {
      rows.push({
        kind: 'ROW',
        labelKey: 'coachSampleSize',
        labelParams: { n: display.sampleSize },
      });
    }
    // O ranque só qualifica o numero do META: o winrate pessoal é do jogador, e dizer
    // "no seu ranque" ao lado dele sugeriria um recorte que nao foi feito.
    if (display.kind === 'META') rows.push({ kind: 'ROW', labelKey: bracketLabelKey });
  }

  const scoreText = isScoreDisplayable(score) ? formatGlimpseScore(score?.score) : null;
  if (scoreText) rows.push({ kind: 'SCORE', labelKey: 'heroGridScoreLabel', value: scoreText });

  const breakdown = score?.breakdown;
  if (breakdown) {
    // As parcelas na MESMA escala da nota: "GlimpseScore 42.6" ao lado de "parcela 0.512"
    // faria o jogador procurar a relacao entre dois numeros que nao se comparam.
    const meta = formatGlimpseScore(breakdown.metaComponent);
    const personal = formatGlimpseScore(breakdown.personalComponent);
    const weight = formatRatioPercent(breakdown.personalWeight, 0);
    if (meta) rows.push({ kind: 'ROW', labelKey: 'heroGridMetaComponent', value: meta });
    if (personal) {
      rows.push({ kind: 'ROW', labelKey: 'heroGridPersonalComponent', value: personal });
    }
    if (weight) rows.push({ kind: 'ROW', labelKey: 'heroGridPersonalWeight', value: weight });
    if (!isPersonalApplied(score)) {
      rows.push({ kind: 'NOTE', labelKey: 'heroGridPersonalNotApplied' });
    }
  }

  // Em COMBINED o OUTRO winrate tambem entra: é ele que explica a nota quando o peso pessoal
  // é alto, e sem ele a distancia entre a % exibida e a posicao no grupo fica sem causa.
  if (criterion === 'COMBINED') {
    const personal = score?.personal;
    const personalPercent = personal ? formatRatioPercent(personal.winRate) : null;
    if (personal && personal.games > 0 && personalPercent) {
      rows.push({
        kind: 'ROW',
        labelKey: 'heroGridPersonalWinrate',
        value: personalPercent,
      });
      rows.push({
        kind: 'ROW',
        labelKey: 'heroGridPersonalGames',
        labelParams: { n: personal.games },
      });
    } else {
      rows.push({ kind: 'NOTE', labelKey: 'heroGridPersonalNone' });
    }
  }

  return rows;
}
