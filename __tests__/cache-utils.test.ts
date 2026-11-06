import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll
} from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.unstable_mockModule('@actions/exec', () => ({
  exec: jest.fn(),
  getExecOutput: jest.fn()
}));

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

const exec = await import('@actions/exec');
const cache = await import('@actions/cache');
const core = await import('@actions/core');
const cacheUtils = await import('../src/cache-utils.js');
import type {PackageManagerInfo} from '../src/package-managers.js';

describe('getCommandOutput', () => {
  //Arrange
  const getExecOutputSpy = exec.getExecOutput as jest.Mock<
    typeof exec.getExecOutput
  >;

  it('should return trimmed stdout in case of successful exit code', async () => {
    //Arrange
    const stdoutResult = ' stdout ';
    const trimmedStdout = stdoutResult.trim();

    getExecOutputSpy.mockImplementation(async (commandLine: string) => {
      return {exitCode: 0, stdout: stdoutResult, stderr: ''};
    });

    //Act + Assert
    return cacheUtils
      .getCommandOutput('command')
      .then(data => expect(data).toBe(trimmedStdout));
  });

  it('should return error in case of unsuccessful exit code', async () => {
    //Arrange
    const stderrResult = 'error message';

    getExecOutputSpy.mockImplementation(async (commandLine: string) => {
      return {exitCode: 10, stdout: '', stderr: stderrResult};
    });

    //Act + Assert
    await expect(async () => {
      await cacheUtils.getCommandOutput('command');
    }).rejects.toThrow();
  });
});

describe('getPackageManagerInfo', () => {
  it('should return package manager info in case of valid package manager name', async () => {
    //Arrange
    const packageManagerName = 'default';
    const expectedResult = {
      dependencyFilePattern: 'go.mod',
      cacheFolderCommandList: [
        {kind: 'modules', command: 'go env GOMODCACHE'},
        {kind: 'build', command: 'go env GOCACHE'}
      ]
    };

    //Act + Assert
    return cacheUtils
      .getPackageManagerInfo(packageManagerName)
      .then(data => expect(data).toEqual(expectedResult));
  });

  it('should throw the error in case of invalid package manager name', async () => {
    //Arrange
    const packageManagerName = 'invalidName';

    //Act + Assert
    await expect(async () => {
      await cacheUtils.getPackageManagerInfo(packageManagerName);
    }).rejects.toThrow();
  });
});

describe('getCacheDirectoryPath', () => {
  //Arrange
  const getExecOutputSpy = exec.getExecOutput as jest.Mock<
    typeof exec.getExecOutput
  >;

  const validPackageManager: PackageManagerInfo = {
    dependencyFilePattern: 'go.mod',
    cacheFolderCommandList: [
      {kind: 'modules', command: 'go env GOMODCACHE'},
      {kind: 'build', command: 'go env GOCACHE'}
    ]
  };

  it('should return path to the cache folders which specified package manager uses', async () => {
    //Arrange
    getExecOutputSpy.mockImplementation(async (commandLine: string) => {
      return {
        exitCode: 0,
        stdout:
          commandLine === 'go env GOMODCACHE'
            ? 'path/to/modules'
            : 'path/to/build',
        stderr: ''
      };
    });

    const expectedResult = [
      {kind: 'modules', path: 'path/to/modules'},
      {kind: 'build', path: 'path/to/build'}
    ];

    //Act + Assert
    return cacheUtils
      .getCacheDirectoryPath(validPackageManager)
      .then(data => expect(data).toEqual(expectedResult));
  });

  it.each(validPackageManager.cacheFolderCommandList)(
    'preserves the $kind identity when the other command returns an empty path',
    async ({kind, command}) => {
      getExecOutputSpy.mockImplementation(async commandLine => ({
        exitCode: 0,
        stdout: commandLine === command ? 'path/to/cache/folder' : '',
        stderr: ''
      }));

      await expect(
        cacheUtils.getCacheDirectoryPath(validPackageManager)
      ).resolves.toEqual([{kind, path: 'path/to/cache/folder'}]);
    }
  );

  it.each(validPackageManager.cacheFolderCommandList)(
    'preserves the $kind identity when the other command fails',
    async ({kind, command}) => {
      getExecOutputSpy.mockImplementation(async commandLine => {
        if (commandLine !== command) {
          throw new Error('Could not run go env');
        }
        return {exitCode: 0, stdout: 'path/to/cache/folder', stderr: ''};
      });

      await expect(
        cacheUtils.getCacheDirectoryPath(validPackageManager)
      ).resolves.toEqual([{kind, path: 'path/to/cache/folder'}]);
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Could not run go env')
      );
    }
  );

  it('should throw if the both commands return empty str', async () => {
    getExecOutputSpy.mockImplementation(async (commandLine: string) => {
      return {exitCode: 0, stdout: '', stderr: ''};
    });

    //Act + Assert
    await expect(async () => {
      await cacheUtils.getCacheDirectoryPath(validPackageManager);
    }).rejects.toThrow();
  });

  it('should throw if both commands fail', async () => {
    getExecOutputSpy.mockImplementation(async (commandLine: string) => {
      return {exitCode: 10, stdout: '', stderr: 'Error message'};
    });

    //Act + Assert
    await expect(async () => {
      await cacheUtils.getCacheDirectoryPath(validPackageManager);
    }).rejects.toThrow();
  });
});

