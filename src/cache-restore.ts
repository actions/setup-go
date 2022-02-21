import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';

import {State, Outputs} from './constants';
import {
  getCacheDirectoryPath,
  getPackageManagerInfo,
  PackageManagerInfo
} from './cache-utils';

export const restoreCache = async (
  packageManager: string, 
  cacheDependencyPath?: string 
) => {
  const packageManagerInfo = await getPackageManagerInfo();
  const platform = process.env.RUNNER_OS;

  const cachePath = await getCacheDirectoryPath(
    packageManagerInfo
  );
  
  const goSumFilePath = cacheDependencyPath
    ? cacheDependencyPath
    : findGoSumFile(packageManagerInfo);
  const fileHash = await glob.hashFiles(goSumFilePath);

  if (!fileHash) {
    throw new Error(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
  }

  const primaryKey = `go-cache-${platform}-${fileHash}`;
  core.debug(`primary key is ${primaryKey}`);

  core.saveState(State.CachePrimaryKey, primaryKey);

  const cacheKey = await cache.restoreCache([cachePath], primaryKey);
  core.setOutput('cache-hit', Boolean(cacheKey));

  if (!cacheKey) {
    core.info(`${packageManager} cache is not found`);
    return;
  }

  core.saveState(State.CacheMatchedKey, cacheKey);
  core.info(`Cache restored from key: ${cacheKey}`);
};

const findGoSumFile = (packageManager: PackageManagerInfo) => {
  let goSumFile = packageManager.goSumFilePattern;
  const workspace = process.env.GITHUB_WORKSPACE!;
  const rootContent = fs.readdirSync(workspace);

  const goSumFileExists = rootContent.includes(goSumFile);
  if (!goSumFileExists) {
    throw new Error(
      `Dependencies file  go.sum is not found in ${workspace}. Supported file pattern: ${goSumFile}`
    );
  }

  return path.join(workspace, goSumFile);
};
