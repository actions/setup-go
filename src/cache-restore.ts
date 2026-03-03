import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';

import {State, Outputs} from './constants';
import {PackageManagerInfo} from './package-managers';
import {getCacheDirectoryPath, getPackageManagerInfo} from './cache-utils';

export const restoreCache = async (
  versionSpec: string,
  packageManager: string,
  cacheDependencyPath?: string
) => {
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
  const primaryKey = `setup-go-${platform}-${arch}-${linuxVersion}go-${versionSpec}-${fileHash}`;
  core.debug(`primary key is ${primaryKey}`);

  // Check if this key was already processed in a previous invocation
  const existingKeys = getExistingPrimaryKeys();
  if (existingKeys.includes(primaryKey)) {
    core.info(
      `Cache key ${primaryKey} already processed in this job, skipping restore`
    );
    core.setOutput(Outputs.CacheHit, true);
    return;
  }

  // Save state for post step - accumulate keys for multiple invocations
  addPrimaryKey(primaryKey);

  // Legacy single-key state (for backward compatibility)
  core.saveState(State.CachePrimaryKey, primaryKey);

  const cacheKey = await cache.restoreCache(cachePaths, primaryKey);
  core.setOutput(Outputs.CacheHit, Boolean(cacheKey));

  if (!cacheKey) {
    core.info(`Cache is not found`);
    core.setOutput(Outputs.CacheHit, false);
    return;
  }

  // Save matched key state - accumulate for multiple invocations
  addMatchedKey(cacheKey);

  // Legacy single-key state (for backward compatibility)
  core.saveState(State.CacheMatchedKey, cacheKey);
  core.info(`Cache restored from key: ${cacheKey}`);
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

// Helper functions for managing multiple cache keys
function getExistingPrimaryKeys(): string[] {
  try {
    const keysJson = core.getState(State.CachePrimaryKeys);
    if (!keysJson) return [];
    return JSON.parse(keysJson) as string[];
  } catch {
    return [];
  }
}

function addPrimaryKey(key: string): void {
  const existingKeys = getExistingPrimaryKeys();
  if (!existingKeys.includes(key)) {
    existingKeys.push(key);
    core.saveState(State.CachePrimaryKeys, JSON.stringify(existingKeys));
  }
}

function getExistingMatchedKeys(): string[] {
  try {
    const keysJson = core.getState(State.CacheMatchedKeys);
    if (!keysJson) return [];
    return JSON.parse(keysJson) as string[];
  } catch {
    return [];
  }
}

function addMatchedKey(key: string): void {
  const existingKeys = getExistingMatchedKeys();
  if (!existingKeys.includes(key)) {
    existingKeys.push(key);
    core.saveState(State.CacheMatchedKeys, JSON.stringify(existingKeys));
  }
}
