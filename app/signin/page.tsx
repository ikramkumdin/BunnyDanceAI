'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SignInModal from '@/components/SignInModal';
import { onAuthChange } from '@/lib/auth';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);

  const nextPath = useMemo(() => {
    const next = searchParams.get('next');
    // Prevent open redirects to other origins
    if (!next || !next.startsWith('/')) return '/';
    return next;
  }, [searchParams]);

  useEffect(() => {
    // If user signs in, send them back
    const unsub = onAuthChange((u) => {
      if (u) {
        router.replace(nextPath);
      }
    });
    return () => unsub();
  }, [router, nextPath]);

  return (
    <div className="min-h-screen bg-slate-950">
      <SignInModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          router.replace(nextPath);
        }}
      />
    </div>
  );
}

