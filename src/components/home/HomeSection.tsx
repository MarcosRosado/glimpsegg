import React, { useState } from 'react';
import type { PeerTeammate, PlayerProfileSummary } from '../../types/dota';
import { fetchPlayerPeers } from '../../services/openDotaProfile';
import { useLanguage } from '../../context/LanguageContext';
import { LoadErrorCard } from '../ui/LoadError';
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
 *   winrate — posição a lista não traz) e companheiros.
 * - A atividade fica embaixo das recentes, na principal, para as duas colunas terminarem perto.
 *
 * Saíram daqui: os "Heróis principais" da carreira (a seção Heróis já é isso, com período) e o
 * cartão "Tendências" com as barras de Glint por partida, que repetia o gráfico.
 *
 * **Chamada que falhou não some com o cartão.** Sem a lista de partidas (`recentMatchesFailed`),
 * os cartões que vivem dela mostram o título e o erro, com "tentar de novo" (recarrega o perfil:
 * a lista entra na mesma leva); sem os companheiros (`peersFailed`), o cartão deles tenta de
 * novo só a chamada dele. Antes os dois casos pareciam conta sem partidas ou sem companheiros —
 * e a atividade mostrava 30 dias zerados. Lista que veio vazia segue a regra de cada cartão.
 */
export const HomeSection: React.FC<{
  profile: PlayerProfileSummary;
  onOpenMatch: (matchId: string) => void;
  onOpenAndRequestParse: (matchId: string) => void;
  onOpenHeroMatches: (heroId: number) => void;
  onOpenPeer: (accountId: string) => void;
  onSeeAllMatches: () => void;
  /** "Tentar de novo" dos cartões que vivem da lista de partidas: recarrega o perfil. */
  onReloadProfile: () => void;
  reloadingProfile: boolean;
}> = ({
  profile: p,
  onOpenMatch,
  onOpenAndRequestParse,
  onOpenHeroMatches,
  onOpenPeer,
  onSeeAllMatches,
  onReloadProfile,
  reloadingProfile,
}) => {
  const { t } = useLanguage();
  const trend = useTrendMatches(p.steamAccountId, p.recentMatches);
  const lastMatch = p.recentMatches[0] ?? null;

  // Companheiros buscados de novo pelo cartão, presos à conta: outra conta na tela descarta.
  const [peersRetry, setPeersRetry] = useState<{ key: string; loading: boolean; peers: PeerTeammate[] | null } | null>(null);
  const retryOwn = peersRetry && peersRetry.key === p.steamAccountId ? peersRetry : null;
  const peers = retryOwn?.peers ?? p.peers;
  const peersFailed = retryOwn ? !retryOwn.loading && retryOwn.peers === null : !!p.peersFailed;
  const retryPeers = () => {
    const key = p.steamAccountId;
    setPeersRetry({ key, loading: true, peers: null });
    void fetchPlayerPeers(key).then((fresh) =>
      setPeersRetry((cur) => (cur && cur.key === key ? { key, loading: false, peers: fresh } : cur)),
    );
  };

  const peersCard = () => {
    if (peersFailed || retryOwn?.loading) {
      return (
        <LoadErrorCard
          title={t('teammatesCardTitle')}
          message={t('teammatesLoadError')}
          onRetry={retryPeers}
          retrying={!!retryOwn?.loading}
        />
      );
    }
    return peers && peers.length > 0 ? <TeammatesCard peers={peers} onOpenPeer={onOpenPeer} /> : null;
  };

  if (p.recentMatchesFailed) {
    const matchesError = (title: string) => (
      <LoadErrorCard title={title} message={t('homeMatchesLoadError')} onRetry={onReloadProfile} retrying={reloadingProfile} />
    );
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
          {matchesError(t('homeRecentMatchesTitle'))}
          {matchesError(t('dailyActivityTitle'))}
        </div>
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 min-w-0">
          {matchesError(t('recentForm'))}
          {matchesError(t('heroShareTitle'))}
          {peersCard()}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
        {lastMatch && <LastMatchCard match={lastMatch} onOpen={onOpenMatch} onOpenAndRequestParse={onOpenAndRequestParse} />}
        <RecentMatchesCard matches={p.recentMatches} onOpenMatch={onOpenMatch} onSeeAll={onSeeAllMatches} />
        {/* A atividade é um gráfico largo de 30 barras: cabe melhor aqui que na lateral, e a
            principal terminava ~800 px antes da lateral (medido em 1440 px, 2026-11-20). */}
        {p.activityDays && p.activityDays.length > 0 && <ActivityHeatmap activityDays={p.activityDays} />}
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
        {peersCard()}
      </div>
    </div>
  );
};
