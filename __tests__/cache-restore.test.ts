/// <reference types="node" />

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.unstable_mockModule('@actions/cache', () => ({
  saveCache: jest.fn(),
  restoreCache: jest.fn(),
  isFeatureAvailable: jest.fn()
}));

jest.unstable_mockModule('@actions/glob', () => ({
  create: jest.fn(),
  hashFiles: jest.fn()
}));

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getMultilineInput: jest.fn(),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  setSecret: jest.fn(),
  isDebug: jest.fn(() => false),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  group: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  toPlatformPath: jest.fn((p: string) => p),
  toWin32Path: jest.fn((p: string) => p),
  toPosixPath: jest.fn((p: string) => p)
}));

// Import real cache-utils (with mocked @actions) before mocking it
const realCacheUtils = await import('../src/cache-utils.js');

jest.unstable_mockModule('../src/cache-utils.js', () => ({
  ...realCacheUtils,
  getCacheDirectoryPath: jest.fn()
}));

const cache = await import('@actions/cache');
const core = await import('@actions/core');
const glob = await import('@actions/glob');
const cacheRestore = await import('../src/cache-restore.js');
const cacheUtils = await import('../src/cache-utils.js');
const {run: saveCaches} = await import('../src/cache-save.js');
import type {CacheDirectory} from '../src/cache-utils.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

