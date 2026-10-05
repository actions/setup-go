type SupportedPackageManagers = {
  [prop: string]: PackageManagerInfo;
};

export type CacheKind = 'modules' | 'build';

export interface PackageManagerInfo {
  dependencyFilePattern: string;
  cacheFolderCommandList: {kind: CacheKind; command: string}[];
}

export const supportedPackageManagers: SupportedPackageManagers = {
  default: {
    dependencyFilePattern: 'go.mod',
    cacheFolderCommandList: [
      {kind: 'modules', command: 'go env GOMODCACHE'},
      {kind: 'build', command: 'go env GOCACHE'}
    ]
  }
};
