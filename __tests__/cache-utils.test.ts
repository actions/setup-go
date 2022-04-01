import * as exec from '@actions/exec';
import * as cacheUtils from '../src/cache-utils';
import {PackageManagerInfo} from '../src/package-managers';

describe('getCommandOutput', () => {
  //Arrange
  let getExecOutputSpy = jest.spyOn(exec, 'getExecOutput');

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
    expect(async () => {
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
      getCacheFolderCommand: 'go env GOMODCACHE'
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
    expect(async () => {
      await cacheUtils.getPackageManagerInfo(packageManagerName);
    }).rejects.toThrow();
  });
});

describe('getCacheDirectoryPath', () => {
  //Arrange
  let getExecOutputSpy = jest.spyOn(exec, 'getExecOutput');

  const validPackageManager: PackageManagerInfo = {
    dependencyFilePattern: 'go.sum',
    getCacheFolderCommand: 'go env GOMODCACHE'
  };

  it('should return path to the cache folder which specified package manager uses', async () => {
    //Arrange
    getExecOutputSpy.mockImplementation((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 0, stdout: 'path/to/cache/folder', stderr: ''});
      });
    });

    const expectedResult = 'path/to/cache/folder';

    //Act + Assert
    return cacheUtils
      .getCacheDirectoryPath(validPackageManager)
      .then(data => expect(data).toEqual(expectedResult));
  });

  it('should throw if the specified package name is invalid', async () => {
    getExecOutputSpy.mockImplementation((commandLine: string) => {
      return new Promise<exec.ExecOutput>(resolve => {
        resolve({exitCode: 10, stdout: '', stderr: 'Error message'});
      });
    });

    //Act + Assert
    expect(async () => {
      await cacheUtils.getCacheDirectoryPath(validPackageManager);
    }).rejects.toThrow();
  });
});