describe('restoreCache', () => {
  const hashFilesSpy = glob.hashFiles as jest.Mock<typeof glob.hashFiles>;
  const getCacheDirectoryPathSpy =
    cacheUtils.getCacheDirectoryPath as jest.Mock<
      typeof cacheUtils.getCacheDirectoryPath
    >;
  const restoreCacheSpy = cache.restoreCache as jest.Mock<
    typeof cache.restoreCache
  >;
  const saveCacheSpy = cache.saveCache as jest.Mock<typeof cache.saveCache>;
  const infoSpy = core.info as jest.Mock<typeof core.info>;
  const setOutputSpy = core.setOutput as jest.Mock<typeof core.setOutput>;

  const versionSpec = '1.13.1';
  const packageManager = 'default';
  const cacheDependencyPath = 'path';
  const modulePath = 'module_cache_directory';
  const buildPath = 'build_cache_directory';
  const directories: CacheDirectory[] = [
    {kind: 'modules', path: modulePath},
    {kind: 'build', path: buildPath}
  ];
  const originalEnv = {...process.env};
  const originalArch = Object.getOwnPropertyDescriptor(process, 'arch')!;
  const originalPlatform = Object.getOwnPropertyDescriptor(
    process,
    'platform'
  )!;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      GITHUB_WORKSPACE: '/test/workspace',
      RUNNER_OS: 'Linux',
      ImageOS: 'ubuntu24'
    };
    Object.defineProperty(process, 'arch', {value: 'x64'});
    Object.defineProperty(process, 'platform', {value: 'linux'});
    hashFilesSpy.mockResolvedValue('file_hash');
    getCacheDirectoryPathSpy.mockResolvedValue(directories);
    restoreCacheSpy.mockResolvedValue(undefined);
    saveCacheSpy.mockResolvedValue(1);
  });

  afterEach(() => {
    process.env = {...originalEnv};
    Object.defineProperty(process, 'arch', originalArch);
    Object.defineProperty(process, 'platform', originalPlatform);
    jest.restoreAllMocks();
  });

  const restore = (version = versionSpec) =>
    cacheRestore.restoreCache(version, packageManager, cacheDependencyPath);

  const requestedKeys = () => {
    const moduleCall = restoreCacheSpy.mock.calls.find(
      ([paths]) => paths[0] === modulePath
    );
    const buildCall = restoreCacheSpy.mock.calls.find(
      ([paths]) => paths[0] === buildPath
    );
    expect(moduleCall).toBeDefined();
    expect(buildCall).toBeDefined();
    return {modules: moduleCall![1], build: buildCall![1]};
  };

  it('should throw if dependency file path is not valid', async () => {
    hashFilesSpy.mockResolvedValue('');

    await expect(restore()).rejects.toThrow(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
    expect(restoreCacheSpy).not.toHaveBeenCalled();
    expect(setOutputSpy).toHaveBeenLastCalledWith('cache-hit', false);
  });

  it('restores modules and build outputs as separate cache entries', async () => {
    await restore();

    const keys = requestedKeys();
    expect(keys.modules).not.toBe(keys.build);
    expect(restoreCacheSpy).toHaveBeenCalledTimes(2);
    expect(restoreCacheSpy).toHaveBeenCalledWith([modulePath], keys.modules);
    expect(restoreCacheSpy).toHaveBeenCalledWith([buildPath], keys.build);
    expect(infoSpy).toHaveBeenCalledWith('modules cache is not found');
    expect(infoSpy).toHaveBeenCalledWith('build cache is not found');
  });

  it.each([
    {platform: 'linux', firstFails: false},
    {platform: 'linux', firstFails: true},
    {platform: 'win32', firstFails: false},
    {platform: 'win32', firstFails: true}
  ])(
    'starts both restores concurrently on $platform and waits for both (first fails=$firstFails)',
    async ({platform, firstFails}) => {
      Object.defineProperty(process, 'platform', {value: platform});
      const started = [deferred(), deferred()];
      const release = [deferred(), deferred()];
      let completed = false;
      restoreCacheSpy.mockImplementation(async (paths, key) => {
        const index = paths[0] === modulePath ? 0 : 1;
        started[index].resolve();
        await release[index].promise;
        if (index === 0 && firstFails) {
          throw new Error('Module cache unavailable');
        }
        return key;
      });

      const pending = restore().then(() => {
        completed = true;
      });
      try {
        await Promise.all(started.map(signal => signal.promise));
        release[0].resolve();
        // Let the first completion propagate while the second stays blocked.
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(completed).toBe(false);
        expect(core.saveState).not.toHaveBeenCalled();
        expect(setOutputSpy).not.toHaveBeenCalledWith('cache-hit', true);
      } finally {
        release.forEach(signal => signal.resolve());
        await pending;
      }

      expect(setOutputSpy).toHaveBeenLastCalledWith('cache-hit', !firstFails);
      expect(core.saveState).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['linux', 'win32'])(
    'restores overlapping directories sequentially on %s',
    async platform => {
      Object.defineProperty(process, 'platform', {value: platform});
      getCacheDirectoryPathSpy.mockResolvedValue([
        directories[0],
        {kind: 'build', path: path.join(modulePath, 'build')}
      ]);
      const firstStarted = deferred();
      const releaseFirst = deferred();
      restoreCacheSpy.mockImplementation(async (paths, key) => {
        if (paths[0] === modulePath) {
          firstStarted.resolve();
          await releaseFirst.promise;
        }
        return key;
      });

      const pending = restore();
      try {
        await firstStarted.promise;
        expect(restoreCacheSpy).toHaveBeenCalledTimes(1);
      } finally {
        releaseFirst.resolve();
        await pending;
      }

      expect(restoreCacheSpy).toHaveBeenCalledTimes(2);
      expect(setOutputSpy).toHaveBeenLastCalledWith('cache-hit', true);
    }
  );

  it.each([
    {modules: false, build: false},
    {modules: true, build: false},
    {modules: false, build: true},
    {modules: true, build: true}
  ])(
    'reports hits and saves misses independently (modules=$modules, build=$build)',
    async hits => {
      const state = new Map<string, string>();
      (core.saveState as jest.Mock<typeof core.saveState>).mockImplementation(
        (name, value) => {
          state.set(name, JSON.stringify(value));
        }
      );
      (core.getState as jest.Mock<typeof core.getState>).mockImplementation(
        name => state.get(name) || ''
      );
      (
        core.getBooleanInput as jest.Mock<typeof core.getBooleanInput>
      ).mockReturnValue(true);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      restoreCacheSpy.mockImplementation(async (paths, key) =>
        hits[paths[0] === modulePath ? 'modules' : 'build'] ? key : undefined
      );

      await restore();
      const keys = requestedKeys();
      expect(setOutputSpy).toHaveBeenLastCalledWith(
        'cache-hit',
        hits.modules && hits.build
      );

      // Changing the Go environment later must not change the saved paths.
      process.env.GOMODCACHE = 'different_module_cache';
      process.env.GOCACHE = 'different_build_cache';
      await saveCaches();

      for (const {kind, path} of directories) {
        if (hits[kind]) {
          expect(saveCacheSpy).not.toHaveBeenCalledWith([path], keys[kind]);
        } else {
          expect(saveCacheSpy).toHaveBeenCalledWith([path], keys[kind]);
        }
      }
      expect(saveCacheSpy).toHaveBeenCalledTimes(
        Number(!hits.modules) + Number(!hits.build)
      );
    }
  );

  it('does not report a full hit for a non-primary cache match', async () => {
    restoreCacheSpy.mockImplementation(async (_paths, key) => `${key}-other`);

    await restore();

    expect(setOutputSpy).toHaveBeenLastCalledWith('cache-hit', false);
  });

  it.each(directories)(
    'continues restoring when the $kind cache fails',
    async ({kind, path}) => {
      restoreCacheSpy.mockImplementation(async (paths, key) => {
        if (paths[0] === path) {
          throw new Error('Unable to reach the service');
        }
        return key;
      });

      await restore();

      expect(restoreCacheSpy).toHaveBeenCalledTimes(2);
      expect(core.warning).toHaveBeenCalledWith(
        `Restore ${kind} cache failed: Unable to reach the service`
      );
      expect(setOutputSpy).toHaveBeenLastCalledWith('cache-hit', false);
    }
  );

  it.each(directories)(
    'restores only $kind when the other directory cannot be resolved',
    async directory => {
      getCacheDirectoryPathSpy.mockResolvedValue([directory]);
      restoreCacheSpy.mockImplementation(async (_paths, key) => key);

      await restore();

      expect(restoreCacheSpy).toHaveBeenCalledTimes(1);
      expect(restoreCacheSpy).toHaveBeenCalledWith(
        [directory.path],
        expect.any(String)
      );
      expect(setOutputSpy).toHaveBeenLastCalledWith('cache-hit', false);
    }
  );

  it('reuses modules across Go versions without reusing build outputs', async () => {
    await restore();
    const before = requestedKeys();
    restoreCacheSpy.mockClear();

    await restore('1.26.1');
    const after = requestedKeys();

    expect(after.modules).toBe(before.modules);
    expect(after.build).not.toBe(before.build);
  });

  it.each([
    {
      name: 'runner architecture',
      change: () => Object.defineProperty(process, 'arch', {value: 'arm64'})
    },
    {
      name: 'runner image',
      change: () => {
        process.env.ImageOS = 'ubuntu26';
      }
    }
  ])('reuses only modules when the $name changes', async ({change}) => {
    await restore();
    const before = requestedKeys();
    restoreCacheSpy.mockClear();

    change();
    await restore();
    const after = requestedKeys();

    expect(after.modules).toBe(before.modules);
    expect(after.build).not.toBe(before.build);
  });

  it('keeps both cache entries isolated by runner OS', async () => {
    await restore();
    const before = requestedKeys();
    restoreCacheSpy.mockClear();

    process.env.RUNNER_OS = 'Windows';
    await restore();
    const after = requestedKeys();

    expect(after.modules).not.toBe(before.modules);
    expect(after.build).not.toBe(before.build);
  });

  it('invalidates both cache entries when the dependency hash changes', async () => {
    await restore();
    const before = requestedKeys();
    restoreCacheSpy.mockClear();

    hashFilesSpy.mockResolvedValue('different_file_hash');
    await restore();
    const after = requestedKeys();

    expect(after.modules).not.toBe(before.modules);
    expect(after.build).not.toBe(before.build);
  });

  it('hashes the configured dependency paths for both cache entries', async () => {
    const dependencyPaths = 'go.sum\ntools/go.sum';

    await cacheRestore.restoreCache(
      versionSpec,
      packageManager,
      dependencyPaths
    );

    expect(hashFilesSpy).toHaveBeenCalledWith(dependencyPaths);
    expect(restoreCacheSpy).toHaveBeenCalledTimes(2);
  });

  it('should throw if dependency file is not found in workspace', async () => {
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['main.go'] as any);

    await expect(
      cacheRestore.restoreCache(
        versionSpec,
        packageManager
        // No cacheDependencyPath
      )
    ).rejects.toThrow(
      'Dependencies file is not found in /test/workspace. Supported file pattern: go.mod'
    );
  });
});
