import * as gobin from '../src/gobin';

jest.mock('child_process');

describe('gobin', () => {
  const childProcess = require('child_process');

  let execSpy: jest.SpyInstance;

  beforeEach(() => {
    execSpy = jest.spyOn(childProcess, 'exec');
    execSpy.mockImplementation((_command, callback) => {
      callback('', {stdout: '/home/user/go', stderr: ''});
    });
  });

  it('should return ${GOPATH}/bin', async () => {
    const gobinPath = await gobin.getGOBIN('...');
    expect(gobinPath).toBe('/home/user/go/bin');
  });
});
