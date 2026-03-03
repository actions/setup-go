import * as exec from '@actions/exec';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as cacheUtils from '../src/cache-utils';
import {PackageManagerInfo} from '../src/package-managers';

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
      dependencyFilePattern: 'go.mod',
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
    dependencyFilePattern: 'go.mod',
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

describe('isGhes', () => {
  const pristineEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
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
