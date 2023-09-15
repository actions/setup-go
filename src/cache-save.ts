import * as core from '@actions/core';
import * as cache from '@actions/cache';
import fs from 'fs';
import {State} from './constants';
import {
  getBuildCachePath,
  getCacheDirectoryPath,
  getPackageManagerInfo,
  needBuildCache,
  needModCache
} from './cache-utils';

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${e.message}`);
});

export async function run() {
  if (core.getInput('cache-lookup-only').toLowerCase() === 'true')
    return;
  try {
    await cachePackages();
    await cacheBuild();
  } catch (error) {
    let message = 'Unknown error!';
    if (error instanceof Error) {
      message = error.message;
    }
    if (typeof error === 'string') {
      message = error;
    }
    core.warning(message);
  }
}

const cachePackages = async () => {
  const needCache = needModCache()
  if (!needCache) {
    return;
  }

  const packageManager = 'default';

  const state = core.getState(State.CacheModMatchedKey);
  const primaryKey = core.getState(State.CacheModPrimaryKey);

  const packageManagerInfo = await getPackageManagerInfo(packageManager);

  const cachePaths = await getCacheDirectoryPath(packageManagerInfo);

  const nonExistingPaths = cachePaths.filter(
    cachePath => !fs.existsSync(cachePath)
  );

  if (nonExistingPaths.length === cachePaths.length) {
    core.warning('There are no cache folders on the disk');
    return;
  }

  if (nonExistingPaths.length) {
    logWarning(
      `Cache folder path is retrieved but doesn't exist on disk: ${nonExistingPaths.join(
        ', '
      )}`
    );
  }

  if (!primaryKey) {
    core.info(
      'Primary key was not generated. Please check the log messages above for more errors or information'
    );
    return;
  }

  if (primaryKey === state) {
    core.info(
      `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    return;
  }

  const cacheId = await cache.saveCache(cachePaths, primaryKey);
  if (cacheId === -1) {
    return;
  }
  core.info(`Cache saved with the key: ${primaryKey}`);
};

const cacheBuild = async () => {
  const needCache = needBuildCache()
  if (!needCache) {
    return;
  }

  const state = core.getState(State.CacheBuildMatchedKey);
  const primaryKey = core.getState(State.CacheBuildPrimaryKey);

  const cachePath = await getBuildCachePath()

  if (!fs.existsSync(cachePath)) {
    core.warning('There are no intermediate build files cache folders on the disk');
    return;
  }

  if (!fs.existsSync(cachePath)) {
    logWarning( `Cache folder path is retrieved but doesn't exist on disk: ${cachePath}` );
    return;
  }

  if (!primaryKey) {
    core.info(
        'Primary key for intermediate build files cache was not generated. Please check the log messages above for more errors or information'
    );
    return;
  }

  if (primaryKey === state) {
    core.info(
        `Cache hit occurred on the primary key ${primaryKey} for intermediate build files cache, not saving cache.`
    );
    return;
  }

  const cacheId = await cache.saveCache([cachePath], primaryKey);
  if (cacheId === -1) {
    return;
  }
  core.info(`Cache saved with the key: ${primaryKey}`);
};

function logWarning(message: string): void {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${message}`);
}

run();
