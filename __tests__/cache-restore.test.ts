import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import fs from 'fs';

import * as cacheRestore from '../src/cache-restore';
import * as cacheUtils from '../src/cache-utils';
import {PackageManagerInfo} from '../src/package-managers';

describe('restoreCache', () => {
  let hashFilesSpy: jest.SpyInstance;
  let getCacheDirectoryPathSpy: jest.SpyInstance;
  let restoreCacheSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let setOutputSpy: jest.SpyInstance;

  const versionSpec = '1.13.1';
  const packageManager = 'default';
  const cacheDependencyPath = 'path';

  let originalWorkspace: string | undefined;

  beforeEach(() => {
    originalWorkspace = process.env.GITHUB_WORKSPACE;
    process.env.GITHUB_WORKSPACE = '/test/workspace';
    //Arrange
    hashFilesSpy = jest.spyOn(glob, 'hashFiles');
    getCacheDirectoryPathSpy = jest.spyOn(cacheUtils, 'getCacheDirectoryPath');
    restoreCacheSpy = jest.spyOn(cache, 'restoreCache');
    infoSpy = jest.spyOn(core, 'info');
    setOutputSpy = jest.spyOn(core, 'setOutput');

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
    // Arrange
    hashFilesSpy.mockImplementation(() => Promise.resolve(''));
    // Act + Assert
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
    // Arrange
    hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
    restoreCacheSpy.mockImplementation(() => Promise.resolve(''));
    // Act + Assert
    await cacheRestore.restoreCache(
      versionSpec,
      packageManager,
      cacheDependencyPath
    );
    expect(infoSpy).toHaveBeenCalledWith('Cache is not found');
  });

  it('should set output if cache hit is occurred', async () => {
    // Arrange
    hashFilesSpy.mockImplementation(() => Promise.resolve('file_hash'));
    restoreCacheSpy.mockImplementation(() => Promise.resolve('cache_key'));
    // Act + Assert
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
