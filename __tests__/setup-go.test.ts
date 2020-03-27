import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import cp from 'child_process';
import osm = require('os');
import path from 'path';
import * as main from '../src/main';
import * as im from '../src/installer';

let goJsonData = require('./data/golang-dl.json');

describe('setup-go', () => {
  let inputs = {} as any;
  let os = {} as any;

  let inSpy: jest.SpyInstance;
  let findSpy: jest.SpyInstance;
  let cnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let getSpy: jest.SpyInstance;
  let platSpy: jest.SpyInstance;
  let archSpy: jest.SpyInstance;
  let dlSpy: jest.SpyInstance;
  let exSpy: jest.SpyInstance;
  let cacheSpy: jest.SpyInstance;
  let dbgSpy: jest.SpyInstance;
  let whichSpy: jest.SpyInstance;
  let existsSpy: jest.SpyInstance;
  let mkdirpSpy: jest.SpyInstance;
  let execSpy: jest.SpyInstance;

  beforeEach(() => {
    // @actions/core
    inputs = {};
    inSpy = jest.spyOn(core, 'getInput');
    inSpy.mockImplementation(name => inputs[name]);

    // node
    os = {};
    platSpy = jest.spyOn(osm, 'platform');
    platSpy.mockImplementation(() => os['platform']);
    archSpy = jest.spyOn(osm, 'arch');
    archSpy.mockImplementation(() => os['arch']);
    execSpy = jest.spyOn(cp, 'execSync');

    // @actions/tool-cache
    findSpy = jest.spyOn(tc, 'find');
    dlSpy = jest.spyOn(tc, 'downloadTool');
    exSpy = jest.spyOn(tc, 'extractTar');
    cacheSpy = jest.spyOn(tc, 'cacheDir');
    getSpy = jest.spyOn(im, 'getVersions');

    // io
    whichSpy = jest.spyOn(io, 'which');
    existsSpy = jest.spyOn(fs, 'existsSync');
    mkdirpSpy = jest.spyOn(io, 'mkdirP');

    // writes
    cnSpy = jest.spyOn(process.stdout, 'write');
    logSpy = jest.spyOn(console, 'log');
    dbgSpy = jest.spyOn(main, '_debug');
    getSpy.mockImplementation(() => <im.IGoVersion[]>goJsonData);
    cnSpy.mockImplementation(line => {
      // uncomment to debug
      // process.stderr.write('write:' + line + '\n');
    });
    logSpy.mockImplementation(line => {
      // uncomment to debug
      // process.stderr.write('log:' + line + '\n');
    });
    dbgSpy.mockImplementation(msg => {
      // uncomment to see debug output
      // process.stderr.write(msg + '\n');
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    //jest.restoreAllMocks();
  });

  afterAll(async () => {}, 100000);

  it('can query versions', async () => {
    let versions: im.IGoVersion[] | null = await im.getVersions(
      'https://non.existant.com/path'
    );
    expect(versions).toBeDefined();
    let l: number = versions ? versions.length : 0;
    expect(l).toBe(91);
  });

  it('finds stable match for exact version', async () => {
    os.platform = 'win32';
    os.arch = 'x64';

    // get request is already mocked
    // spec: 1.13.7 => 1.13.7 (exact)
    let match: im.IGoVersion | undefined = await im.findMatch('1.13.7', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.windows-amd64.zip');
  });

  it('finds stable match for exact dot zero version', async () => {
    os.platform = 'darwin';
    os.arch = 'x64';

    // spec: 1.13.0 => 1.13
    let match: im.IGoVersion | undefined = await im.findMatch('1.13.0', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.darwin-amd64.tar.gz');
  });

  it('finds latest patch version for minor version spec', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    // spec: 1.13 => 1.13.7 (latest)
    let match: im.IGoVersion | undefined = await im.findMatch('1.13', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.linux-amd64.tar.gz');
  });

  it('finds latest patch version for caret version spec', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    // spec: ^1.13.6 => 1.13.7
    let match: im.IGoVersion | undefined = await im.findMatch('^1.13.6', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.linux-amd64.tar.gz');
  });

  it('finds latest version for major version spec', async () => {
    os.platform = 'win32';
    os.arch = 'x32';

    // spec: 1 => 1.13.7 (latest)
    let match: im.IGoVersion | undefined = await im.findMatch('1', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.windows-386.zip');
  });

  it('finds unstable pre-release version', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    // spec: 1.14, stable=false => go1.14rc1
    let match: im.IGoVersion | undefined = await im.findMatch(
      '1.14.0-rc1',
      false
    );
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.14rc1');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.14rc1.linux-amd64.tar.gz');
  });

  it('evaluates to stable with input as true', async () => {
    inputs['go-version'] = '1.13.0';
    inputs.stable = 'true';

    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    expect(logSpy).toHaveBeenCalledWith(`Setup go stable version spec 1.13.0`);
  });

  it('evaluates to stable with no input', async () => {
    inputs['go-version'] = '1.13.0';

    inSpy.mockImplementation(name => inputs[name]);

    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    expect(logSpy).toHaveBeenCalledWith(`Setup go stable version spec 1.13.0`);
  });

  it('finds a version of go already in the cache', async () => {
    inputs['go-version'] = '1.13.0';

    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    let expPath = path.join(toolPath, 'bin');
  });

  it('finds a version in the cache and adds it to the path', async () => {
    inputs['go-version'] = '1.13.0';
    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    let expPath = path.join(toolPath, 'bin');
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('handles unhandled error and reports error', async () => {
    let errMsg = 'unhandled error message';
    inputs['go-version'] = '1.13.0';

    findSpy.mockImplementation(() => {
      throw new Error(errMsg);
    });
    await main.run();
    expect(cnSpy).toHaveBeenCalledWith('::error::' + errMsg + osm.EOL);
  });

  it('downloads a version not in the cache', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    inputs['go-version'] = '1.13.1';

    findSpy.mockImplementation(() => '');
    dlSpy.mockImplementation(() => '/some/temp/path');
    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    exSpy.mockImplementation(() => '/some/other/temp/path');
    cacheSpy.mockImplementation(() => toolPath);
    await main.run();

    let expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(exSpy).toHaveBeenCalled();
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('does not find a version that does not exist', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    inputs['go-version'] = '9.99.9';

    findSpy.mockImplementation(() => '');
    await main.run();

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Could not find a version that satisfied version spec: 9.99.9${osm.EOL}`
    );
  });

  it('reports a failed download', async () => {
    let errMsg = 'unhandled download message';
    os.platform = 'linux';
    os.arch = 'x64';

    inputs['go-version'] = '1.13.1';

    findSpy.mockImplementation(() => '');
    dlSpy.mockImplementation(() => {
      throw new Error(errMsg);
    });
    await main.run();

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Failed to download version 1.13.1: Error: ${errMsg}${osm.EOL}`
    );
  });

  it('reports empty query results', async () => {
    let errMsg = 'unhandled download message';
    os.platform = 'linux';
    os.arch = 'x64';

    inputs['go-version'] = '1.13.1';

    findSpy.mockImplementation(() => '');
    getSpy.mockImplementation(() => null);
    await main.run();

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Failed to download version 1.13.1: Error: golang download url did not return results${osm.EOL}`
    );
  });

  it('does not add BIN if go is not in path', async () => {
    whichSpy.mockImplementation(async () => {
      return '';
    });
    let added = await main.addBinToPath();
    expect(added).toBeFalsy();
  });

  it('adds bin if dir not exists', async () => {
    whichSpy.mockImplementation(async () => {
      return '/usr/local/go/bin/go';
    });

    execSpy.mockImplementation(() => {
      return '/Users/testuser/go';
    });

    mkdirpSpy.mockImplementation(async () => {});
    existsSpy.mockImplementation(path => {
      return false;
    });

    let added = await main.addBinToPath();
    expect(added).toBeTruthy;
  });

  // 1.13.1 => 1.13.1
  // 1.13 => 1.13.0
  // 1.10beta1 => 1.10.0-beta1, 1.10rc1 => 1.10.0-rc1
  // 1.8.5beta1 => 1.8.5-beta1, 1.8.5rc1 => 1.8.5-rc1
  it('converts prerelease versions', async () => {
    expect(im.makeSemver('1.10beta1')).toBe('1.10.0-beta1');
    expect(im.makeSemver('1.10rc1')).toBe('1.10.0-rc1');
  });

  it('converts dot zero versions', async () => {
    expect(im.makeSemver('1.13')).toBe('1.13.0');
  });

  it('does not convert exact versions', async () => {
    expect(im.makeSemver('1.13.1')).toBe('1.13.1');
  });
});
