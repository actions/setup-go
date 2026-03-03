import * as core from '@actions/core';
import * as cache from '@actions/cache';
import fs from 'fs';
import {State} from './constants';
import {getCacheDirectoryPath, getPackageManagerInfo} from './cache-utils';

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on('uncaughtException', e => {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${e.message}`);
});

// Added early exit to resolve issue with slow post action step:
// - https://github.com/actions/setup-node/issues/878
// https://github.com/actions/cache/pull/1217

export async function run(earlyExit?: boolean) {
  try {
    const cacheInput = core.getBooleanInput('cache');
    if (cacheInput) {
      await cachePackages();

      if (earlyExit) {
        process.exit(0);
      }
    }
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
  const packageManager = 'default';
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

  // Get all primary keys and matched keys from multiple invocations
  const primaryKeys = getPrimaryKeys();
  const matchedKeys = getMatchedKeys();

  if (primaryKeys.length === 0) {
    // Fallback to legacy single-key behavior
    const primaryKey = core.getState(State.CachePrimaryKey);
    const matchedKey = core.getState(State.CacheMatchedKey);
    if (primaryKey) {
      await saveSingleCache(cachePaths, primaryKey, matchedKey);
    } else {
      core.info(
        'Primary key was not generated. Please check the log messages above for more errors or information'
      );
    }
    return;
  }

  // Process each primary key from multiple invocations
  let savedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < primaryKeys.length; i++) {
    const primaryKey = primaryKeys[i];
    const matchedKey = matchedKeys[i] || '';

    if (primaryKey === matchedKey) {
      core.info(
        `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
      );
      skippedCount++;
      continue;
    }

    try {
      const cacheId = await cache.saveCache(cachePaths, primaryKey);
      if (cacheId === -1) {
        core.info(`Cache save returned -1 for key: ${primaryKey}`);
        continue;
      }
      core.info(`Cache saved with the key: ${primaryKey}`);
      savedCount++;
    } catch (error) {
      // If save fails (e.g., cache already exists), log and continue
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Cache already exists')) {
        core.info(`Cache already exists for key: ${primaryKey}`);
        skippedCount++;
      } else {
        logWarning(
          `Failed to save cache for key ${primaryKey}: ${errorMessage}`
        );
      }
    }
  }

  if (savedCount > 0 || skippedCount > 0) {
    core.info(
      `Cache save complete. Saved: ${savedCount}, Skipped (already cached): ${skippedCount}`
    );
  }
};

async function saveSingleCache(
  cachePaths: string[],
  primaryKey: string,
  matchedKey: string
): Promise<void> {
  if (!primaryKey) {
    core.info(
      'Primary key was not generated. Please check the log messages above for more errors or information'
    );
    return;
  }

  if (primaryKey === matchedKey) {
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
}

function getPrimaryKeys(): string[] {
  try {
    const keysJson = core.getState(State.CachePrimaryKeys);
    if (!keysJson) return [];
    return JSON.parse(keysJson) as string[];
  } catch {
    return [];
  }
}

function getMatchedKeys(): string[] {
  try {
    const keysJson = core.getState(State.CacheMatchedKeys);
    if (!keysJson) return [];
    return JSON.parse(keysJson) as string[];
  } catch {
    return [];
  }
}

function logWarning(message: string): void {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${message}`);
}

run(true);
