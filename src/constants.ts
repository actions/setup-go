export enum State {
  CachePrimaryKey = 'CACHE_KEY',
  CacheMatchedKey = 'CACHE_RESULT'
}

export enum Outputs {
  CacheHit = 'cache-hit',
  GoPath = 'go-path',
  GoBin = 'go-bin',
  GoBinPath = 'go-bin-path',
  GoRoot = 'go-root',
  GoCache = 'go-cache',
  GoModCache = 'go-mod-cache',
  GoOs = 'go-os',
  GoArch = 'go-arch',
  GoToolDir = 'go-tool-dir'
}
