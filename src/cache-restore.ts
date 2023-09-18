import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';

import {State, Outputs} from './constants';
import {PackageManagerInfo} from './package-managers';
import {getBuildCachePath, getCacheDirectoryPath, getPackageManagerInfo} from './cache-utils';
import {getInput} from "@actions/core";

export const restoreModCache = async (
  versionSpec: string,
  packageManager: string,
  cacheDependencyPath?: string
) => {
  const packageManagerInfo = await getPackageManagerInfo(packageManager);
  const platform = process.env.RUNNER_OS;

  const cachePaths = await getCacheDirectoryPath(packageManagerInfo);

  const dependencyFilePath = cacheDependencyPath
    ? cacheDependencyPath
    : findDependencyFile(packageManagerInfo);
  const fileHash = await glob.hashFiles(dependencyFilePath);

  if (!fileHash) {
    throw new Error(
      'Some specified paths were not resolved, unable to cache modules.'
    );
  }

  const linuxVersion =
    process.env.RUNNER_OS === 'Linux' ? `${process.env.ImageOS}-` : '';
  const cacheIdInput = getInput('cache-id')
  const cacheId = cacheIdInput ? `${cacheIdInput}-` : ''
  const primaryKey = `setup-go-${platform}-${linuxVersion}go-${versionSpec}-${cacheId}${fileHash}`;
  core.debug(`Primary key for modules cache is ${primaryKey}`);

  core.saveState(State.CacheModPrimaryKey, primaryKey);

  const cacheKey = await cache.restoreCache(cachePaths, primaryKey);
  core.setOutput(Outputs.CacheModHit, Boolean(cacheKey));

  if (!cacheKey) {
    core.info(`Modules cache is not found`);
    core.setOutput(Outputs.CacheModHit, false);
    return;
  }

  core.saveState(State.CacheModMatchedKey, cacheKey);
  core.info(`Modules cache restored from key: ${cacheKey}`);
};

export const restoreBuildCache = async (
    versionSpec: string,
    cacheBuildPath: string
) => {
  const platform = process.env.RUNNER_OS;

  const cachePath = await getBuildCachePath()

  const fileHash = await glob.hashFiles(cacheBuildPath);

  if (!fileHash) {
    throw new Error(
        `The paths ${cacheBuildPath} were not resolved, unable to cache intermediate build files.`
    );
  }

  const linuxVersion =
      process.env.RUNNER_OS === 'Linux' ? `${process.env.ImageOS}-` : '';
  const cacheIdInput = getInput('cache-id')
  const cacheId = cacheIdInput ? `${cacheIdInput}-` : ''
  const keyPrefix = `setup-go-build-${platform}-${linuxVersion}go-${versionSpec}-${cacheId}`;
  const primaryKey = `${keyPrefix}-${fileHash}`;
  core.debug(`Primary key for intermediate build files cache is ${primaryKey}`);

  core.saveState(State.CacheBuildPrimaryKey, primaryKey);

  const cacheKey = await cache.restoreCache([cachePath], primaryKey, [keyPrefix]);
  core.setOutput(Outputs.CacheBuildHit, Boolean(cacheKey));

  if (!cacheKey) {
    core.info(`Cache is not found`);
    core.setOutput(Outputs.CacheBuildHit, false);
    return;
  }

  core.saveState(State.CacheBuildMatchedKey, cacheKey);
  core.info(`Cache restored from key: ${cacheKey}`);
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