describe('canRestoreCachesInParallel', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(
    process,
    'platform'
  )!;
  const directoryStat = fs.lstatSync(process.cwd());

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {value: 'linux'});
    jest.spyOn(fs, 'lstatSync').mockReturnValue(directoryStat);
    jest
      .spyOn(fs, 'realpathSync')
      .mockImplementation(directory => path.resolve(directory.toString()));
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
    jest.restoreAllMocks();
  });

  it.each([
    {modules: 'cache/modules', build: 'cache/build', parallel: true},
    {modules: 'cache', build: 'cache-build', parallel: true},
    {modules: 'cache', build: 'cache', parallel: false},
    {modules: 'cache', build: 'cache/build', parallel: false},
    {modules: 'cache/modules', build: 'cache', parallel: false},
    {modules: 'cache', build: 'cache/../cache', parallel: false}
  ])(
    'checks overlapping paths: $modules and $build',
    ({modules, build, parallel}) => {
      expect(
        cacheUtils.canRestoreCachesInParallel([
          {kind: 'modules', path: modules},
          {kind: 'build', path: build}
        ])
      ).toBe(parallel);
    }
  );

  it('allows concurrent Windows restores with disjoint paths', () => {
    Object.defineProperty(process, 'platform', {value: 'win32'});

    expect(
      cacheUtils.canRestoreCachesInParallel([
        {kind: 'modules', path: 'cache/modules'},
        {kind: 'build', path: 'cache/build'}
      ])
    ).toBe(true);
  });

  it.each(['darwin', 'win32'])(
    'handles case-insensitive paths conservatively on %s',
    platform => {
      Object.defineProperty(process, 'platform', {value: platform});

      expect(
        cacheUtils.canRestoreCachesInParallel([
          {kind: 'modules', path: 'cache'},
          {kind: 'build', path: 'CACHE/build'}
        ])
      ).toBe(false);
    }
  );

  it.each([true, false])(
    'serializes symlink aliases with missing cache directories (overlap=%s)',
    overlap => {
      const alias = path.resolve('alias');
      const target = path.resolve('target');
      jest.spyOn(fs, 'lstatSync').mockImplementation(directory => {
        if (directory !== alias && directory !== target) {
          throw Object.assign(new Error('Missing path'), {code: 'ENOENT'});
        }
        return directoryStat;
      });
      jest.spyOn(fs, 'realpathSync').mockReturnValue(target);

      expect(
        cacheUtils.canRestoreCachesInParallel([
          {kind: 'modules', path: path.join(alias, 'modules')},
          {
            kind: 'build',
            path: path.join(target, overlap ? 'modules/build' : 'build')
          }
        ])
      ).toBe(false);
    }
  );

  it.each(['nested alias', 'alias through module cache'])(
    'serializes restores when the %s resolves outside the module cache',
    scenario => {
      const modules = path.resolve('modules');
      const target = path.resolve('external-build');
      const alias = path.join(modules, 'build-link');
      const build =
        scenario === 'nested alias'
          ? path.join(alias, 'cache')
          : path.resolve('build-alias', 'cache');
      jest.spyOn(fs, 'realpathSync').mockImplementation(directory => {
        const absolute = path.resolve(directory.toString());
        if (absolute === build) {
          return path.join(target, 'cache');
        }
        if (absolute === path.dirname(build)) {
          return scenario === 'nested alias' ? target : alias;
        }
        return absolute;
      });

      expect(
        cacheUtils.canRestoreCachesInParallel([
          {kind: 'modules', path: modules},
          {kind: 'build', path: build}
        ])
      ).toBe(false);
    }
  );

  it('falls back to sequential restores when path resolution fails', () => {
    jest.spyOn(fs, 'realpathSync').mockImplementation(() => {
      throw new Error('Cannot resolve path');
    });

    expect(
      cacheUtils.canRestoreCachesInParallel([
        {kind: 'modules', path: 'cache/modules'},
        {kind: 'build', path: 'cache/build'}
      ])
    ).toBe(false);
  });
});

