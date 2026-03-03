import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import fs from 'fs';

import * as cacheRestore from '../src/cache-restore';
import * as cacheUtils from '../src/cache-utils';
import {PackageManagerInfo} from '../src/package-managers';
import {State} from '../src/constants';

describe('restoreCache', () => {
  let hashFilesSpy: jest.SpyInstance;
  let getCacheDirectoryPathSpy: jest.SpyInstance;
  let restoreCacheSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let setOutputSpy: jest.SpyInstance;
  let saveStateSpy: jest.SpyInstance;
  let getStateSpy: jest.SpyInstance;

  const versionSpec = '1.13.1';
  const packageManager = 'default';
  const cacheDependencyPath = 'path';

  let originalWorkspace: string | undefined;
  let stateStore: Record<string, string>;

  beforeEach(() => {
    originalWorkspace = process.env.GITHUB_WORKSPACE;
    process.env.GITHUB_WORKSPACE = '/test/workspace';
    stateStore = {};

    hashFilesSpy = jest.spyOn(glob, 'hashFiles');
    getCacheDirectoryPathSpy = jest.spyOn(cacheUtils, 'getCacheDirectoryPath');
    restoreCacheSpy = jest.spyOn(cache, 'restoreCache');
    infoSpy = jest.spyOn(core, 'info');
    setOutputSpy = jest.spyOn(core, 'setOutput');
    saveStateSpy = jest
      .spyOn(core, 'saveState')
      .mockImplementation((key, value) => {
        stateStore[key] = value as string;
      });
    getStateSpy = jest.spyOn(core, 'getState').mockImplementation(key => {
      return stateStore[key] || '';
    });

    getCacheDirectoryPathSpy.mockImplementation(
      (PackageManager: PackageManagerInfo) => {
        return Promise.resolve([
          'cache_directory_path',
          'cache_directory_path'
        ]);
      }
    );
  });

  afterEach(() => {
    process.env.GITHUB_WORKSPACE = originalWorkspace;
    jest.restoreAllMocks();
  });

  it('should throw if dependency file path is not valid', async () => {
    hashFilesSpy.mockImplementation(() => Promise.resolve(''));
    await expect(
      cacheRestore.restoreCache(
        versionSpec,
        packageManager,
        cacheDependencyPath
      )
    ).rejects.toThrow(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
  });

  it('should inform if cache hit is not occurred', async () => {
    hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
    restoreCacheSpy.mockImplementation(() => Promise.resolve(''));
    await cacheRestore.restoreCache(
      versionSpec,
      packageManager,
      cacheDependencyPath
    );
    expect(infoSpy).toHaveBeenCalledWith('Cache is not found');
  });

  it('should set output if cache hit is occurred', async () => {
    hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
    restoreCacheSpy.mockImplementation(() => Promise.resolve('cache_key'));
    await cacheRestore.restoreCache(
      versionSpec,
      packageManager,
      cacheDependencyPath
    );
    expect(setOutputSpy).toHaveBeenCalledWith('cache-hit', true);
  });

  it('should throw if dependency file is not found in workspace', async () => {
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['main.go'] as any);

    await expect(
      cacheRestore.restoreCache(versionSpec, packageManager)
    ).rejects.toThrow(
      'Dependencies file is not found in /test/workspace. Supported file pattern: go.mod'
    );
  });

  describe('multiple invocations', () => {
    it('should skip restore if same key was already processed', async () => {
      hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
      restoreCacheSpy.mockImplementation(() => Promise.resolve('cache_key'));

      // First invocation
      await cacheRestore.restoreCache(
        versionSpec,
        packageManager,
        cacheDependencyPath
      );
      expect(restoreCacheSpy).toHaveBeenCalledTimes(1);

      // Second invocation with same parameters should skip
      await cacheRestore.restoreCache(
        versionSpec,
        packageManager,
        cacheDependencyPath
      );

      // restoreCache should not be called again
      expect(restoreCacheSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('already processed in this job')
      );
    });

    it('should restore cache for different versions', async () => {
      hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
      restoreCacheSpy.mockImplementation(() => Promise.resolve('cache_key'));

      // First invocation with version 1.13.1
      await cacheRestore.restoreCache(
        '1.13.1',
        packageManager,
        cacheDependencyPath
      );
      expect(restoreCacheSpy).toHaveBeenCalledTimes(1);

      // Second invocation with different version
      await cacheRestore.restoreCache(
        '1.20.0',
        packageManager,
        cacheDependencyPath
      );

      // Both should call restoreCache
      expect(restoreCacheSpy).toHaveBeenCalledTimes(2);
    });

    it('should accumulate primary keys for multiple invocations', async () => {
      hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
      restoreCacheSpy.mockImplementation(() => Promise.resolve(''));

      await cacheRestore.restoreCache(
        '1.13.1',
        packageManager,
        cacheDependencyPath
      );
      await cacheRestore.restoreCache(
        '1.20.0',
        packageManager,
        cacheDependencyPath
      );

      // Check that CachePrimaryKeys state contains both keys
      const keysJson = stateStore[State.CachePrimaryKeys];
      expect(keysJson).toBeDefined();
      const keys = JSON.parse(keysJson);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toContain('go-1.13.1');
      expect(keys[1]).toContain('go-1.20.0');
    });

    it('should accumulate matched keys for cache hits', async () => {
      hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
      restoreCacheSpy
        .mockImplementationOnce(() => Promise.resolve('cache_key_1'))
        .mockImplementationOnce(() => Promise.resolve('cache_key_2'));

      await cacheRestore.restoreCache(
        '1.13.1',
        packageManager,
        cacheDependencyPath
      );
      await cacheRestore.restoreCache(
        '1.20.0',
        packageManager,
        cacheDependencyPath
      );

      // Check that CacheMatchedKeys state contains both matched keys
      const keysJson = stateStore[State.CacheMatchedKeys];
      expect(keysJson).toBeDefined();
      const keys = JSON.parse(keysJson);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('cache_key_1');
      expect(keys).toContain('cache_key_2');
    });

    it('should maintain backward compatibility with legacy state keys', async () => {
      hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
      restoreCacheSpy.mockImplementation(() => Promise.resolve('cache_key'));

      await cacheRestore.restoreCache(
        versionSpec,
        packageManager,
        cacheDependencyPath
      );

      // Legacy keys should still be set
      expect(stateStore[State.CachePrimaryKey]).toBeDefined();
      expect(stateStore[State.CacheMatchedKey]).toBe('cache_key');
    });
  });
});
