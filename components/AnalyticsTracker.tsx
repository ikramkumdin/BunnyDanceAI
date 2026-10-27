'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { onAuthChange } from '@/lib/auth';
import { setAnalyticsUser } from '@/lib/analytics';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString();
    const page_location = qs ? `${pathname}?${qs}` : pathname;
    // Firebase gets the explicit page_view event. Umami auto-tracks both
    // initial loads and SPA pushState navigations from its own script, so
    // we don't fire a second umami pageview from here (would double-count).
    trackEvent('page_view', { page_location, page_path: pathname });
  }, [pathname, searchParams]);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setAnalyticsUser(u?.uid || null);
      if (u) trackEvent('login', { method: 'firebase' });
    });
    return () => unsub();
  }, []);

  return null;
}

