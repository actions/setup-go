import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import fs from 'fs';
import path from 'path';
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
  const obtainedPackageManager = supportedPackageManagers[packageManager];

  return obtainedPackageManager;
};

export const getCacheDirectoryPath = async (
  packageManagerInfo: PackageManagerInfo,
  includeBuildCache = true
) => {
  const commands = includeBuildCache
    ? packageManagerInfo.cacheFolderCommandList
    : packageManagerInfo.cacheFolderCommandList.slice(0, 1);

  const pathOutputs = await Promise.allSettled(
    commands.map(async command => getCommandOutput(command))
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

function getDirSizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) return stat.size;

  let total = 0;
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirSizeBytes(entryPath);
    } else {
      total += fs.statSync(entryPath).size;
    }
  }
  return total;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function logCacheSizes(cachePaths: string[]): void {
  const labels = ['GOMODCACHE', 'GOCACHE'];
  let total = 0;
  for (let i = 0; i < cachePaths.length; i++) {
    const size = getDirSizeBytes(cachePaths[i]);
    total += size;
    core.info(`Cache size ${labels[i] || cachePaths[i]}: ${formatSize(size)}`);
  }
  core.info(`Cache size total: ${formatSize(total)}`);
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
