import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import fs from 'fs';
import path from 'path';
import {
  supportedPackageManagers,
  PackageManagerInfo,
  CacheKind
} from './package-managers.js';

export interface CacheDirectory {
  kind: CacheKind;
  path: string;
}

export interface CacheEntry extends CacheDirectory {
  primaryKey: string;
  matchedKey?: string;
}

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
): Promise<CacheDirectory[]> => {
  const pathOutputs = await Promise.allSettled(
    packageManagerInfo.cacheFolderCommandList.map(async ({kind, command}) => ({
      kind,
      path: await getCommandOutput(command)
    }))
  );

  const cachePaths: CacheDirectory[] = [];
  for (const item of pathOutputs) {
    if (item.status === 'fulfilled') {
      if (item.value.path) {
        cachePaths.push(item.value);
      }
    } else {
      core.info(`[warning]getting cache directory path failed: ${item.reason}`);
    }
  }

  if (!cachePaths.length) {
    throw new Error(`Could not get cache folder paths.`);
  }

  return cachePaths;
};

export function canRestoreCachesInParallel(
  directories: CacheDirectory[]
): boolean {
  try {
    const paths = directories.map(directory => {
      const resolvedPath = resolveCachePath(directory.path);
      // Conservatively handle case-insensitive Windows/macOS filesystems.
      return process.platform === 'darwin' || process.platform === 'win32'
        ? resolvedPath.toLowerCase()
        : resolvedPath;
    });
    // A cache archive can replace symlinks traversed by the other restore.
    // Canonical destinations alone do not capture that extraction footprint.
    if (
      paths.some((resolvedPath, index) => {
        const absolutePath = path.resolve(directories[index].path);
        const normalizedPath =
          process.platform === 'darwin' || process.platform === 'win32'
            ? absolutePath.toLowerCase()
            : absolutePath;
        return resolvedPath !== normalizedPath;
      })
    ) {
      return false;
    }
    return paths.every((parent, index) =>
      paths.every((child, otherIndex) => {
        if (index === otherIndex) {
          return true;
        }
        const relative = path.relative(parent, child);
        return (
          relative === '..' ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        );
      })
    );
  } catch {
    // If the paths cannot be resolved safely, avoid concurrent extraction.
    return false;
  }
}

function resolveCachePath(directory: string): string {
  const absolutePath = path.resolve(directory);
  try {
    fs.lstatSync(absolutePath);
  } catch (error) {
    const parent = path.dirname(absolutePath);
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' ||
      parent === absolutePath
    ) {
      throw error;
    }
    // Cold cache directories may not exist yet. Resolve their existing
    // ancestors so symlink aliases still participate in the overlap check.
    return path.join(resolveCachePath(parent), path.basename(absolutePath));
  }
  return fs.realpathSync(absolutePath);
}

export function isGhes(): boolean {
  const ghUrl = new URL(
    process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  );

  const hostname = ghUrl.hostname.trimEnd().toUpperCase();
  const isGitHubHost = hostname === 'GITHUB.COM';
  const isGitHubEnterpriseCloudHost = hostname.endsWith('.GHE.COM');
  const isLocalHost = hostname.endsWith('.LOCALHOST');

  return !isGitHubHost && !isGitHubEnterpriseCloudHost && !isLocalHost;
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
