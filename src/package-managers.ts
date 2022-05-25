type SupportedPackageManagers = {
  [prop: string]: PackageManagerInfo;
};

export interface PackageManagerInfo {
  dependencyFilePattern: string;
  cacheFolderCommandList: string[];
}

export const supportedPackageManagers: SupportedPackageManagers = {
  default: {
    dependencyFilePattern: 'go.sum',
    cacheFolderCommandList: ['go env GOMODCACHE', 'go env GOCACHE']
  }
};
