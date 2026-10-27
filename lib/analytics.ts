'use client';

import { logEvent, setUserProperties } from 'firebase/analytics';
import { analytics } from '@/lib/firebase';

type EventParams = Record<string, string | number | boolean | null | undefined>;

// Minimal shape of the Umami tracker exposed on window once stats.kina.men
// script.js has loaded. Guarded with `?.` everywhere because the script is
// deferred, env-gated, and blocked by many ad-blockers.
interface UmamiWindow {
  umami?: {
    track: (
      eventOrPayload: string | Record<string, unknown>,
      params?: Record<string, unknown>,
    ) => void;
    identify?: (id: string, data?: Record<string, unknown>) => void;
  };
}

function umami(): UmamiWindow['umami'] | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as UmamiWindow).umami;
}

// Clean undefineds out of the params bag — Umami rejects undefined values,
// and Firebase accepts them but drops them silently, so normalise here.
function clean(params?: EventParams): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function trackEvent(name: string, params?: EventParams) {
  const cleaned = clean(params);
  // Firebase Analytics — existing, unchanged behaviour.
  try {
    if (analytics) {
      logEvent(analytics, name, cleaned as Record<string, unknown> | undefined);
    }
  } catch (e) {
    console.warn('[analytics] firebase trackEvent failed', e);
  }
  // Umami — fan out the same event. No-op when the script isn't loaded
  // (missing website id, ad-blocker, or still booting).
  try {
    umami()?.track(name, cleaned);
  } catch (e) {
    console.warn('[analytics] umami trackEvent failed', e);
  }
}

// Pageview helper used by AnalyticsTracker — Umami's SPA pattern is to call
// track('pageview', { url, title }) on each route change (auto-track is off
// in layout.tsx so we don't double-count).
export function trackPageview(url: string, title?: string) {
  try {
    umami()?.track('pageview', clean({ url, title }));
  } catch (e) {
    console.warn('[analytics] umami pageview failed', e);
  }
}

export function setAnalyticsUser(uid: string | null) {
  try {
    if (analytics) setUserProperties(analytics, { uid: uid || undefined });
  } catch (e) {
    console.warn('[analytics] firebase setAnalyticsUser failed', e);
  }
  try {
    if (uid) umami()?.identify?.(uid);
  } catch (e) {
    console.warn('[analytics] umami identify failed', e);
  }
}
