import { useState, useCallback } from 'react';
import { getTabState, setTabState as storeSetTabState } from '@/services/tabStateStore';

export function useTabState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setStateInternal] = useState<T>(() => getTabState<T>(key, initialValue));

  const setState = useCallback(
    (val: T | ((prev: T) => T)) => {
      setStateInternal((prev) => {
        const next = typeof val === 'function' ? (val as (prev: T) => T)(prev) : val;
        storeSetTabState<T>(key, next);
        return next;
      });
    },
    [key]
  );

  return [state, setState];
}
