export enum State {
  CachePrimaryKey = 'CACHE_KEY',
  CacheMatchedKey = 'CACHE_RESULT',
  // For multiple invocations support - stores JSON arrays of keys
  CachePrimaryKeys = 'CACHE_KEYS',
  CacheMatchedKeys = 'CACHE_RESULTS'
}

export enum Outputs {
  CacheHit = 'cache-hit'
}
