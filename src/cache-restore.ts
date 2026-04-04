import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';

import {State, Outputs} from './constants';
import {PackageManagerInfo} from './package-managers';
import {getCacheDirectoryPath, getPackageManagerInfo} from './cache-utils';
import {computeMetaHash} from './hashdir';

export const restoreCache = async (
  versionSpec: string,
  packageManager: string,
  cacheDependencyPath?: string
) => {
  const packageManagerInfo = await getPackageManagerInfo(packageManager);
  const platform = process.env.RUNNER_OS;
  const arch = process.arch;
  const cacheBuild = core.getBooleanInput('cache-build');

  const cachePaths = await getCacheDirectoryPath(
    packageManagerInfo,
    cacheBuild
  );

  const dependencyFilePath = cacheDependencyPath
    ? cacheDependencyPath
    : findDependencyFile(packageManagerInfo);
  const fileHash = await glob.hashFiles(dependencyFilePath);

  if (!fileHash) {
    throw new Error(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
  }

  let prefixKey = core.getInput('cache-key-prefix');
  if (prefixKey) {
    prefixKey += '-';
  }

  const linuxVersion =
    process.env.RUNNER_OS === 'Linux' ? `${process.env.ImageOS}-` : '';
  const baseKey = `setup-go-${platform}-${arch}-${linuxVersion}go-${versionSpec}`;
  const prefixBaseKey = `${prefixKey}${baseKey}`;
  core.saveState(State.CachePrefixBaseKey, prefixBaseKey);

  const primaryKey = `${prefixBaseKey}-${fileHash}`;
  core.debug(`primary key is ${primaryKey}`);

  core.saveState(State.CachePrimaryKey, primaryKey);

  const start = Date.now();
  const cacheKey = await cache.restoreCache(cachePaths, primaryKey, [
    prefixBaseKey,
    baseKey
  ]);
  core.info(`Time taken to restore cache: ${Date.now() - start}ms`);
  core.setOutput(Outputs.CacheHit, Boolean(cacheKey));

  if (!cacheKey) {
    core.info(`Cache is not found`);
    core.setOutput(Outputs.CacheHit, false);
    return;
  }

  core.saveState(State.CacheMatchedKey, cacheKey);
  core.info(`Cache restored from key: ${cacheKey}`);

  if (cachePaths.length > 1) {
    const buildHash = computeMetaHash([cachePaths[1]]);
    core.debug(`build hash is ${buildHash}`);
    core.saveState(State.CacheBuildHash, buildHash);
  }
};

const findDependencyFile = (packageManager: PackageManagerInfo) => {
  const dependencyFile = packageManager.dependencyFilePattern;
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
