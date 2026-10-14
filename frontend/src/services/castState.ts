import { useState, useEffect } from 'react';
import type { CastDevice } from './castService';

let activeTarget: CastDevice | null = null;
const listeners = new Set<(target: CastDevice | null) => void>();

export function getActiveCastTarget(): CastDevice | null {
  return activeTarget;
}

export function setActiveCastTarget(target: CastDevice | null): void {
  activeTarget = target;
  listeners.forEach((fn) => fn(target));
}

export function useActiveCastTarget(): CastDevice | null {
  const [target, setTarget] = useState<CastDevice | null>(activeTarget);
  useEffect(() => {
    listeners.add(setTarget);
    return () => {
      listeners.delete(setTarget);
    };
  }, []);
  return target;
}
