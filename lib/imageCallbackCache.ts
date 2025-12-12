// Simple in-memory cache for Kie.ai image callback results
// This stores callback results temporarily so polling can retrieve them

interface ImageCallbackResult {
  taskId: string;
  status: string;
  resultUrls?: string[];
  error?: string;
  timestamp: number;
}

// In-memory storage (will reset on serverless function cold start)
// For production, use Redis/Upstash/Vercel KV instead
const callbackCache = new Map<string, ImageCallbackResult>();

// Cache expiry time (30 minutes)
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

export function storeCallbackResult(result: Omit<ImageCallbackResult, 'timestamp'>) {
  const cacheEntry: ImageCallbackResult = {
    ...result,
    timestamp: Date.now()
  };
  
  callbackCache.set(result.taskId, cacheEntry);
  console.log(`💾 Stored callback result for task: ${result.taskId}`);
  
  // Clean up expired entries
  cleanupExpiredEntries();
}

export function getCallbackResult(taskId: string): ImageCallbackResult | null {
  const result = callbackCache.get(taskId);
  
  if (!result) {
    return null;
  }
  
  // Check if expired
  if (Date.now() - result.timestamp > CACHE_EXPIRY_MS) {
    callbackCache.delete(taskId);
    console.log(`🗑️ Removed expired cache entry for task: ${taskId}`);
    return null;
  }
  
  return result;
}

export function clearCallbackResult(taskId: string) {
  callbackCache.delete(taskId);
  console.log(`🗑️ Cleared cache entry for task: ${taskId}`);
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
    console.log(`🧹 Cleaned up ${deletedCount} expired cache entries`);
  }
}

// Get cache stats for debugging
export function getCacheStats() {
  return {
    size: callbackCache.size,
    entries: Array.from(callbackCache.keys())
  };
}


