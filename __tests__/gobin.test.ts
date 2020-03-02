import * as gobin from '../src/gobin';
import * as path from 'path';

jest.mock('child_process');

describe('gobin', () => {
  const childProcess = require('child_process');

  let execSpy: jest.SpyInstance;
  let gopath = path.join('home', 'user', 'go');

  beforeEach(() => {
    execSpy = jest.spyOn(childProcess, 'exec');
    execSpy.mockImplementation((_command, callback) => {
      callback('', {stdout: gopath, stderr: ''});
    });
  });

  it('should return ${GOPATH}/bin', async () => {
    const gobinPath = await gobin.getGOBIN('...');
    expect(gobinPath).toBe(path.join(gopath, 'bin'));
  });
});
