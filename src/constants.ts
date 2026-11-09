export enum State {
  CacheEntries = 'CACHE_ENTRIES'
}

export enum Outputs {
  CacheHit = 'cache-hit',
  GoBinPath = 'go-bin-path'
}

export const GO_ENV_OUTPUTS = [
  'GOPATH',
  'GOBIN',
  'GOROOT',
  'GOCACHE',
  'GOMODCACHE',
  'GOOS',
  'GOARCH',
  'GOTOOLDIR'
] as const;

export type GoEnvVar = (typeof GO_ENV_OUTPUTS)[number];
export type GoEnv = Partial<Record<GoEnvVar, string>>;
