import { useState, useEffect, useCallback } from 'react';
import {
  getCachedGamePatch,
  fetchLatestGamePatch,
  subscribeToPatchUpdates,
} from '../services/gameVersionService';

export interface UseGamePatchResult {
  patch: string;
  isLoading: boolean;
  isDynamic: boolean;
  refreshPatch: () => Promise<string>;
}

export function useGamePatch(stratzToken?: string): UseGamePatchResult {
  const [patch, setPatch] = useState<string>(() => getCachedGamePatch());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDynamic, setIsDynamic] = useState<boolean>(true);

  const refreshPatch = useCallback(async (): Promise<string> => {
    setIsLoading(true);
    try {
      const latest = await fetchLatestGamePatch(true, stratzToken);
      setPatch(latest);
      return latest;
    } finally {
      setIsLoading(false);
    }
  }, [stratzToken]);

  useEffect(() => {
    // Listen for patch updates from any service or component
    const unsubscribe = subscribeToPatchUpdates((newPatch) => {
      setPatch(newPatch);
    });

    // Run silent background update on mount
    fetchLatestGamePatch(false, stratzToken)
      .then((resolved) => {
        setPatch(resolved);
      })
      .catch((err) => {
        console.warn('Silent game patch fetch fallback:', err);
      });

    return () => {
      unsubscribe();
    };
  }, [stratzToken]);

  return {
    patch,
    isLoading,
    isDynamic,
    refreshPatch,
  };
}
