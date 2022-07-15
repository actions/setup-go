import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';

import {State, Outputs} from './constants';
import {PackageManagerInfo} from './package-managers';
import {getCacheDirectoryPath, getPackageManagerInfo} from './cache-utils';

export const restoreCache = async (
  packageManager: string,
  cacheDependencyPath?: string
) => {
  const packageManagerInfo = await getPackageManagerInfo(packageManager);
  const platform = process.env.RUNNER_OS;
  const versionSpec = core.getInput('go-version');

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

  const primaryKey = `setup-go-${platform}-go-${versionSpec}-${fileHash}`;
  core.debug(`primary key is ${primaryKey}`);

  core.saveState(State.CachePrimaryKey, primaryKey);

  try {
    const cacheKey = await cache.restoreCache(cachePaths, primaryKey);
    core.setOutput(Outputs.CacheHit, Boolean(cacheKey));

    if (!cacheKey) {
      core.info(`Cache is not found`);
      return;
    }

    core.saveState(State.CacheMatchedKey, cacheKey);
    core.info(`Cache restored from key: ${cacheKey}`);
  } catch (error) {
    const typedError = error as Error;
    if (typedError.name === cache.ValidationError.name) {
      throw error;
    } else {
      core.warning(typedError.message);
      core.setOutput(Outputs.CacheHit, false);
    }
  }
};

const findDependencyFile = (packageManager: PackageManagerInfo) => {
  let dependencyFile = packageManager.dependencyFilePattern;
  const workspace = process.env.GITHUB_WORKSPACE!;
  const rootContent = fs.readdirSync(workspace);

  const goSumFileExists = rootContent.includes(dependencyFile);
  if (!goSumFileExists) {
    throw new Error(
      `Dependencies file is not found in ${workspace}. Supported file pattern: ${dependencyFile}`
    );
  }

  return path.join(workspace, dependencyFile);
};
