import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import path from 'path';
import fs from 'fs';
import {parseEnv} from 'node:util';

import {State, Outputs} from './constants.js';
import {PackageManagerInfo} from './package-managers.js';
import {getCacheDirectoryPath, getPackageManagerInfo} from './cache-utils.js';

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

  const linuxVersion = platform === 'Linux' ? `${getLinuxImageOS()}-` : '';
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

function getLinuxImageOS(): string | undefined {
  const imageOS = process.env.ImageOS;
  if (imageOS?.trim() || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') {
    return imageOS;
  }

  for (const file of ['/etc/os-release', '/usr/lib/os-release']) {
    try {
      const {ID, VERSION_ID} = parseEnv(fs.readFileSync(file, 'utf8'));
      const ubuntuMajor = VERSION_ID?.match(/^([0-9]+)\.[0-9]{2}$/)?.[1];
      return ID === 'ubuntu' && ubuntuMajor ? `ubuntu${ubuntuMajor}` : imageOS;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        break;
      }
    }
  }

  return imageOS;
}

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