describe('isCacheFeatureAvailable', () => {
  //Arrange
  const isFeatureAvailableSpy = cache.isFeatureAvailable as jest.Mock<
    typeof cache.isFeatureAvailable
  >;
  const warningSpy = core.warning as jest.Mock<typeof core.warning>;

  it('should return true when cache feature is available', () => {
    //Arrange
    isFeatureAvailableSpy.mockImplementation(() => {
      return true;
    });

    //Act
    const functionResult = cacheUtils.isCacheFeatureAvailable();

    //Assert
    expect(functionResult).toBeTruthy();
  });

  it('should warn when cache feature is unavailable and GHES is not used', () => {
    //Arrange
    isFeatureAvailableSpy.mockImplementation(() => {
      return false;
    });

    process.env['GITHUB_SERVER_URL'] = 'https://github.com';

    const warningMessage =
      'The runner was not able to contact the cache service. Caching will be skipped';

    //Act
    cacheUtils.isCacheFeatureAvailable();

    //Assert
    expect(warningSpy).toHaveBeenCalledWith(warningMessage);
  });

  it('should return false when cache feature is unavailable', () => {
    //Arrange
    isFeatureAvailableSpy.mockImplementation(() => {
      return false;
    });

    process.env['GITHUB_SERVER_URL'] = 'https://github.com';

    //Act
    const functionResult = cacheUtils.isCacheFeatureAvailable();

    //Assert
    expect(functionResult).toBeFalsy();
  });

  it('should warn when cache feature is unavailable and GHES is used', () => {
    //Arrange
    isFeatureAvailableSpy.mockImplementation(() => {
      return false;
    });

    process.env['GITHUB_SERVER_URL'] = 'https://nongithub.com';

    const warningMessage =
      'Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.';

    //Act + Assert
    expect(cacheUtils.isCacheFeatureAvailable()).toBeFalsy();
    expect(warningSpy).toHaveBeenCalledWith(warningMessage);
  });
});

describe('isGhes', () => {
  const pristineEnv = {...process.env};

  beforeEach(() => {
    process.env = {...pristineEnv};
  });

  afterAll(() => {
    process.env = pristineEnv;
  });

  it('returns false when the GITHUB_SERVER_URL environment variable is not defined', async () => {
    delete process.env['GITHUB_SERVER_URL'];
    expect(cacheUtils.isGhes()).toBeFalsy();
  });

  it('returns false when the GITHUB_SERVER_URL environment variable is set to github.com', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com';
    expect(cacheUtils.isGhes()).toBeFalsy();
  });

  it('returns false when the GITHUB_SERVER_URL environment variable is set to a GitHub Enterprise Cloud-style URL', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://contoso.ghe.com';
    expect(cacheUtils.isGhes()).toBeFalsy();
  });

  it('returns false when the GITHUB_SERVER_URL environment variable has a .localhost suffix', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://mock-github.localhost';
    expect(cacheUtils.isGhes()).toBeFalsy();
  });

  it('returns true when the GITHUB_SERVER_URL environment variable is set to some other URL', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://src.onpremise.fabrikam.com';
    expect(cacheUtils.isGhes()).toBeTruthy();
  });
});
