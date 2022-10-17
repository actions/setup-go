import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';

import * as cacheRestore from '../src/cache-restore';
import * as cacheUtils from '../src/cache-utils';
import {PackageManagerInfo} from '../src/package-managers';

describe('restoreCache', () => {
  //Arrange
  let hashFilesSpy = jest.spyOn(glob, 'hashFiles');
  let getCacheDirectoryPathSpy = jest.spyOn(
    cacheUtils,
    'getCacheDirectoryPath'
  );
  let restoreCacheSpy = jest.spyOn(cache, 'restoreCache');
  let infoSpy = jest.spyOn(core, 'info');
  let setOutputSpy = jest.spyOn(core, 'setOutput');

  const versionSpec = '1.13.1';
  const packageManager = 'default';
  const cacheDependencyPath = 'path';

  beforeEach(() => {
    getCacheDirectoryPathSpy.mockImplementation(
      (PackageManager: PackageManagerInfo) => {
        return new Promise<string[]>(resolve => {
          resolve(['cache_directory_path', 'cache_directory_path']);
        });
      }
    );
  });

  it('should throw if dependency file path is not valid', async () => {
    //Arrange
    hashFilesSpy.mockImplementation((somePath: string) => {
      return new Promise<string>(resolve => {
        resolve('');
      });
    });

    //Act + Assert
    expect(async () => {
      await cacheRestore.restoreCache(
        versionSpec,
        packageManager,
        cacheDependencyPath
      );
    }).rejects.toThrowError(
      'Some specified paths were not resolved, unable to cache dependencies.'
    );
  });

  it('should inform if cache hit is not occured', async () => {
    //Arrange
    hashFilesSpy.mockImplementation((somePath: string) => {
      return new Promise<string>(resolve => {
        resolve('file_hash');
      });
    });

    restoreCacheSpy.mockImplementation(() => {
      return new Promise<string>(resolve => {
        resolve('');
      });
    });

    //Act + Assert
    await cacheRestore.restoreCache(
      versionSpec,
      packageManager,
      cacheDependencyPath
    );
    expect(infoSpy).toBeCalledWith(`Cache is not found`);
  });

  it('should set output if cache hit is occured', async () => {
    //Arrange
    hashFilesSpy.mockImplementation((somePath: string) => {
      return new Promise<string>(resolve => {
        resolve('file_hash');
      });
    });

    restoreCacheSpy.mockImplementation(() => {
      return new Promise<string>(resolve => {
        resolve('cache_key');
      });
    });

    //Act + Assert
    await cacheRestore.restoreCache(
      versionSpec,
      packageManager,
      cacheDependencyPath
    );
    expect(setOutputSpy).toBeCalledWith('cache-hit', true);
  });
});
