'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent, trackPageview } from '@/lib/analytics';
import { onAuthChange } from '@/lib/auth';
import { setAnalyticsUser } from '@/lib/analytics';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString();
    const page_location = qs ? `${pathname}?${qs}` : pathname;
    // Firebase (existing custom event) + Umami (via its own pageview
    // channel). Umami's auto-track is disabled in layout.tsx so this is
    // the single source of pageview counts there.
    trackEvent('page_view', { page_location, page_path: pathname });
    trackPageview(page_location, typeof document !== 'undefined' ? document.title : undefined);
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

