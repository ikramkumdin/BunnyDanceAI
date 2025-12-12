// Simple in-memory cache for Kie.ai video callback results
// This stores callback results temporarily so polling can retrieve them

export interface VideoCallbackResult {
  taskId: string;
  status: string;
  videoUrl?: string;
  error?: string;
  timestamp: number;
}

const callbackCache = new Map<string, VideoCallbackResult>();

// Cache expiry time (30 minutes)
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

export function storeVideoCallbackResult(result: Omit<VideoCallbackResult, 'timestamp'>) {
  const cacheEntry: VideoCallbackResult = {
    ...result,
    timestamp: Date.now(),
  };

  callbackCache.set(result.taskId, cacheEntry);
  console.log(`💾 Stored video callback result for task: ${result.taskId}`);

  cleanupExpiredEntries();
}

export function getVideoCallbackResult(taskId: string): VideoCallbackResult | null {
  const result = callbackCache.get(taskId);
  if (!result) return null;

  if (Date.now() - result.timestamp > CACHE_EXPIRY_MS) {
    callbackCache.delete(taskId);
    console.log(`🗑️ Removed expired video cache entry for task: ${taskId}`);
    return null;
  }

  return result;
}

export function getVideoCacheStats() {
  return {
    size: callbackCache.size,
    entries: Array.from(callbackCache.keys()),
  };
}

function cleanupExpiredEntries() {
  const now = Date.now();
  let deletedCount = 0;

  for (const [taskId, result] of callbackCache.entries()) {
    if (now - result.timestamp > CACHE_EXPIRY_MS) {
      callbackCache.delete(taskId);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} expired video cache entries`);
  }
}


