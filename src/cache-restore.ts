import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';

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

  const cachePaths = await getCacheDirectoryPath(packageManagerInfo);

  const dependencyFilePath = cacheDependencyPath
    ? cacheDependencyPath
    : await findDependencyFile(packageManagerInfo);
  const fileHash = await glob.hashFiles(dependencyFilePath);

  if (!fileHash) {
    throw new Error(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
  }

  const primaryKey = `setup-go-${platform}-go-${versionSpec}-${fileHash}`;
  core.debug(`primary key is ${primaryKey}`);

  core.saveState(State.CachePrimaryKey, primaryKey);

  const cacheKey = await cache.restoreCache(cachePaths, primaryKey);
  core.setOutput(Outputs.CacheHit, Boolean(cacheKey));

  if (!cacheKey) {
    core.info(`Cache is not found`);
    core.setOutput(Outputs.CacheHit, false);
    return;
  }

  core.saveState(State.CacheMatchedKey, cacheKey);
  core.info(`Cache restored from key: ${cacheKey}`);
};

const findDependencyFile = async (packageManager: PackageManagerInfo) => {
  let dependencyFile = packageManager.dependencyFilePattern;

  const patterns = [`**/${dependencyFile}`, dependencyFile];
  const globber = await glob.create(patterns.join('\n'));
  const files = await globber.glob();

  if (!files.length) {
    throw new Error(
      `Dependencies file is not found. Supported file pattern: ${dependencyFile}`
    );
  }

  return files[0];
};
