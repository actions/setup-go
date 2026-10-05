import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';

import {State, Outputs} from './constants.js';
import {PackageManagerInfo} from './package-managers.js';
import {
  CacheEntry,
  canRestoreCachesInParallel,
  getCacheDirectoryPath,
  getPackageManagerInfo
} from './cache-utils.js';

export const restoreCache = async (
  versionSpec: string,
  packageManager: string,
  cacheDependencyPath?: string
) => {
  core.setOutput(Outputs.CacheHit, false);
  const packageManagerInfo = await getPackageManagerInfo(packageManager);
  const platform = process.env.RUNNER_OS;
  const arch = process.arch;

  const cachePaths = await getCacheDirectoryPath(packageManagerInfo);

  const dependencyFilePath = cacheDependencyPath
    ? cacheDependencyPath
    : findDependencyFile(packageManagerInfo);
  const fileHash = await glob.hashFiles(dependencyFilePath);

  if (!fileHash) {
    throw new Error(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
  }

  const linuxVersion =
    process.env.RUNNER_OS === 'Linux' ? `${process.env.ImageOS}-` : '';
  const primaryKeys = {
    // Downloaded module sources can be reused across Go versions and runner
    // architectures. Keep OS isolation for filesystem compatibility.
    modules: `setup-go-modules-${platform}-${fileHash}`,
    build: `setup-go-build-${platform}-${arch}-${linuxVersion}go-${versionSpec}-${fileHash}`
  };
  const entries: CacheEntry[] = cachePaths.map(directory => ({
    ...directory,
    primaryKey: primaryKeys[directory.kind]
  }));

  const restoreEntry = async (entry: CacheEntry) => {
    core.debug(`${entry.kind} primary key is ${entry.primaryKey}`);
    try {
      entry.matchedKey = await cache.restoreCache(
        [entry.path],
        entry.primaryKey
      );
      if (entry.matchedKey) {
        core.info(`${entry.kind} cache restored from key: ${entry.matchedKey}`);
      } else {
        core.info(`${entry.kind} cache is not found`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`Restore ${entry.kind} cache failed: ${message}`);
    }
  };

  if (canRestoreCachesInParallel(entries)) {
    await Promise.all(entries.map(restoreEntry));
  } else {
    for (const entry of entries) {
      await restoreEntry(entry);
    }
  }

  // Preserve the resolved paths so the post step uses the same cache versions,
  // even if a later step changes the Go environment.
  core.saveState(State.CacheEntries, entries);
  core.setOutput(
    Outputs.CacheHit,
    entries.length === packageManagerInfo.cacheFolderCommandList.length &&
      entries.every(entry => entry.matchedKey === entry.primaryKey)
  );
};

const findDependencyFile = (packageManager: PackageManagerInfo) => {
  const dependencyFile = packageManager.dependencyFilePattern;
  const workspace = process.env.GITHUB_WORKSPACE!;
  const rootContent = fs.readdirSync(workspace);

  const goModFileExists = rootContent.includes(dependencyFile);
  if (!goModFileExists) {
    throw new Error(
      `Dependencies file is not found in ${workspace}. Supported file pattern: ${dependencyFile}`
    );
  }

  return path.join(workspace, dependencyFile);
};
