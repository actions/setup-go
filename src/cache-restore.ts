import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';

import {Outputs, State} from './constants';
import {PackageManagerInfo} from './package-managers';
import {
  getCacheDirectoryPath,
  getCommandOutput,
  getPackageManagerInfo
} from './cache-utils';
import os from 'os';

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

export const setWindowsCacheDirectories = async () => {
  if (os.platform() !== 'win32') return;

  let goCache = await getCommandOutput(`go env GOCACHE`);
  core.info(`GOCACHE: ${goCache}`);
  goCache = goCache.replace('C:', 'D:').replace('c:', 'd:');

  if (!fs.existsSync(goCache)) {
    core.info(`${goCache} does not exist. Creating`);
    fs.mkdirSync(goCache, {recursive: true});
  }

  const setOutput = await getCommandOutput(`go env -w GOCACHE=${goCache}`);
  core.info(`go env -w GOCACHE output: ${setOutput}`);

  let goModCache = await getCommandOutput(`go env GOMODCACHE`);
  core.info(`GOMODCACHE: ${goModCache}`);
  goModCache = goModCache.replace('C:', 'D:').replace('c:', 'd:');

  if (!fs.existsSync(goModCache)) {
    core.info(`${goModCache} does not exist. Creating`);
    fs.mkdirSync(goModCache, {recursive: true});
  }

  const setModOutput = await getCommandOutput(
    `go env -w GOMODCACHE=${goModCache}`
  );
  core.info(`go env -w GOMODCACHE output: ${setModOutput}`);

  let goTmpDir = await getCommandOutput(`go env GOTMPDIR`);
  core.info(`GOTMPDIR: ${goTmpDir}`);
  if (!goTmpDir || goTmpDir === '') {
    goTmpDir = 'D:\\gotmp';
  }
  goTmpDir = goTmpDir.replace('C:', 'D:').replace('c:', 'd:');

  if (!fs.existsSync(goTmpDir)) {
    core.info(`${goTmpDir} does not exist. Creating`);
    fs.mkdirSync(goTmpDir, {recursive: true});
  }

  const setGoTmpOutput = await getCommandOutput(
    `go env -w GOTMPDIR=${goTmpDir}`
  );
  core.info(`go env -w GOTMPDIR output: ${setGoTmpOutput}`);
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
