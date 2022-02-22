type SupportedPackageManagers = {
  [prop: string]: PackageManagerInfo;
};

export interface PackageManagerInfo {
  dependencyFilePattern: string;
  getCacheFolderCommand: string;
}

export const supportedPackageManagers: SupportedPackageManagers = {
  default: {
    dependencyFilePattern: 'go.sum',
    getCacheFolderCommand: 'go env GOMODCACHE'
  }
};
