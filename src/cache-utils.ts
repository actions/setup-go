import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {supportedPackageManagers, PackageManagerInfo} from './package-managers';
import fs from 'fs';

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
  const obtainedPackageManager = supportedPackageManagers[packageManager];

  return obtainedPackageManager;
};

export const getCacheDirectoryPath = async (
  packageManagerInfo: PackageManagerInfo
) => {
  const pathOutputs = await Promise.allSettled(
    packageManagerInfo.cacheFolderCommandList.map(async command =>
      getCommandOutput(command)
    )
  );

  const results = pathOutputs.map(item => {
    if (item.status === 'fulfilled') {
      return item.value;
    } else {
      core.info(`[warning]getting cache directory path failed: ${item.reason}`);
    }

    return '';
  });

  const cachePaths = results.filter(item => item);

  if (!cachePaths.length) {
    throw new Error(`Could not get cache folder paths.`);
  }

  return cachePaths;
};

export function isGhes(): boolean {
  const ghUrl = new URL(
    process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  );
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM';
}

export function isCacheFeatureAvailable(): boolean {
  if (cache.isFeatureAvailable()) {
    return true;
  }

  if (isGhes()) {
    core.warning(
      'Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.'
    );
    return false;
  }

  core.warning(
    'The runner was not able to contact the cache service. Caching will be skipped'
  );
  return false;
}

export function parseGoModForToolchainVersion(
  goModPath: string
): string | null {
  try {
    const goMod = fs.readFileSync(goModPath, 'utf8');
    const matches = Array.from(goMod.matchAll(/^toolchain\s+go(\S+)/gm));
    if (matches && matches.length > 0) {
      return matches[matches.length - 1][1];
    }
  } catch (error) {
    if (error.message && error.message.startsWith('ENOENT')) {
      core.warning(
        `go.mod file not found at ${goModPath}, can't parse toolchain version`
      );
      return null;
    }
    throw error;
  }
  return null;
}

function isDirent(item: fs.Dirent | string): item is fs.Dirent {
  return item instanceof fs.Dirent;
}

export function getToolchainDirectoriesFromCachedDirectories(
  goVersion: string,
  cacheDirectories: string[]
): string[] {
  const re = new RegExp(`^toolchain@v[0-9.]+-go${goVersion}\\.`);
  return (
    cacheDirectories
      // This line should be replaced with separating the cache directory from build artefact directory
      // see PoC PR: https://github.com/actions/setup-go/pull/426
      // Till then, the workaround is expected to work in most cases, and it won't cause any harm
      .filter(dir => dir.endsWith('/pkg/mod'))
      .map(dir => `${dir}/golang.org`)
      .flatMap(dir =>
        fs
          .readdirSync(dir)
          .map(subdir => (isDirent(subdir) ? subdir.name : dir))
          .filter(subdir => re.test(subdir))
          .map(subdir => `${dir}/${subdir}`)
      )
  );
}
