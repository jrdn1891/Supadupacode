// @effect-diagnostics globalDate:off - Release timing for client animations, outside an Effect runtime.
import type { AquariumPoint } from "./simulation.ts";

const RELEASE_WINDOW_MS = 15_000;

const releases = new Map<string, { readonly x: number; readonly y: number; readonly at: number }>();

export function releaseFish(keys: ReadonlyArray<string>, from: AquariumPoint) {
  const now = Date.now();
  for (const [key, release] of releases)
    if (now - release.at > RELEASE_WINDOW_MS) releases.delete(key);
  for (const key of keys) releases.set(key, { x: from.x, y: from.y, at: now });
}

export function takeRelease(key: string) {
  const release = releases.get(key);
  releases.delete(key);
  return release !== undefined && Date.now() - release.at <= RELEASE_WINDOW_MS ? release : null;
}
