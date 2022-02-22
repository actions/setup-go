import * as exec from '@actions/exec';

export interface PackageManagerInfo {
  goSumFilePattern: string;
  getCacheFolderCommand: string;
}

export const defaultPackageManager: PackageManagerInfo = {
  goSumFilePattern: 'go.sum',
  getCacheFolderCommand: 'go env GOMODCACHE'
};

export const getCommandOutput = async (toolCommand: string) => {
  let {stdout, stderr, exitCode} = await exec.getExecOutput(
    toolCommand,
    undefined,
    {ignoreReturnCode: true}
  );

  if (exitCode) {
    stderr = !stderr.trim()
      ? `The '${toolCommand}' command failed with exit code: ${exitCode}`
      : stderr;
    throw new Error(stderr);
  }

  return stdout.trim();
};

export const getPackageManagerInfo = async () => {
  return defaultPackageManager;
};

export const getCacheDirectoryPath = async (
  packageManagerInfo: PackageManagerInfo
) => {
  const stdout = await getCommandOutput(
    packageManagerInfo.getCacheFolderCommand
  );

  if (!stdout) {
    throw new Error(`Could not get cache folder path.`);
  }

  return stdout;
};
