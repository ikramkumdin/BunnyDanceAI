'use client';

/**
 * Re-host a freshly generated media URL to permanent storage (GCS) before it is
 * saved to Firestore. Generation providers return temporary URLs that expire,
 * so persisting those directly produces broken images/videos later on.
 *
 * On ANY failure this returns the original URL unchanged, so saving an asset
 * never breaks just because persistence was unavailable.
 */
export async function persistMediaUrl(
  url: string,
  type: 'image' | 'video',
  userId?: string
): Promise<string> {
  if (!url || url.includes('storage.googleapis.com')) return url;

  try {
    const { auth } = await import('./firebase');
    const { getIdToken } = await import('firebase/auth');
    const token = auth?.currentUser ? await getIdToken(auth.currentUser) : null;

    const res = await fetch('/api/persist-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ url, type, userId }),
    });

    if (!res.ok) return url;
    const data = await res.json();
    return typeof data?.url === 'string' ? data.url : url;
  } catch {
    return url;
  }
}
