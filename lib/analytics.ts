'use client';

import { logEvent, setUserProperties } from 'firebase/analytics';
import { analytics } from '@/lib/firebase';

type EventParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: string, params?: EventParams) {
  try {
    if (!analytics) return;
    logEvent(analytics, name, params as any);
  } catch (e) {
    // Never break UX because analytics failed
    console.warn('[analytics] trackEvent failed', e);
  }
}

export function setAnalyticsUser(uid: string | null) {
  try {
    if (!analytics) return;
    setUserProperties(analytics, { uid: uid || undefined });
  } catch (e) {
    console.warn('[analytics] setAnalyticsUser failed', e);
  }
}

