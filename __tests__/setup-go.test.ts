import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import cp from 'child_process';
import osm, {type} from 'os';
import path from 'path';
import * as main from '../src/main';
import * as im from '../src/installer';
import * as httpm from '@actions/http-client';

import goJsonData from './data/golang-dl.json';
import matchers from '../matchers.json';
import goTestManifest from './data/versions-manifest.json';
const matcherPattern = matchers.problemMatcher[0].pattern[0];
const matcherRegExp = new RegExp(matcherPattern.regexp);
const win32Join = path.win32.join;
const posixJoin = path.posix.join;

jest.setTimeout(10000);

describe('setup-go', () => {
  let inputs = {} as any;
  let os = {} as any;

  let inSpy: jest.SpyInstance;
  let getBooleanInputSpy: jest.SpyInstance;
  let exportVarSpy: jest.SpyInstance;
  let findSpy: jest.SpyInstance;
  let cnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let getSpy: jest.SpyInstance;
  let platSpy: jest.SpyInstance;
  let archSpy: jest.SpyInstance;
  let joinSpy: jest.SpyInstance;
  let dlSpy: jest.SpyInstance;
  let extractTarSpy: jest.SpyInstance;
  let extractZipSpy: jest.SpyInstance;
  let cacheSpy: jest.SpyInstance;
  let dbgSpy: jest.SpyInstance;
  let whichSpy: jest.SpyInstance;
  let existsSpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let mkdirpSpy: jest.SpyInstance;
  let mkdirSpy: jest.SpyInstance;
  let symlinkSpy: jest.SpyInstance;
  let execSpy: jest.SpyInstance;
  let getManifestSpy: jest.SpyInstance;
  let getAllVersionsSpy: jest.SpyInstance;
  let httpmGetJsonSpy: jest.SpyInstance;

  beforeAll(async () => {
    process.env['GITHUB_ENV'] = ''; // Stub out Environment file functionality so we can verify it writes to standard out (toolkit is backwards compatible)
  }, 100000);

  beforeEach(() => {
    process.env['GITHUB_PATH'] = ''; // Stub out ENV file functionality so we can verify it writes to standard out

    // @actions/core
    inputs = {};
    inSpy = jest.spyOn(core, 'getInput');
    inSpy.mockImplementation(name => inputs[name]);
    getBooleanInputSpy = jest.spyOn(core, 'getBooleanInput');
    getBooleanInputSpy.mockImplementation(name => inputs[name]);
    exportVarSpy = jest.spyOn(core, 'exportVariable');

    // node
    os = {};
    platSpy = jest.spyOn(osm, 'platform');
    platSpy.mockImplementation(() => os['platform']);
    archSpy = jest.spyOn(osm, 'arch');
    archSpy.mockImplementation(() => os['arch']);
    execSpy = jest.spyOn(cp, 'execSync');

    // switch path join behaviour based on set os.platform
    joinSpy = jest.spyOn(path, 'join');
    joinSpy.mockImplementation((...paths: string[]): string => {
      if (os['platform'] == 'win32') {
        return win32Join(...paths);
      }

      return posixJoin(...paths);
    });

    // @actions/tool-cache
    findSpy = jest.spyOn(tc, 'find');
    dlSpy = jest.spyOn(tc, 'downloadTool');
    extractTarSpy = jest.spyOn(tc, 'extractTar');
    extractZipSpy = jest.spyOn(tc, 'extractZip');
    cacheSpy = jest.spyOn(tc, 'cacheDir');
    getSpy = jest.spyOn(im, 'getVersionsDist');
    getManifestSpy = jest.spyOn(tc, 'getManifestFromRepo');
    getAllVersionsSpy = jest.spyOn(im, 'getManifest');

    // httm
    httpmGetJsonSpy = jest.spyOn(httpm.HttpClient.prototype, 'getJson');

    // io
    whichSpy = jest.spyOn(io, 'which');
    existsSpy = jest.spyOn(fs, 'existsSync');
    readFileSpy = jest.spyOn(fs, 'readFileSync');
    mkdirpSpy = jest.spyOn(io, 'mkdirP');

    // fs
    mkdirSpy = jest.spyOn(fs, 'mkdir');
    symlinkSpy = jest.spyOn(fs, 'symlinkSync');
    symlinkSpy.mockImplementation(() => {});

    // gets
    getManifestSpy.mockImplementation(() => <tc.IToolRelease[]>goTestManifest);

    // writes
    cnSpy = jest.spyOn(process.stdout, 'write');
    logSpy = jest.spyOn(core, 'info');
    dbgSpy = jest.spyOn(core, 'debug');
    getSpy.mockImplementation(() => <im.IGoVersion[] | null>goJsonData);
    cnSpy.mockImplementation(line => {
      // uncomment to debug
      // process.stderr.write('write:' + line + '\n');
    });
    logSpy.mockImplementation(line => {
      // uncomment to debug
      //process.stderr.write('log:' + line + '\n');
    });
    dbgSpy.mockImplementation(msg => {
      // uncomment to see debug output
      // process.stderr.write(msg + '\n');
    });
  });

  afterEach(() => {
    //jest.resetAllMocks();
    jest.clearAllMocks();
    //jest.restoreAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  }, 100000);

  it('can extract the major.minor.patch version from a given Go version string', async () => {
    const goVersionOutput = 'go version go1.16.6 darwin/amd64';
    expect(main.parseGoVersion(goVersionOutput)).toBe('1.16.6');
  });

  it('can find 1.9.7 from manifest on osx', async () => {
    os.platform = 'darwin';
    os.arch = 'x64';

    const match = await im.getInfoFromManifest('1.9.7', true, 'mocktoken');
    expect(match).toBeDefined();
    expect(match!.resolvedVersion).toBe('1.9.7');
    expect(match!.type).toBe('manifest');
    expect(match!.downloadUrl).toBe(
      'https://github.com/actions/go-versions/releases/download/1.9.7/go-1.9.7-darwin-x64.tar.gz'
    );
  });

  it('should return manifest from repo', async () => {
    const manifest = await im.getManifest(undefined);
    expect(manifest).toEqual(goTestManifest);
  });

  it('should return manifest from raw URL if repo fetch fails', async () => {
    getManifestSpy.mockRejectedValue(new Error('Fetch failed'));
    httpmGetJsonSpy.mockResolvedValue({
      result: goTestManifest
    });
    const manifest = await im.getManifest(undefined);
    expect(httpmGetJsonSpy).toHaveBeenCalled();
    expect(manifest).toEqual(goTestManifest);
  });

  it('can find 1.9 from manifest on linux', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    const match = await im.getInfoFromManifest('1.9.7', true, 'mocktoken');
    expect(match).toBeDefined();
    expect(match!.resolvedVersion).toBe('1.9.7');
    expect(match!.type).toBe('manifest');
    expect(match!.downloadUrl).toBe(
      'https://github.com/actions/go-versions/releases/download/1.9.7/go-1.9.7-linux-x64.tar.gz'
    );
  });

  it('can find 1.9 from manifest on windows', async () => {
    os.platform = 'win32';
    os.arch = 'x64';

    const match = await im.getInfoFromManifest('1.9.7', true, 'mocktoken');
    expect(match).toBeDefined();
    expect(match!.resolvedVersion).toBe('1.9.7');
    expect(match!.type).toBe('manifest');
    expect(match!.downloadUrl).toBe(
      'https://github.com/actions/go-versions/releases/download/1.9.7/go-1.9.7-win32-x64.zip'
    );
  });

  it('finds stable match for exact dot zero version', async () => {
    os.platform = 'darwin';
    os.arch = 'x64';

    // spec: 1.13.0 => 1.13
    const match: im.IGoVersion | undefined = await im.findMatch('1.13.0');
    expect(match).toBeDefined();
    const version: string = match ? match.version : '';
    expect(version).toBe('go1.13');
    const fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.darwin-amd64.tar.gz');
  });

  it('finds latest patch version for minor version spec', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    // spec: 1.13 => 1.13.7 (latest)
    const match: im.IGoVersion | undefined = await im.findMatch('1.13');
    expect(match).toBeDefined();
    const version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    const fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.linux-amd64.tar.gz');
  });

  it('finds latest patch version for caret version spec', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    // spec: ^1.13.6 => 1.13.7
    const match: im.IGoVersion | undefined = await im.findMatch('^1.13.6');
    expect(match).toBeDefined();
    const version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    const fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.linux-amd64.tar.gz');
  });

  it('finds latest version for major version spec', async () => {
    os.platform = 'win32';
    os.arch = 'x32';

    // spec: 1 => 1.13.7 (latest)
    const match: im.IGoVersion | undefined = await im.findMatch('1');
    expect(match).toBeDefined();
    const version: string = match ? match.version : '';
    expect(version).toBe('go1.13.7');
    const fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.13.7.windows-386.zip');
  });

  it('finds unstable pre-release version', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    // spec: 1.14, stable=false => go1.14rc1
    const match: im.IGoVersion | undefined = await im.findMatch('1.14.0-rc.1');
    expect(match).toBeDefined();
    const version: string = match ? match.version : '';
    expect(version).toBe('go1.14rc1');
    const fileName = match ? match.files[0].filename : '';
    expect(fileName).toBe('go1.14rc1.linux-amd64.tar.gz');
  });

  it('evaluates to stable with input as true', async () => {
    inputs['go-version'] = '1.13.0';
    inputs.stable = 'true';

    const toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    expect(logSpy).toHaveBeenCalledWith(`Setup go version spec 1.13.0`);
  });

  it('evaluates to stable with no input', async () => {
    inputs['go-version'] = '1.13.0';

    inSpy.mockImplementation(name => inputs[name]);

    const toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    expect(logSpy).toHaveBeenCalledWith(`Setup go version spec 1.13.0`);
  });

  it('does not export any variables for Go versions >=1.9', async () => {
    inputs['go-version'] = '1.13.0';
    inSpy.mockImplementation(name => inputs[name]);

    const toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);

    const vars: {[key: string]: string} = {};
    exportVarSpy.mockImplementation((name: string, val: string) => {
      vars[name] = val;
    });

    await main.run();
    expect(vars).toStrictEqual({});
  });

  it('exports GOROOT for Go versions <1.9', async () => {
    inputs['go-version'] = '1.8';
    inSpy.mockImplementation(name => inputs[name]);

    const toolPath = path.normalize('/cache/go/1.8.0/x64');
    findSpy.mockImplementation(() => toolPath);

    const vars: {[key: string]: string} = {};
    exportVarSpy.mockImplementation((name: string, val: string) => {
      vars[name] = val;
    });

    await main.run();
    expect(vars).toStrictEqual({
      GOROOT: toolPath
    });
  });

  it('finds a version of go already in the cache', async () => {
    inputs['go-version'] = '1.13.0';

    const toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    expect(logSpy).toHaveBeenCalledWith(`Found in cache @ ${toolPath}`);
  });

  it('finds a version in the cache and adds it to the path', async () => {
    inputs['go-version'] = '1.13.0';
    const toolPath = path.normalize('/cache/go/1.13.0/x64');
    findSpy.mockImplementation(() => toolPath);
    await main.run();

    const expPath = path.join(toolPath, 'bin');
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('handles unhandled error and reports error', async () => {
    const errMsg = 'unhandled error message';
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
    const toolPath = path.normalize('/cache/go/1.13.0/x64');
    extractTarSpy.mockImplementation(() => '/some/other/temp/path');
    cacheSpy.mockImplementation(() => toolPath);
    await main.run();

    const expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(extractTarSpy).toHaveBeenCalled();
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('downloads a version not in the cache (windows)', async () => {
    os.platform = 'win32';
    os.arch = 'x64';

    inputs['go-version'] = '1.13.1';
    process.env['RUNNER_TEMP'] = 'C:\\temp\\';

    findSpy.mockImplementation(() => '');
    dlSpy.mockImplementation(() => 'C:\\temp\\some\\path');
    extractZipSpy.mockImplementation(() => 'C:\\temp\\some\\other\\path');

    const toolPath = path.normalize('C:\\cache\\go\\1.13.0\\x64');
    cacheSpy.mockImplementation(() => toolPath);

    await main.run();

    const expPath = path.win32.join(toolPath, 'bin');
    expect(dlSpy).toHaveBeenCalledWith(
      'https://storage.googleapis.com/golang/go1.13.1.windows-amd64.zip',
      'C:\\temp\\go1.13.1.windows-amd64.zip',
      undefined
    );
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('does not find a version that does not exist', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    inputs['go-version'] = '9.99.9';

    findSpy.mockImplementation(() => '');
    await main.run();

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Unable to find Go version '9.99.9' for platform linux and architecture x64.${osm.EOL}`
    );
  });

  it('downloads a version from a manifest match', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    const versionSpec = '1.12.16';

    inputs['go-version'] = versionSpec;
    inputs['token'] = 'faketoken';

    const expectedUrl =
      'https://github.com/actions/go-versions/releases/download/1.12.16-20200616.20/go-1.12.16-linux-x64.tar.gz';

    // ... but not in the local cache
    findSpy.mockImplementation(() => '');

    dlSpy.mockImplementation(async () => '/some/temp/path');
    const toolPath = path.normalize('/cache/go/1.12.16/x64');
    extractTarSpy.mockImplementation(async () => '/some/other/temp/path');
    cacheSpy.mockImplementation(async () => toolPath);

    await main.run();

    const expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(extractTarSpy).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalledWith(
      'Not found in manifest.  Falling back to download directly from Go'
    );
    expect(logSpy).toHaveBeenCalledWith(
      `Acquiring 1.12.16 from ${expectedUrl}`
    );

    expect(logSpy).toHaveBeenCalledWith(`Added go to the path`);
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('downloads a major and minor from a manifest match', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    const versionSpec = '1.12';

    inputs['go-version'] = versionSpec;
    inputs['token'] = 'faketoken';

    const expectedUrl =
      'https://github.com/actions/go-versions/releases/download/1.12.17-20200616.21/go-1.12.17-linux-x64.tar.gz';

    // ... but not in the local cache
    findSpy.mockImplementation(() => '');

    dlSpy.mockImplementation(async () => '/some/temp/path');
    const toolPath = path.normalize('/cache/go/1.12.17/x64');
    extractTarSpy.mockImplementation(async () => '/some/other/temp/path');
    cacheSpy.mockImplementation(async () => toolPath);

    await main.run();

    const expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(extractTarSpy).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalledWith(
      'Not found in manifest.  Falling back to download directly from Go'
    );
    expect(logSpy).toHaveBeenCalledWith(
      `Acquiring 1.12.17 from ${expectedUrl}`
    );

    expect(logSpy).toHaveBeenCalledWith(`Added go to the path`);
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('falls back to a version from go dist', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    const versionSpec = '1.12.14';

    inputs['go-version'] = versionSpec;
    inputs['token'] = 'faketoken';

    // ... but not in the local cache
    findSpy.mockImplementation(() => '');

    dlSpy.mockImplementation(async () => '/some/temp/path');
    const toolPath = path.normalize('/cache/go/1.12.14/x64');
    extractTarSpy.mockImplementation(async () => '/some/other/temp/path');
    cacheSpy.mockImplementation(async () => toolPath);

    await main.run();

    const expPath = path.join(toolPath, 'bin');
    expect(logSpy).toHaveBeenCalledWith('Setup go version spec 1.12.14');
    expect(findSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Attempting to download 1.12.14...');
    expect(dlSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('matching 1.12.14...');
    expect(extractTarSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Not found in manifest.  Falling back to download directly from Go'
    );
    expect(logSpy).toHaveBeenCalledWith(`Install from dist`);
    expect(logSpy).toHaveBeenCalledWith(`Added go to the path`);
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('reports a failed download', async () => {
    const errMsg = 'unhandled download message';
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

  it('does not add BIN if go is not in path', async () => {
    whichSpy.mockImplementation(async () => {
      return '';
    });
    const added = await main.addBinToPath();
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
    existsSpy.mockImplementation(() => {
      return false;
    });

    const added = await main.addBinToPath();
    expect(added).toBeTruthy();
  });

  interface Annotation {
    file: string;
    line: number;
    column: number;
    message: string;
  }

  //
  // problem matcher regex pattern tests

  function testMatch(line: string): Annotation {
    const annotation = <Annotation>{};

    const match = matcherRegExp.exec(line);
    if (match) {
      annotation.line = parseInt(match[matcherPattern.line], 10);
      annotation.column = parseInt(match[matcherPattern.column], 10);
      annotation.file = match[matcherPattern.file].trim();
      annotation.message = match[matcherPattern.message].trim();
    }

    return annotation;
  }

  it('matches on relative unix path', async () => {
    const line = './main.go:13:2: undefined: fmt.Printl';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('./main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on unix path up the tree', async () => {
    const line = '../main.go:13:2: undefined: fmt.Printl';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('../main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on unix path down the tree', async () => {
    const line = 'foo/main.go:13:2: undefined: fmt.Printl';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('foo/main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on rooted unix path', async () => {
    const line = '/assert.go:4:1: missing return at end of function';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(4);
    expect(annotation.column).toBe(1);
    expect(annotation.file).toBe('/assert.go');
    expect(annotation.message).toBe('missing return at end of function');
  });

  it('matches on unix path with spaces', async () => {
    const line = '   ./assert.go:5:2: missing return at end of function   ';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(5);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('./assert.go');
    expect(annotation.message).toBe('missing return at end of function');
  });

  it('matches on unix path with tabs', async () => {
    const line = '\t./assert.go:5:2: missing return at end of function   ';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(5);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('./assert.go');
    expect(annotation.message).toBe('missing return at end of function');
  });

  it('matches on relative windows path', async () => {
    const line = '.\\main.go:13:2: undefined: fmt.Printl';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('.\\main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on windows path up the tree', async () => {
    const line = '..\\main.go:13:2: undefined: fmt.Printl';
    const annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('..\\main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  // 1.13.1 => 1.13.1
  // 1.13 => 1.13.0
  // 1.10beta1 => 1.10.0-beta.1, 1.10rc1 => 1.10.0-rc.1
  // 1.8.5beta1 => 1.8.5-beta.1, 1.8.5rc1 => 1.8.5-rc.1
  it('converts prerelease versions', async () => {
    expect(im.makeSemver('1.10beta1')).toBe('1.10.0-beta.1');
    expect(im.makeSemver('1.10rc1')).toBe('1.10.0-rc.1');
  });

  it('converts dot zero versions', async () => {
    expect(im.makeSemver('1.13')).toBe('1.13.0');
  });

  it('does not convert exact versions', async () => {
    expect(im.makeSemver('1.13.1')).toBe('1.13.1');
  });

  describe('check-latest flag', () => {
    it("use local version and don't check manifest if check-latest is not specified", async () => {
      os.platform = 'linux';
      os.arch = 'x64';

      inputs['go-version'] = '1.16';
      inputs['check-latest'] = false;

      const toolPath = path.normalize('/cache/go/1.16.1/x64');
      findSpy.mockReturnValue(toolPath);
      await main.run();

      expect(logSpy).toHaveBeenCalledWith(`Found in cache @ ${toolPath}`);
      expect(logSpy).not.toHaveBeenCalledWith(
        'Attempting to resolve the latest version from the manifest...'
      );
    });

    it('check latest version and resolve it from local cache', async () => {
      os.platform = 'linux';
      os.arch = 'x64';

      inputs['go-version'] = '1.16';
      inputs['check-latest'] = true;

      const toolPath = path.normalize('/cache/go/1.16.1/x64');
      findSpy.mockReturnValue(toolPath);
      dlSpy.mockImplementation(async () => '/some/temp/path');
      extractTarSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);

      await main.run();

      expect(logSpy).toHaveBeenCalledWith('Setup go version spec 1.16');
      expect(logSpy).toHaveBeenCalledWith(`Found in cache @ ${toolPath}`);
    });

    it('check latest version and install it from manifest', async () => {
      os.platform = 'linux';
      os.arch = 'x64';

      const versionSpec = '1.17';
      const patchVersion = '1.17.6';
      inputs['go-version'] = versionSpec;
      inputs['stable'] = 'true';
      inputs['check-latest'] = true;

      findSpy.mockImplementation(() => '');
      dlSpy.mockImplementation(async () => '/some/temp/path');
      const toolPath = path.normalize('/cache/go/1.17.6/x64');
      extractTarSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);

      await main.run();

      expect(logSpy).toHaveBeenCalledWith(
        `Setup go version spec ${versionSpec}`
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Attempting to resolve the latest version from the manifest...'
      );
      expect(logSpy).toHaveBeenCalledWith(`Resolved as '${patchVersion}'`);
      expect(logSpy).toHaveBeenCalledWith(
        `Attempting to download ${patchVersion}...`
      );
      expect(logSpy).toHaveBeenCalledWith('Extracting Go...');
      expect(logSpy).toHaveBeenCalledWith('Adding to the cache ...');
      expect(logSpy).toHaveBeenCalledWith('Added go to the path');
      expect(logSpy).toHaveBeenCalledWith(
        `Successfully set up Go version ${versionSpec}`
      );
    });

    it('fallback to dist if version is not found in manifest', async () => {
      os.platform = 'linux';
      os.arch = 'x64';

      const versionSpec = '1.13';

      inputs['go-version'] = versionSpec;
      inputs['check-latest'] = true;
      inputs['always-auth'] = false;
      inputs['token'] = 'faketoken';

      // ... but not in the local cache
      findSpy.mockImplementation(() => '');

      dlSpy.mockImplementation(async () => '/some/temp/path');
      const toolPath = path.normalize('/cache/go/1.13.7/x64');
      extractTarSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);

      await main.run();

      const expPath = path.join(toolPath, 'bin');

      expect(dlSpy).toHaveBeenCalled();
      expect(extractTarSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'Attempting to resolve the latest version from the manifest...'
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Failed to resolve version ${versionSpec} from manifest`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Attempting to download ${versionSpec}...`
      );
      expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
    });

    it('fallback to dist if manifest is not available', async () => {
      os.platform = 'linux';
      os.arch = 'x64';

      const versionSpec = '1.13';

      process.env['GITHUB_PATH'] = '';

      inputs['go-version'] = versionSpec;
      inputs['check-latest'] = true;
      inputs['always-auth'] = false;
      inputs['token'] = 'faketoken';

      // ... but not in the local cache
      findSpy.mockImplementation(() => '');
      getManifestSpy.mockImplementation(() => {
        throw new Error('Unable to download manifest');
      });
      httpmGetJsonSpy.mockRejectedValue(
        new Error('Unable to download manifest from raw URL')
      );
      getAllVersionsSpy.mockImplementationOnce(() => undefined);

      dlSpy.mockImplementation(async () => '/some/temp/path');
      const toolPath = path.normalize('/cache/go/1.13.7/x64');
      extractTarSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);

      await main.run();

      const expPath = path.join(toolPath, 'bin');

      expect(logSpy).toHaveBeenCalledWith(
        `Failed to resolve version ${versionSpec} from manifest`
      );
      expect(dlSpy).toHaveBeenCalled();
      expect(extractTarSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'Attempting to resolve the latest version from the manifest...'
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Unable to resolve a version from the manifest...'
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Failed to resolve version ${versionSpec} from manifest`
      );
      expect(logSpy).toHaveBeenCalledWith(
        `Attempting to download ${versionSpec}...`
      );

      expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
    });
  });

  describe('go-version-file', () => {
    const goModContents = `module example.com/mymodule

go 1.14

require (
	example.com/othermodule v1.2.3
	example.com/thismodule v1.2.3
	example.com/thatmodule v1.2.3
)

replace example.com/thatmodule => ../thatmodule
exclude example.com/thismodule v1.3.0
`;

    const goWorkContents = `go 1.19

use .

`;

    it('reads version from go.mod', async () => {
      inputs['go-version-file'] = 'go.mod';
      existsSpy.mockImplementation(() => true);
      readFileSpy.mockImplementation(() => Buffer.from(goModContents));

      await main.run();

      expect(logSpy).toHaveBeenCalledWith('Setup go version spec 1.14');
      expect(logSpy).toHaveBeenCalledWith('Attempting to download 1.14...');
      expect(logSpy).toHaveBeenCalledWith('matching 1.14...');
    });

    it('reads version from go.work', async () => {
      inputs['go-version-file'] = 'go.work';
      existsSpy.mockImplementation(() => true);
      readFileSpy.mockImplementation(() => Buffer.from(goWorkContents));

      await main.run();

      expect(logSpy).toHaveBeenCalledWith('Setup go version spec 1.19');
      expect(logSpy).toHaveBeenCalledWith('Attempting to download 1.19...');
      expect(logSpy).toHaveBeenCalledWith('matching 1.19...');
    });

    it('reads version from .go-version', async () => {
      inputs['go-version-file'] = '.go-version';
      existsSpy.mockImplementation(() => true);
      readFileSpy.mockImplementation(() => Buffer.from(`1.13.0${osm.EOL}`));

      await main.run();

      expect(logSpy).toHaveBeenCalledWith('Setup go version spec 1.13.0');
      expect(logSpy).toHaveBeenCalledWith('Attempting to download 1.13.0...');
      expect(logSpy).toHaveBeenCalledWith('matching 1.13.0...');
    });

    it('is overwritten by go-version', async () => {
      inputs['go-version'] = '1.13.1';
      inputs['go-version-file'] = 'go.mod';
      existsSpy.mockImplementation(() => true);
      readFileSpy.mockImplementation(() => Buffer.from(goModContents));

      await main.run();

      expect(logSpy).toHaveBeenCalledWith('Setup go version spec 1.13.1');
      expect(logSpy).toHaveBeenCalledWith('Attempting to download 1.13.1...');
      expect(logSpy).toHaveBeenCalledWith('matching 1.13.1...');
    });

    it('reports a read failure', async () => {
      inputs['go-version-file'] = 'go.mod';
      existsSpy.mockImplementation(() => false);

      await main.run();

      expect(cnSpy).toHaveBeenCalledWith(
        `::error::The specified go version file at: go.mod does not exist${osm.EOL}`
      );
    });

    it('acquires specified architecture of go', async () => {
      for (const {arch, version, osSpec} of [
        {arch: 'amd64', version: '1.13.7', osSpec: 'linux'},
        {arch: 'armv6l', version: '1.12.2', osSpec: 'linux'}
      ]) {
        os.platform = osSpec;
        os.arch = arch;

        const fileExtension = os.platform === 'win32' ? 'zip' : 'tar.gz';

        const platform = os.platform === 'win32' ? 'win' : os.platform;

        inputs['go-version'] = version;
        inputs['architecture'] = arch;

        const expectedUrl =
          platform === 'win32'
            ? `https://github.com/actions/go-versions/releases/download/${version}/go-${version}-${platform}-${arch}.${fileExtension}`
            : `https://storage.googleapis.com/golang/go${version}.${osSpec}-${arch}.${fileExtension}`;

        // ... but not in the local cache
        findSpy.mockImplementation(() => '');

        dlSpy.mockImplementation(async () => '/some/temp/path');
        const toolPath = path.normalize(`/cache/go/${version}/${arch}`);
        cacheSpy.mockImplementation(async () => toolPath);

        await main.run();

        expect(logSpy).toHaveBeenCalledWith(
          `Acquiring go${version} from ${expectedUrl}`
        );
      }
    }, 100000);

    it.each(['stable', 'oldstable'])(
      'acquires latest go version with %s go-version input',
      async (alias: string) => {
        const arch = 'x64';
        os.platform = 'darwin';
        os.arch = arch;

        inputs['go-version'] = alias;
        inputs['architecture'] = os.arch;

        // ... but not in the local cache
        findSpy.mockImplementation(() => '');

        dlSpy.mockImplementation(async () => '/some/temp/path');
        const toolPath = path.normalize(`/cache/go/${alias}/${arch}`);
        cacheSpy.mockImplementation(async () => toolPath);

        await main.run();

        const releaseIndex = alias === 'stable' ? 0 : 1;

        expect(logSpy).toHaveBeenCalledWith(
          `${alias} version resolved as ${goTestManifest[releaseIndex].version}`
        );
      }
    );
  });
});
