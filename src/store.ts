import type { WorkoutSet } from './types';

const KEY = 'iron-log-sets';

export function loadSets(): WorkoutSet[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSets(sets: WorkoutSet[]): void {
  localStorage.setItem(KEY, JSON.stringify(sets));
}
