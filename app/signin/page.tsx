import { Suspense } from 'react';
import SignInClient from './SignInClient';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <SignInClient />
    </Suspense>
  );
}

