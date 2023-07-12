import fs from 'fs';
import * as io from '@actions/io';
import {addExecutablesToCache, IGoVersionInfo} from '../src/installer';
import path from 'path';

describe('Windows performance workaround', () => {
  let mkdirSpy: jest.SpyInstance;
  let symlinkSpy: jest.SpyInstance;
  let statSpy: jest.SpyInstance;
  let readdirSpy: jest.SpyInstance;
  let writeFileSpy: jest.SpyInstance;
  let rmRFSpy: jest.SpyInstance;
  let mkdirPSpy: jest.SpyInstance;
  let cpSpy: jest.SpyInstance;

  let runnerToolCache: string | undefined;
  beforeEach(() => {
    mkdirSpy = jest.spyOn(fs, 'mkdir');
    symlinkSpy = jest.spyOn(fs, 'symlinkSync');
    statSpy = jest.spyOn(fs, 'statSync');
    readdirSpy = jest.spyOn(fs, 'readdirSync');
    writeFileSpy = jest.spyOn(fs, 'writeFileSync');
    rmRFSpy = jest.spyOn(io, 'rmRF');
    mkdirPSpy = jest.spyOn(io, 'mkdirP');
    cpSpy = jest.spyOn(io, 'cp');

    // default implementations
    // @ts-ignore - not implement unused methods
    statSpy.mockImplementation(() => ({
      isDirectory: () => true
    }));
    readdirSpy.mockImplementation(() => []);
    writeFileSpy.mockImplementation(() => {});
    mkdirSpy.mockImplementation(() => {});
    symlinkSpy.mockImplementation(() => {});
    rmRFSpy.mockImplementation(() => Promise.resolve());
    mkdirPSpy.mockImplementation(() => Promise.resolve());
    cpSpy.mockImplementation(() => Promise.resolve());

    runnerToolCache = process.env['RUNNER_TOOL_CACHE'];
  });
  afterEach(() => {
    jest.clearAllMocks();
    process.env['RUNNER_TOOL_CACHE'] = runnerToolCache;
  });
  it('addExecutablesToCache should depend on env[RUNNER_TOOL_CACHE]', async () => {
    const info: IGoVersionInfo = {
      type: 'dist',
      downloadUrl: 'http://nowhere.com',
      resolvedVersion: '1.2.3',
      fileName: 'ignore'
    };

    process.env['RUNNER_TOOL_CACHE'] = '/faked-hostedtoolcache1';
    const cacheDir1 = await addExecutablesToCache('/qzx', info, 'arch');
    expect(cacheDir1).toBe(
      path.join('/', 'faked-hostedtoolcache1', 'go', '1.2.3', 'arch')
    );

    process.env['RUNNER_TOOL_CACHE'] = '/faked-hostedtoolcache2';
    const cacheDir2 = await addExecutablesToCache('/qzx', info, 'arch');
    expect(cacheDir2).toBe(
      path.join('/', 'faked-hostedtoolcache2', 'go', '1.2.3', 'arch')
    );
  });
});
