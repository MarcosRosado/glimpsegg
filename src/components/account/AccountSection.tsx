import React from 'react';
import type { PlayerProfileSummary } from '../../types/dota';
import { PerformanceTrendChart } from '../dashboard/PerformanceTrendChart';
import { QueueRankCard } from '../dashboard/QueueRankCard';
import { useTrendMatches } from '../home/useTrendMatches';
import { AccountStats } from './AccountStats';

/**
 * Seção Conta: o cabeçalho do perfil (montado pelo `App`, que conhece o hero grid), a evolução
 * (Glint, winrate e farm) e, em duas colunas, os totais da carreira de um lado e fila/ranque,
 * recordes e contagens do outro.
 *
 * A evolução estava no Início, na largura inteira, e o dono achou grande demais para uma linha
 * só (2026-11-19): lá ficou uma linha curta de Glint no cartão de forma, e o gráfico completo
 * veio para cá, mais baixo.
 */
export const AccountSection: React.FC<{
  profile: PlayerProfileSummary;
  header: React.ReactNode;
  onOpenMatch: (matchId: string) => void;
}> = ({ profile: p, header, onOpenMatch }) => {
  const trend = useTrendMatches(p.steamAccountId, p.recentMatches);

  return (
    <div className="space-y-6">
      {header}
      {trend.matches.length > 1 && (
        <PerformanceTrendChart
          compact
          matches={trend.matches}
          onSelectMatch={onOpenMatch}
          canLoadMore={trend.canLoadMore}
          loadingMore={trend.loading}
          loadMoreFailed={trend.failed}
          onRequestMore={trend.requestMore}
        />
      )}
      <AccountStats
        steamAccountId={p.steamAccountId}
        onOpenMatch={onOpenMatch}
        aside={
          <QueueRankCard
            matches={trend.matches}
            canLoadMore={trend.canLoadMore}
            loadingMore={trend.loading}
            loadMoreFailed={trend.failed}
            onRequestMore={trend.requestMore}
            seasonRank={p.seasonRank}
            leaderboardRank={p.leaderboardRank}
          />
        }
      />
    </div>
  );
};
