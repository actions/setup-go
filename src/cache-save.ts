import * as core from '@actions/core';
import * as cache from '@actions/cache';
import fs from 'fs';
import {State} from './constants.js';
import type {CacheEntry} from './cache-utils.js';

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
  const entries: CacheEntry[] = JSON.parse(
    core.getState(State.CacheEntries) || '[]'
  );
  if (!entries.length) {
    core.info(
      'Cache keys were not generated. Please check the log messages above for more errors or information'
    );
    return;
  }

  await Promise.all(
    entries.map(async entry => {
      try {
        await saveCacheEntry(entry);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Save ${entry.kind} cache failed: ${message}`);
      }
    })
  );
};

const saveCacheEntry = async (entry: CacheEntry) => {
  const {kind, path, primaryKey, matchedKey} = entry;
  if (primaryKey === matchedKey) {
    core.info(
      `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    return;
  }

  if (!fs.existsSync(path)) {
    logWarning(`${kind} cache folder doesn't exist on disk: ${path}`);
    return;
  }

  const cacheId = await cache.saveCache([path], primaryKey);
  if (cacheId === -1) {
    // saveCache returns -1 without throwing when the cache was not saved, e.g.
    // a reserve collision or a read-only token (fork PR). @actions/cache has
    // already logged the reason at the appropriate severity, so just trace it.
    core.debug(`Cache was not saved for the key: ${primaryKey}`);
    return;
  }
  core.info(`Cache saved with the key: ${primaryKey}`);
};

function logWarning(message: string): void {
  const warningPrefix = '[warning]';
  core.info(`${warningPrefix}${message}`);
}

run(true);
