import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import fs = require('fs');
import os = require('os');
import path = require('path');
import {run} from '../src/main';
import * as httpm from '@actions/http-client';
import * as im from '../src/installer';
import * as sys from '../src/system';
import {ITypedResponse} from '@actions/http-client/interfaces';

let goJsonData = require('./data/golang-dl.json');

describe('setup-go', () => {
  let inSpy: jest.SpyInstance;
  let tcSpy: jest.SpyInstance;
  let cnSpy: jest.SpyInstance;
  let getSpy: jest.SpyInstance;
  let platSpy: jest.SpyInstance;
  let archSpy: jest.SpyInstance;
  let dlSpy: jest.SpyInstance;
  let exSpy: jest.SpyInstance;

  beforeEach(() => {
    tcSpy = jest.spyOn(tc, 'find');
    inSpy = jest.spyOn(core, 'getInput');
    cnSpy = jest.spyOn(process.stdout, 'write');
    platSpy = jest.spyOn(sys, 'getPlatform');
    archSpy = jest.spyOn(sys, 'getArch');
    dlSpy = jest.spyOn(tc, 'downloadTool');
    exSpy = jest.spyOn(tc, 'extractTar');
    getSpy = jest.spyOn(im, 'getVersions');
    getSpy.mockImplementation(() => <im.IGoVersion[]>goJsonData);
    cnSpy.mockImplementation(line => {
      // uncomment to debug
      //process.stderr.write('write2:' + line + '\n');
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  afterAll(async () => {}, 100000);

  it('finds a version of go already in the cache', async () => {
    inSpy.mockImplementation(() => '1.13.0');
    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    tcSpy.mockImplementation(() => toolPath);
    await run();

    let expPath = path.join(toolPath, 'bin');
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${os.EOL}`);
  });

  it('finds a version in the cache and adds it to the path', async () => {
    let toolPath = path.normalize('/cache/go/1.13.0/x64');
    inSpy.mockImplementation(() => '1.13.0');
    tcSpy.mockImplementation(() => toolPath);
    await run();

    let expPath = path.join(toolPath, 'bin');
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${os.EOL}`);
  });

  it('handles unhandled error and reports error', async () => {
    let errMsg = 'unhandled error message';
    inSpy.mockImplementation(() => '1.13.0');
    tcSpy.mockImplementation(() => {
      throw new Error(errMsg);
    });
    await run();
    expect(cnSpy).toHaveBeenCalledWith('::error::' + errMsg + os.EOL);
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
    platSpy.mockImplementation(() => 'linux');
    archSpy.mockImplementation(() => 'amd64');

    // get request is already mocked
    // spec: 1.13.1 => 1.13.1 (exact)
    let match: im.IGoVersion | undefined = await im.findMatch('1.13.1', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.1');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.1.linux-amd64.tar.gz');
  });

  it('finds stable match for exact dot zero version', async () => {
    platSpy.mockImplementation(() => 'linux');
    archSpy.mockImplementation(() => 'amd64');

    // spec: 1.13.0 => 1.13
    let match: im.IGoVersion | undefined = await im.findMatch('1.13.0', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.linux-amd64.tar.gz');
  });

  it('finds latest patch version for minor version spec', async () => {
    platSpy.mockImplementation(() => 'linux');
    archSpy.mockImplementation(() => 'amd64');

    // spec: 1.13 => 1.13.7 (latest)
    let match: im.IGoVersion | undefined = await im.findMatch('1.13', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.linux-amd64.tar.gz');
  });

  it('finds latest patch version for caret version spec', async () => {
    platSpy.mockImplementation(() => 'linux');
    archSpy.mockImplementation(() => 'amd64');

    // spec: ^1.13.6 => 1.13.7
    let match: im.IGoVersion | undefined = await im.findMatch('^1.13.6', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.linux-amd64.tar.gz');
  });

  it('finds latest version for major version spec', async () => {
    platSpy.mockImplementation(() => 'linux');
    archSpy.mockImplementation(() => 'amd64');

    // spec: 1 => 1.13.7 (latest)
    let match: im.IGoVersion | undefined = await im.findMatch('1', true);
    expect(match).toBeDefined();
    let version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    let fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.linux-amd64.tar.gz');
  });
});
