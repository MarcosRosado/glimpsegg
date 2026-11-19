import React from 'react';
import type { PlayerProfileSummary } from '../../types/dota';
import { RecentFormCard } from '../dashboard/RecentFormCard';
import { ActivityHeatmap } from '../dashboard/ActivityHeatmap';
import { TeammatesCard } from '../dashboard/TeammatesCard';
import { LastMatchCard } from './LastMatchCard';
import { RecentMatchesCard } from './RecentMatchesCard';
import { HeroShareCard } from './HeroShareCard';
import { useTrendMatches } from './useTrendMatches';

/**
 * Início, redesenhado em 2026-11-19 a pedido do dono, que preferiu a disposição da 1.0: uma
 * coluna principal larga com as partidas e uma coluna lateral de cartões pequenos.
 *
 * - Principal: a última partida numa faixa e as recentes logo abaixo (o resto, com filtros,
 *   em Partidas).
 * - Lateral, por relevância: forma (com a linha de Glint no lugar do antigo painel de largura
 *   inteira, que foi para a Conta), o anel de heróis (volta o anel da 1.0, agora por herói e
 *   winrate — posição a lista não traz), companheiros e atividade.
 *
 * Saíram daqui: os "Heróis principais" da carreira (a seção Heróis já é isso, com período) e o
 * cartão "Tendências" com as barras de Glint por partida, que repetia o gráfico.
 */
export const HomeSection: React.FC<{
  profile: PlayerProfileSummary;
  onOpenMatch: (matchId: string) => void;
  onOpenAndRequestParse: (matchId: string) => void;
  onOpenHeroMatches: (heroId: number) => void;
  onOpenPeer: (accountId: string) => void;
  onSeeAllMatches: () => void;
}> = ({ profile: p, onOpenMatch, onOpenAndRequestParse, onOpenHeroMatches, onOpenPeer, onSeeAllMatches }) => {
  const trend = useTrendMatches(p.steamAccountId, p.recentMatches);
  const lastMatch = p.recentMatches[0] ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
        {lastMatch && <LastMatchCard match={lastMatch} onOpen={onOpenMatch} onOpenAndRequestParse={onOpenAndRequestParse} />}
        <RecentMatchesCard matches={p.recentMatches} onOpenMatch={onOpenMatch} onSeeAll={onSeeAllMatches} />
      </div>

      <div className="lg:col-span-5 xl:col-span-4 space-y-6 min-w-0">
        <RecentFormCard recentMatches={p.recentMatches} onSelectMatch={onOpenMatch} />
        <HeroShareCard
          matches={trend.matches}
          canLoadMore={trend.canLoadMore}
          loadingMore={trend.loading}
          loadMoreFailed={trend.failed}
          onRequestMore={trend.requestMore}
          onOpenHeroMatches={onOpenHeroMatches}
        />
        {p.peers && p.peers.length > 0 && <TeammatesCard peers={p.peers} onOpenPeer={onOpenPeer} />}
        {p.activityDays && p.activityDays.length > 0 && <ActivityHeatmap activityDays={p.activityDays} />}
      </div>
    </div>
  );
};
