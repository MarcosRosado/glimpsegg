import React from 'react';
import { Skeleton, SkeletonCard } from '../ui/Skeleton';

/**
 * A partida enquanto o detalhe chega. Antes, abrir uma partida só fazia girar o ícone de
 * atualizar no topo: a tela anterior ficava parada e parecia que o clique não pegou.
 * A forma segue o modo placar (cabeçalho, cartão de destaques, placar), que é o caso comum.
 */
export const MatchSkeleton: React.FC = () => (
  <div className="space-y-5">
    <SkeletonCard className="p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-7 w-28" />
      </div>
    </SkeletonCard>
    <SkeletonCard>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-12 h-7 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonCard>
    {[0, 1].map((side) => (
      <SkeletonCard key={side} className="p-4">
        <Skeleton className="h-3.5 w-32 mb-4" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-12 h-7 shrink-0" />
              <Skeleton className="h-3 w-32" />
              <div className="flex-1" />
              {Array.from({ length: 6 }, (_, j) => (
                <Skeleton key={j} className="w-7 h-5 hidden md:block" />
              ))}
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    ))}
  </div>
);
