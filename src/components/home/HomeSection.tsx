import React from 'react';
import type { PlayerProfileSummary } from '../../types/dota';
import { RecentFormCard } from '../dashboard/RecentFormCard';
import { PerformanceTrendChart } from '../dashboard/PerformanceTrendChart';
import { TrendsCard } from '../dashboard/TrendsCard';
import { MostPlayedHeroes } from '../dashboard/MostPlayedHeroes';
import { ActivityHeatmap } from '../dashboard/ActivityHeatmap';
import { TeammatesCard } from '../dashboard/TeammatesCard';
import { LastMatchCard } from './LastMatchCard';
import { useTrendMatches } from './useTrendMatches';

/**
 * Início, opção A dos wireframes (docs/PROPOSTA-V2.md §3.2, decisão do dono): a última partida
 * no topo, com o estado do replay; depois forma e tendência; por último os cards menores.
 *
 * A tendência usa as 100 partidas mais recentes (`useTrendMatches`), para as janelas de 50 e
 * 100 serem reais; o resto usa a lista do perfil.
 */
export const HomeSection: React.FC<{
  profile: PlayerProfileSummary;
  onOpenMatch: (matchId: string) => void;
  onOpenAndRequestParse: (matchId: string) => void;
  onOpenHeroMatches: (heroId: number) => void;
  onOpenPeer: (accountId: string) => void;
}> = ({ profile: p, onOpenMatch, onOpenAndRequestParse, onOpenHeroMatches, onOpenPeer }) => {
  const trendMatches = useTrendMatches(p.steamAccountId, p.recentMatches);
  const lastMatch = p.recentMatches[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch">
        <div className="xl:col-span-3 [&>*]:h-full">
          {lastMatch && (
            <LastMatchCard match={lastMatch} onOpen={onOpenMatch} onOpenAndRequestParse={onOpenAndRequestParse} />
          )}
        </div>
        <div className="xl:col-span-2">
          <RecentFormCard recentMatches={p.recentMatches} onSelectMatch={onOpenMatch} />
        </div>
      </div>

      {/* Tendência na largura inteira: é a leitura de "estou melhorando?", e espremida perde o eixo. */}
      {trendMatches.length > 1 && <PerformanceTrendChart matches={trendMatches} onSelectMatch={onOpenMatch} />}

      {/* Os cards menores, em colunas que acomodam alturas diferentes sem buraco. */}
      <div className="columns-1 lg:columns-2 2xl:columns-3 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <TrendsCard
          part="trend"
          matches={trendMatches}
          seasonRank={p.seasonRank}
          leaderboardRank={p.leaderboardRank}
          onSelectMatch={onOpenMatch}
        />
        {/* O clique no herói abre Partidas já filtrada por ele. */}
        <MostPlayedHeroes heroes={p.mostPlayedHeroes} onFilterHero={onOpenHeroMatches} />
        {p.activityDays && p.activityDays.length > 0 && <ActivityHeatmap activityDays={p.activityDays} />}
        {p.peers && p.peers.length > 0 && <TeammatesCard peers={p.peers} onOpenPeer={onOpenPeer} />}
      </div>
    </div>
  );
};
