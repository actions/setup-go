import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as cacheUtils from '../src/cache-utils';
import {PackageManagerInfo} from '../src/package-managers';
import fs, {ObjectEncodingOptions, PathLike} from 'fs';
import {getToolchainDirectoriesFromCachedDirectories} from '../src/cache-utils';

describe('getCommandOutput', () => {
  //Arrange
  const getExecOutputSpy = jest.spyOn(exec, 'getExecOutput');

  it('should return trimmed stdout in case of successful exit code', async () => {
    //Arrange
    const stdoutResult = ' stdout ';
    const trimmedStdout = stdoutResult.trim();

    getExecOutputSpy.mockImplementation((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 0, stdout: stdoutResult, stderr: ''});
      });
    });

    //Act + Assert
    return cacheUtils
      .getCommandOutput('command')
      .then(data => expect(data).toBe(trimmedStdout));
  });

  it('should return error in case of unsuccessful exit code', async () => {
    //Arrange
    const stderrResult = 'error message';

    getExecOutputSpy.mockImplementation((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 10, stdout: '', stderr: stderrResult});
      });
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
      dependencyFilePattern: 'go.sum',
      cacheFolderCommandList: ['go env GOMODCACHE', 'go env GOCACHE']
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
  const getExecOutputSpy = jest.spyOn(exec, 'getExecOutput');

  const validPackageManager: PackageManagerInfo = {
    dependencyFilePattern: 'go.sum',
    cacheFolderCommandList: ['go env GOMODCACHE', 'go env GOCACHE']
  };

  it('should return path to the cache folders which specified package manager uses', async () => {
    //Arrange
    getExecOutputSpy.mockImplementation((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 0, stdout: 'path/to/cache/folder', stderr: ''});
      });
    });

    const expectedResult = ['path/to/cache/folder', 'path/to/cache/folder'];

    //Act + Assert
    return cacheUtils
      .getCacheDirectoryPath(validPackageManager)
      .then(data => expect(data).toEqual(expectedResult));
  });

  it('should return path to the cache folder if one command return empty str', async () => {
    //Arrange
    getExecOutputSpy.mockImplementationOnce((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 0, stdout: 'path/to/cache/folder', stderr: ''});
      });
    });

    getExecOutputSpy.mockImplementationOnce((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 0, stdout: '', stderr: ''});
      });
    });

    const expectedResult = ['path/to/cache/folder'];

    //Act + Assert
    return cacheUtils
      .getCacheDirectoryPath(validPackageManager)
      .then(data => expect(data).toEqual(expectedResult));
  });

  it('should throw if the both commands return empty str', async () => {
    getExecOutputSpy.mockImplementation((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 10, stdout: '', stderr: ''});
      });
    });

    //Act + Assert
    await expect(async () => {
      await cacheUtils.getCacheDirectoryPath(validPackageManager);
    }).rejects.toThrow();
  });

  it('should throw if the specified package name is invalid', async () => {
    getExecOutputSpy.mockImplementation((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 10, stdout: '', stderr: 'Error message'});
      });
    });

    //Act + Assert
    await expect(async () => {
      await cacheUtils.getCacheDirectoryPath(validPackageManager);
    }).rejects.toThrow();
  });
});

