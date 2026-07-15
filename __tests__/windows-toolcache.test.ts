import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import path from 'path';

const statSyncMock = jest.fn(() => ({
  isDirectory: () => true,
  isFile: () => true
}));
const readdirSyncMock = jest.fn(() => [] as any);
const writeFileSyncMock = jest.fn();
const mkdirMock = jest.fn();
const symlinkSyncMock = jest.fn();

jest.unstable_mockModule('@actions/io', () => ({
  which: jest.fn(),
  mkdirP: jest.fn(() => Promise.resolve()),
  rmRF: jest.fn(() => Promise.resolve()),
  mv: jest.fn(() => Promise.resolve()),
  cp: jest.fn(() => Promise.resolve())
}));

const realFs = (await import('fs')).default;
const fsExports = {
  ...realFs,
  statSync: statSyncMock,
  readdirSync: readdirSyncMock,
  writeFileSync: writeFileSyncMock,
  mkdir: mkdirMock,
  symlinkSync: symlinkSyncMock
};
jest.unstable_mockModule('fs', () => ({...fsExports, default: fsExports}));

const io = await import('@actions/io');
const tc = await import('@actions/tool-cache');

describe('Windows performance workaround', () => {
  let rmRFSpy: jest.Mock;
  let mkdirPSpy: jest.Mock;
  let cpSpy: jest.Mock;

  let runnerToolCache: string | undefined;
  beforeEach(() => {
    rmRFSpy = io.rmRF as jest.Mock;
    mkdirPSpy = io.mkdirP as jest.Mock;
    cpSpy = io.cp as jest.Mock;

    // default implementations
    statSyncMock.mockImplementation(() => ({
      isDirectory: () => true,
      isFile: () => true
    }));
    readdirSyncMock.mockImplementation(() => []);
    writeFileSyncMock.mockImplementation(() => {});
    mkdirMock.mockImplementation(() => {});
    symlinkSyncMock.mockImplementation(() => {});
    rmRFSpy.mockImplementation(() => Promise.resolve());
    mkdirPSpy.mockImplementation(() => Promise.resolve());
    cpSpy.mockImplementation(() => Promise.resolve());

    runnerToolCache = process.env['RUNNER_TOOL_CACHE'];
  });
  afterEach(() => {
    jest.clearAllMocks();
    process.env['RUNNER_TOOL_CACHE'] = runnerToolCache;
  });
  // cacheWindowsToolkitDir depends on implementation of tc.cacheDir
  // with the assumption that target dir is passed by RUNNER_TOOL_CACHE environment variable
  // Make sure the implementation has not been changed
  it('addExecutablesToCache should depend on env[RUNNER_TOOL_CACHE]', async () => {
    process.env['RUNNER_TOOL_CACHE'] = '/faked-hostedtoolcache1';
    const cacheDir1 = await tc.cacheDir('/qzx', 'go', '1.2.3', 'arch');
    expect(cacheDir1).toBe(
      path.join('/', 'faked-hostedtoolcache1', 'go', '1.2.3', 'arch')
    );

    process.env['RUNNER_TOOL_CACHE'] = '/faked-hostedtoolcache2';
    const cacheDir2 = await tc.cacheDir('/qzx', 'go', '1.2.3', 'arch');
    expect(cacheDir2).toBe(
      path.join('/', 'faked-hostedtoolcache2', 'go', '1.2.3', 'arch')
    );
  });
});
