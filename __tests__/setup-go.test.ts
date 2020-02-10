import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import fs = require('fs');
import osm = require('os');
import path = require('path');
import {run} from '../src/main';
import * as httpm from '@actions/http-client';
import * as im from '../src/installer';
import * as sys from '../src/system';
import {ITypedResponse} from '@actions/http-client/interfaces';

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

  beforeEach(() => {
    // @actions/core
    inputs = {};
    inSpy = jest.spyOn(core, 'getInput');
    inSpy.mockImplementation(name => inputs[name]);

    // node 'os'
    os = {};
    platSpy = jest.spyOn(osm, 'platform');
    platSpy.mockImplementation(() => os['platform']);
    archSpy = jest.spyOn(osm, 'arch');
    archSpy.mockImplementation(() => os['arch']);

    // @actions/tool-cache
    findSpy = jest.spyOn(tc, 'find');
    dlSpy = jest.spyOn(tc, 'downloadTool');
    exSpy = jest.spyOn(tc, 'extractTar');
    cacheSpy = jest.spyOn(tc, 'cacheDir');
    getSpy = jest.spyOn(im, 'getVersions');

    // writes
    cnSpy = jest.spyOn(process.stdout, 'write');
    logSpy = jest.spyOn(console, 'log');
    getSpy.mockImplementation(() => <im.IGoVersion[]>goJsonData);
    cnSpy.mockImplementation(line => {
      // uncomment to debug
      // process.stderr.write('write:' + line + '\n');
    });
    logSpy.mockImplementation(line => {
      // uncomment to debug
      // process.stderr.write('log:' + line + '\n');
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  afterAll(async () => {}, 100000);

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

  it('evaluates to stable with input as true', async () => {
    inputs['go-version'] = '1.13.0';
    inputs.stable = 'true';

    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await run();

    expect(logSpy).toHaveBeenCalledWith(`Setup go stable version spec 1.13.0`);
  });

  it('evaluates to stable with no input', async () => {
    inputs['go-version'] = '1.13.0';

    inSpy.mockImplementation(name => inputs[name]);

    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await run();

    expect(logSpy).toHaveBeenCalledWith(`Setup go stable version spec 1.13.0`);
  });

  it('finds a version of go already in the cache', async () => {
    inputs['go-version'] = '1.13.0';

    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await run();

    let expPath = path.join(toolPath, 'bin');
  });

  it('finds a version in the cache and adds it to the path', async () => {
    inputs['go-version'] = '1.13.0';
    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await run();

    let expPath = path.join(toolPath, 'bin');
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('handles unhandled error and reports error', async () => {
    let errMsg = 'unhandled error message';
    inputs['go-version'] = '1.13.0';

    findSpy.mockImplementation(() => {
      throw new Error(errMsg);
    });
    await run();
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
    await run();

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
    await run();

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
    await run();

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
    await run();

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Failed to download version 1.13.1: Error: golang download url did not return results${osm.EOL}`
    );
  });

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
});