describe('isCacheFeatureAvailable', () => {
  //Arrange
  const isFeatureAvailableSpy = jest.spyOn(cache, 'isFeatureAvailable');
  const warningSpy = jest.spyOn(core, 'warning');

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

describe('parseGoModForToolchainVersion', () => {
  const readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when go.mod file not exist', async () => {
    //Arrange
    //Act
    const toolchainVersion = cacheUtils.parseGoModForToolchainVersion(
      '/tmp/non/exist/foo.bar'
    );
    //Assert
    expect(toolchainVersion).toBeNull();
  });

  it('should return null when go.mod file is empty', async () => {
    //Arrange
    readFileSyncSpy.mockImplementation(() => '');
    //Act
    const toolchainVersion = cacheUtils.parseGoModForToolchainVersion('go.mod');
    //Assert
    expect(toolchainVersion).toBeNull();
  });

  it('should return null when go.mod file does not contain toolchain version', async () => {
    //Arrange
    readFileSyncSpy.mockImplementation(() =>
      `
            module example-mod

            go 1.21.0

            require golang.org/x/tools v0.13.0

            require (
              golang.org/x/mod v0.12.0 // indirect
              golang.org/x/sys v0.12.0 // indirect
            )
        `.replace(/^\s+/gm, '')
    );
    //Act
    const toolchainVersion = cacheUtils.parseGoModForToolchainVersion('go.mod');
    //Assert
    expect(toolchainVersion).toBeNull();
  });

  it('should return go version when go.mod file contains go version', () => {
    //Arrange
    readFileSyncSpy.mockImplementation(() =>
      `
            module example-mod

            go 1.21.0

            toolchain go1.21.1

            require golang.org/x/tools v0.13.0

            require (
              golang.org/x/mod v0.12.0 // indirect
              golang.org/x/sys v0.12.0 // indirect
            )
        `.replace(/^\s+/gm, '')
    );

    //Act
    const toolchainVersion = cacheUtils.parseGoModForToolchainVersion('go.mod');
    //Assert
    expect(toolchainVersion).toBe('1.21.1');
  });

  it('should return go version when go.mod file contains more than one go version', () => {
    //Arrange
    readFileSyncSpy.mockImplementation(() =>
      `
            module example-mod

            go 1.21.0

            toolchain go1.21.0
            toolchain go1.21.1

            require golang.org/x/tools v0.13.0

            require (
              golang.org/x/mod v0.12.0 // indirect
              golang.org/x/sys v0.12.0 // indirect
            )
        `.replace(/^\s+/gm, '')
    );

    //Act
    const toolchainVersion = cacheUtils.parseGoModForToolchainVersion('go.mod');
    //Assert
    expect(toolchainVersion).toBe('1.21.1');
  });
});

describe('getToolchainDirectoriesFromCachedDirectories', () => {
  const readdirSyncSpy = jest.spyOn(fs, 'readdirSync');
  const existsSyncSpy = jest.spyOn(fs, 'existsSync');
  const lstatSync = jest.spyOn(fs, 'lstatSync');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array when cacheDirectories is empty', async () => {
    const toolcacheDirectories = getToolchainDirectoriesFromCachedDirectories(
      'foo',
      []
    );
    expect(toolcacheDirectories).toEqual([]);
  });

  it('should return empty array when cacheDirectories does not contain /go/pkg', async () => {
    readdirSyncSpy.mockImplementation(dir =>
      [`${dir}1`, `${dir}2`, `${dir}3`].map(s => {
        const de = new fs.Dirent();
        de.name = s;
        de.isDirectory = () => true;
        return de;
      })
    );

    const toolcacheDirectories = getToolchainDirectoriesFromCachedDirectories(
      '1.1.1',
      ['foo', 'bar']
    );
    expect(toolcacheDirectories).toEqual([]);
  });

  it('should return empty array when cacheDirectories does not contain toolchain@v[0-9.]+-go{goVersion}', async () => {
    readdirSyncSpy.mockImplementation(dir =>
      [`${dir}1`, `${dir}2`, `${dir}3`].map(s => {
        const de = new fs.Dirent();
        de.name = s;
        de.isDirectory = () => true;
        return de;
      })
    );

    const toolcacheDirectories = getToolchainDirectoriesFromCachedDirectories(
      'foo',
      ['foo/go/pkg/mod', 'bar']
    );
    expect(toolcacheDirectories).toEqual([]);
  });

  it('should return one entry when cacheDirectories contains toolchain@v[0-9.]+-go{goVersion} in /pkg/mod', async () => {
    let seqNo = 1;
    readdirSyncSpy.mockImplementation(dir =>
      [`toolchain@v0.0.1-go1.1.1.arch-${seqNo++}`].map(s => {
        const de = new fs.Dirent();
        de.name = s;
        de.isDirectory = () => true;
        return de;
      })
    );
    existsSyncSpy.mockReturnValue(true);
    // @ts-ignore - jest does not have relaxed mocks, so we ignore not-implemented methods
    lstatSync.mockImplementation(() => ({isDirectory: () => true}));

    const toolcacheDirectories = getToolchainDirectoriesFromCachedDirectories(
      '1.1.1',
      ['/foo/go/pkg/mod', 'bar']
    );
    expect(toolcacheDirectories).toEqual([
      '/foo/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.1.1.arch-1'
    ]);
  });
});
