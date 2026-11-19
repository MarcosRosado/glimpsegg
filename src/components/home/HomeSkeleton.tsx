import React from 'react';
import { Skeleton, SkeletonCard, SkeletonRows } from '../ui/Skeleton';

/**
 * O Início enquanto o perfil chega. Antes, a primeira carga mostrava o convite "configure sua
 * conta" — a mesma tela de quem nunca configurou — até o perfil responder.
 */
export const HomeSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    <div className="lg:col-span-8 space-y-6">
      <SkeletonCard>
        <Skeleton className="h-3.5 w-32 mb-4" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-24 h-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton className="h-4 w-56 mb-5" />
        <SkeletonRows rows={6} />
      </SkeletonCard>
    </div>
    <div className="lg:col-span-4 space-y-6">
      <SkeletonCard>
        <Skeleton className="h-3.5 w-40 mb-4" />
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-9 flex-1" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton className="h-3.5 w-28 mb-5" />
        <Skeleton className="w-48 h-48 rounded-full mx-auto" />
      </SkeletonCard>
    </div>
  </div>
);
