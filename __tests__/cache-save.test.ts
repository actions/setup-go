/// <reference types="node" />

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

jest.unstable_mockModule('@actions/cache', () => ({
  saveCache: jest.fn(),
  restoreCache: jest.fn(),
  isFeatureAvailable: jest.fn()
}));

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getState: jest.fn(),
  saveState: jest.fn()
}));

const realFs = (await import('fs')).default;
const fsExports = {...realFs, existsSync: jest.fn()};
jest.unstable_mockModule('fs', () => ({...fsExports, default: fsExports}));

const cache = await import('@actions/cache');
const core = await import('@actions/core');
const fs = (await import('fs')).default;
const {run} = await import('../src/cache-save.js');
import type {CacheEntry} from '../src/cache-utils.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

describe('cache-save', () => {
  let entries: CacheEntry[];

  let getBooleanInputSpy: jest.Mock<typeof core.getBooleanInput>;
  let getStateSpy: jest.Mock<typeof core.getState>;
  let infoSpy: jest.Mock<typeof core.info>;
  let warningSpy: jest.Mock<typeof core.warning>;
  let debugSpy: jest.Mock<typeof core.debug>;
  let setFailedSpy: jest.Mock<typeof core.setFailed>;
  let saveCacheSpy: jest.Mock<typeof cache.saveCache>;
  let existsSpy: jest.Mock<typeof fs.existsSync>;

  beforeEach(() => {
    entries = [
      {
        kind: 'modules',
        path: 'module_cache_directory',
        primaryKey: 'modules-primary-key'
      },
      {
        kind: 'build',
        path: 'build_cache_directory',
        primaryKey: 'build-primary-key'
      }
    ];

    getBooleanInputSpy = core.getBooleanInput as jest.Mock<
      typeof core.getBooleanInput
    >;
    getBooleanInputSpy.mockReturnValue(true);

    getStateSpy = core.getState as jest.Mock<typeof core.getState>;
    getStateSpy.mockImplementation(() => JSON.stringify(entries));

    infoSpy = core.info as jest.Mock<typeof core.info>;
    infoSpy.mockImplementation(() => undefined);

    warningSpy = core.warning as jest.Mock<typeof core.warning>;
    warningSpy.mockImplementation(() => undefined);

    debugSpy = core.debug as jest.Mock<typeof core.debug>;
    debugSpy.mockImplementation(() => undefined);

    setFailedSpy = core.setFailed as jest.Mock<typeof core.setFailed>;
    setFailedSpy.mockImplementation(() => undefined);

    saveCacheSpy = cache.saveCache as jest.Mock<typeof cache.saveCache>;
    saveCacheSpy.mockImplementation(() => Promise.resolve(0));

    existsSpy = fs.existsSync as jest.Mock<typeof fs.existsSync>;
    existsSpy.mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('does not save cache when the cache input is false', async () => {
    getBooleanInputSpy.mockReturnValue(false);

    await run();

    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(warningSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'starts both saves concurrently and waits before exiting (first fails=%s)',
    async firstFails => {
      const started = [deferred(), deferred()];
      const release = [deferred(), deferred()];
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        return undefined as never;
      });
      saveCacheSpy.mockImplementation(async paths => {
        const index = paths[0] === entries[0].path ? 0 : 1;
        started[index].resolve();
        await release[index].promise;
        if (index === 0 && firstFails) {
          throw new Error('Module cache unavailable');
        }
        return 1;
      });

      const pending = run(true);
      try {
        await Promise.all(started.map(signal => signal.promise));
        release[0].resolve();
        // Let the first completion propagate while the second stays blocked.
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(exitSpy).not.toHaveBeenCalled();
      } finally {
        release.forEach(signal => signal.resolve());
        await pending;
      }

      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(infoSpy).toHaveBeenCalledWith(
        `Cache saved with the key: ${entries[1].primaryKey}`
      );
      expect(setFailedSpy).not.toHaveBeenCalled();
    }
  );

  it('does not save cache when there are no cache folders on the disk', async () => {
    existsSpy.mockImplementation(() => false);

    await run();

    for (const {kind, path} of entries) {
      expect(infoSpy).toHaveBeenCalledWith(
        `[warning]${kind} cache folder doesn't exist on disk: ${path}`
      );
    }
    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it.each(['modules', 'build'])(
    'saves the other cache when the %s directory is missing',
    async kind => {
      const missing = entries.find(entry => entry.kind === kind)!;
      const existing = entries.find(entry => entry.kind !== kind)!;
      existsSpy.mockImplementation(path => path !== missing.path);

      await run();

      expect(saveCacheSpy).toHaveBeenCalledTimes(1);
      expect(saveCacheSpy).toHaveBeenCalledWith(
        [existing.path],
        existing.primaryKey
      );
      expect(setFailedSpy).not.toHaveBeenCalled();
    }
  );

  it('does not save cache when no cache entries were prepared', async () => {
    getStateSpy.mockReturnValue('');

    await run();

    expect(infoSpy).toHaveBeenCalledWith(
      'Cache keys were not generated. Please check the log messages above for more errors or information'
    );
    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('does not fail the workflow if the saved state is invalid', async () => {
    getStateSpy.mockReturnValue('{');

    await run();

    expect(warningSpy).toHaveBeenCalledWith(expect.any(String));
    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('does not save either cache when both primary keys were hit', async () => {
    for (const entry of entries) {
      entry.matchedKey = entry.primaryKey;
    }

    await run();

    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(warningSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it.each(['modules', 'build'])(
    'skips only the %s cache when its primary key was hit',
    async kind => {
      const hit = entries.find(entry => entry.kind === kind)!;
      const miss = entries.find(entry => entry.kind !== kind)!;
      hit.matchedKey = hit.primaryKey;

      await run();

      expect(saveCacheSpy).toHaveBeenCalledTimes(1);
      expect(saveCacheSpy).toHaveBeenCalledWith([miss.path], miss.primaryKey);
      expect(warningSpy).not.toHaveBeenCalled();
      expect(setFailedSpy).not.toHaveBeenCalled();
    }
  );

  it('saves both cache directories under separate keys on a cold run', async () => {
    await run();

    expect(saveCacheSpy).toHaveBeenCalledTimes(2);
    for (const {path, primaryKey} of entries) {
      expect(saveCacheSpy).toHaveBeenCalledWith([path], primaryKey);
      expect(infoSpy).toHaveBeenCalledWith(
        `Cache saved with the key: ${primaryKey}`
      );
    }
    expect(warningSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('saves caches restored from non-primary matches', async () => {
    for (const entry of entries) {
      entry.matchedKey = `${entry.primaryKey}-other`;
    }

    await run();

    expect(saveCacheSpy).toHaveBeenCalledTimes(2);
    expect(warningSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it.each(['modules', 'build'])(
    'continues saving when the %s cache reservation fails',
    async kind => {
      const failed = entries.find(entry => entry.kind === kind)!;
      const saved = entries.find(entry => entry.kind !== kind)!;
      saveCacheSpy.mockImplementation(async paths =>
        paths[0] === failed.path ? -1 : 1
      );

      await run();

      expect(saveCacheSpy).toHaveBeenCalledTimes(2);
      expect(debugSpy).toHaveBeenCalledWith(
        `Cache was not saved for the key: ${failed.primaryKey}`
      );
      expect(infoSpy).not.toHaveBeenCalledWith(
        `Cache saved with the key: ${failed.primaryKey}`
      );
      expect(infoSpy).toHaveBeenCalledWith(
        `Cache saved with the key: ${saved.primaryKey}`
      );
      expect(warningSpy).not.toHaveBeenCalled();
      expect(setFailedSpy).not.toHaveBeenCalled();
    }
  );

  it.each(['modules', 'build'])(
    'continues saving when the %s cache upload throws',
    async kind => {
      const failed = entries.find(entry => entry.kind === kind)!;
      const saved = entries.find(entry => entry.kind !== kind)!;
      saveCacheSpy.mockImplementation(async paths => {
        if (paths[0] === failed.path) {
          throw new Error('Unable to reach the service');
        }
        return 1;
      });

      await run();

      expect(saveCacheSpy).toHaveBeenCalledTimes(2);
      expect(warningSpy).toHaveBeenCalledWith(
        `Save ${kind} cache failed: Unable to reach the service`
      );
      expect(infoSpy).toHaveBeenCalledWith(
        `Cache saved with the key: ${saved.primaryKey}`
      );
      expect(setFailedSpy).not.toHaveBeenCalled();
    }
  );
});
