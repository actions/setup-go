import * as exec from '@actions/exec';
import {supportedPackageManagers, PackageManagerInfo} from './package-managers';

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

export const getPackageManagerInfo = async (packageManager: string) => {
  if (!supportedPackageManagers[packageManager]) {
    throw new Error(
      `It's not possible to use ${packageManager}, please, check correctness of the package manager name spelling.`
    );
  }
  const obtainedPackageManager = supportedPackageManagers[packageManager]

  return obtainedPackageManager;
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
