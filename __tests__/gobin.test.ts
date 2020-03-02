import * as gobin from '../src/gobin';
import * as path from 'path';

jest.mock('child_process');

describe('gobin', () => {
  const childProcess = require('child_process');

  let execFileSpy: jest.SpyInstance;
  let gopath = path.join('home', 'user', 'go');

  beforeEach(() => {
    execFileSpy = jest.spyOn(childProcess, 'execFile');
    execFileSpy.mockImplementation((_file, _args, callback) => {
      callback('', {stdout: gopath, stderr: ''});
    });
  });

  it('should return ${GOPATH}/bin', async () => {
    const gobinPath = await gobin.getGOBIN('...');
    expect(gobinPath).toBe(path.join(gopath, 'bin'));
  });
});
