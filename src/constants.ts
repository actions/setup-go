export enum State {
    CacheModPrimaryKey = 'CACHE_KEY',
    CacheModMatchedKey = 'CACHE_RESULT',
    CacheBuildPrimaryKey = 'CACHE_BUILD_KEY',
    CacheBuildMatchedKey = 'CACHE_BUILD_RESULT'
}

export enum Outputs {
    CacheModHit = 'cache-hit',
    CacheBuildHit = 'cache-build-hit'
}
