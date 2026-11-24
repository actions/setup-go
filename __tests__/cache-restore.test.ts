import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import fs from 'fs';

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
import type {PackageManagerInfo} from '../src/package-managers.js';

describe('restoreCache', () => {
  let hashFilesSpy: jest.Mock<typeof glob.hashFiles>;
  let getCacheDirectoryPathSpy: jest.Mock<
    typeof cacheUtils.getCacheDirectoryPath
  >;
  let restoreCacheSpy: jest.Mock<typeof cache.restoreCache>;
  let infoSpy: jest.Mock<typeof core.info>;
  let setOutputSpy: jest.Mock<typeof core.setOutput>;

  const versionSpec = '1.13.1';
  const packageManager = 'default';
  const cacheDependencyPath = 'path';

  beforeEach(() => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      GITHUB_WORKSPACE: '/test/workspace'
    });
    //Arrange
    hashFilesSpy = glob.hashFiles as jest.Mock<typeof glob.hashFiles>;
    getCacheDirectoryPathSpy = cacheUtils.getCacheDirectoryPath as jest.Mock<
      typeof cacheUtils.getCacheDirectoryPath
    >;
    restoreCacheSpy = cache.restoreCache as jest.Mock<
      typeof cache.restoreCache
    >;
    infoSpy = core.info as jest.Mock<typeof core.info>;
    setOutputSpy = core.setOutput as jest.Mock<typeof core.setOutput>;

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
    jest.restoreAllMocks();
  });

  it.each([
    ['Linux', 'github-hosted', 'ubuntu22', 'ubuntu22-', false],
    ['Linux', 'github-hosted', '', 'ubuntu24-', true],
    ['Linux', 'github-hosted', undefined, 'ubuntu24-', true],
    ['Linux', 'self-hosted', undefined, 'undefined-', false],
    ['Windows', 'github-hosted', '', '', false],
    ['macOS', 'github-hosted', undefined, '', false]
  ])(
    'uses the expected cache key on %s (%s, ImageOS=%s)',
    async (platform, runnerEnvironment, imageOS, imageKey, readsRelease) => {
      process.env.RUNNER_OS = platform;
      process.env.RUNNER_ENVIRONMENT = runnerEnvironment;
      delete process.env.ImageOS;
      if (imageOS !== undefined) {
        process.env.ImageOS = imageOS;
      }

      const readRelease = jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValue('ID=ubuntu\nVERSION_ID="24.04"\n');
      hashFilesSpy.mockResolvedValue('file_hash');
      restoreCacheSpy.mockResolvedValue(undefined);

      await cacheRestore.restoreCache(
        versionSpec,
        packageManager,
        cacheDependencyPath
      );

      const key = `setup-go-${platform}-${process.arch}-${imageKey}go-${versionSpec}-file_hash`;
      expect(restoreCacheSpy).toHaveBeenCalledWith(
        ['cache_directory_path', 'cache_directory_path'],
        key
      );
      expect(core.saveState).toHaveBeenCalledWith('CACHE_KEY', key);
      expect(readRelease).toHaveBeenCalledTimes(readsRelease ? 1 : 0);
    }
  );

  it.each([
    ['ID=ubuntu\nVERSION_ID=26.04\n', 'ubuntu26-'],
    ['ID=debian\nID_LIKE=ubuntu\nVERSION_ID=24.04\n', '-'],
    ['ID=ubuntu\nVERSION_ID=invalid\n', '-'],
    [null, '-']
  ])('handles fallback os-release contents %j', async (release, imageKey) => {
    process.env.RUNNER_OS = 'Linux';
    process.env.RUNNER_ENVIRONMENT = 'github-hosted';
    process.env.ImageOS = '';
    const missing = Object.assign(new Error('File not found'), {
      code: 'ENOENT'
    });
    const readRelease = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(() => {
        if (release === null) {
          throw missing;
        }
        return release;
      });
    readRelease.mockImplementationOnce(() => {
      throw missing;
    });
    hashFilesSpy.mockResolvedValue('file_hash');
    restoreCacheSpy.mockResolvedValue(undefined);

    await cacheRestore.restoreCache(
      versionSpec,
      packageManager,
      cacheDependencyPath
    );

    expect(readRelease).toHaveBeenNthCalledWith(1, '/etc/os-release', 'utf8');
    expect(readRelease).toHaveBeenNthCalledWith(
      2,
      '/usr/lib/os-release',
      'utf8'
    );
    expect(core.saveState).toHaveBeenCalledWith(
      'CACHE_KEY',
      `setup-go-Linux-${process.arch}-${imageKey}go-${versionSpec}-file_hash`
    );
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
