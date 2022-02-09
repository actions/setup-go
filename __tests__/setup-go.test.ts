import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import cp from 'child_process';
import osm from 'os';
import path from 'path';
import * as main from '../src/main';
import * as im from '../src/installer';

let goJsonData = require('./data/golang-dl.json');
let matchers = require('../matchers.json');
let goTestManifest = require('./data/versions-manifest.json');
let matcherPattern = matchers.problemMatcher[0].pattern[0];
let matcherRegExp = new RegExp(matcherPattern.regexp);

describe('setup-go', () => {
  let inputs = {} as any;
  let os = {} as any;

  let inSpy: jest.SpyInstance;
  let getBooleanInputSpy: jest.SpyInstance;
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
  let getManifestSpy: jest.SpyInstance;

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
    getSpy = jest.spyOn(im, 'getVersionsDist');
    getManifestSpy = jest.spyOn(tc, 'getManifestFromRepo');

    // io
    whichSpy = jest.spyOn(io, 'which');
    existsSpy = jest.spyOn(fs, 'existsSync');
    mkdirpSpy = jest.spyOn(io, 'mkdirP');

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
      process.stderr.write('log:' + line + '\n');
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

  afterAll(async () => {
    jest.restoreAllMocks();
  }, 100000);

  it('can find 1.9.7 from manifest on osx', async () => {
    os.platform = 'darwin';
    os.arch = 'x64';

    let match = await im.getInfoFromManifest('1.9.7', true, 'mocktoken');
    expect(match).toBeDefined();
    expect(match!.resolvedVersion).toBe('1.9.7');
    expect(match!.type).toBe('manifest');
    expect(match!.downloadUrl).toBe(
      'https://github.com/actions/go-versions/releases/download/1.9.7/go-1.9.7-darwin-x64.tar.gz'
    );
  });

  it('can find 1.9 from manifest on linux', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    let match = await im.getInfoFromManifest('1.9.7', true, 'mocktoken');
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

    let match = await im.getInfoFromManifest('1.9.7', true, 'mocktoken');
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
    expect(logSpy).toHaveBeenCalledWith(`Found in cache @ ${toolPath}`);
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
      `::error::Unable to find Go version '9.99.9' for platform linux and architecture x64.${osm.EOL}`
    );
  });

  it('downloads a version from a manifest match', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    let versionSpec = '1.12.16';

    inputs['go-version'] = versionSpec;
    inputs['token'] = 'faketoken';

    let expectedUrl =
      'https://github.com/actions/go-versions/releases/download/1.12.16-20200616.20/go-1.12.16-linux-x64.tar.gz';

    // ... but not in the local cache
    findSpy.mockImplementation(() => '');

    dlSpy.mockImplementation(async () => '/some/temp/path');
    let toolPath = path.normalize('/cache/go/1.12.16/x64');
    exSpy.mockImplementation(async () => '/some/other/temp/path');
    cacheSpy.mockImplementation(async () => toolPath);

    await main.run();

    let expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(exSpy).toHaveBeenCalled();
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

    let versionSpec = '1.12';

    inputs['go-version'] = versionSpec;
    inputs['token'] = 'faketoken';

    let expectedUrl =
      'https://github.com/actions/go-versions/releases/download/1.12.17-20200616.21/go-1.12.17-linux-x64.tar.gz';

    // ... but not in the local cache
    findSpy.mockImplementation(() => '');

    dlSpy.mockImplementation(async () => '/some/temp/path');
    let toolPath = path.normalize('/cache/go/1.12.17/x64');
    exSpy.mockImplementation(async () => '/some/other/temp/path');
    cacheSpy.mockImplementation(async () => toolPath);

    await main.run();

    let expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(exSpy).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalledWith(
      'Not found in manifest.  Falling back to download directly from Go'
    );
    expect(logSpy).toHaveBeenCalledWith(
      `Acquiring 1.12.17 from ${expectedUrl}`
    );

    expect(logSpy).toHaveBeenCalledWith(`Added go to the path`);
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('falls back to a version from node dist', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    let versionSpec = '1.12.14';

    inputs['go-version'] = versionSpec;
    inputs['token'] = 'faketoken';

    let expectedUrl =
      'https://github.com/actions/go-versions/releases/download/1.12.14-20200616.18/go-1.12.14-linux-x64.tar.gz';

    // ... but not in the local cache
    findSpy.mockImplementation(() => '');

    dlSpy.mockImplementation(async () => '/some/temp/path');
    let toolPath = path.normalize('/cache/go/1.12.14/x64');
    exSpy.mockImplementation(async () => '/some/other/temp/path');
    cacheSpy.mockImplementation(async () => toolPath);

    await main.run();

    let expPath = path.join(toolPath, 'bin');
    expect(logSpy).toHaveBeenCalledWith('Setup go stable version spec 1.12.14');
    expect(findSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Attempting to download 1.12.14...');
    expect(dlSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('matching 1.12.14...');
    expect(exSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Not found in manifest.  Falling back to download directly from Go'
    );
    expect(logSpy).toHaveBeenCalledWith(`Install from dist`);
    expect(logSpy).toHaveBeenCalledWith(`Added go to the path`);
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
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

  interface Annotation {
    file: string;
    line: number;
    column: number;
    message: string;
  }

  //
  // problem matcher regex pattern tests

  function testMatch(line: string): Annotation {
    let annotation = <Annotation>{};

    let match = matcherRegExp.exec(line);
    if (match) {
      annotation.line = parseInt(match[matcherPattern.line], 10);
      annotation.column = parseInt(match[matcherPattern.column], 10);
      annotation.file = match[matcherPattern.file].trim();
      annotation.message = match[matcherPattern.message].trim();
    }

    return annotation;
  }

  it('matches on relative unix path', async () => {
    let line = './main.go:13:2: undefined: fmt.Printl';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('./main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on unix path up the tree', async () => {
    let line = '../main.go:13:2: undefined: fmt.Printl';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('../main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on unix path down the tree', async () => {
    let line = 'foo/main.go:13:2: undefined: fmt.Printl';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('foo/main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on rooted unix path', async () => {
    let line = '/assert.go:4:1: missing return at end of function';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(4);
    expect(annotation.column).toBe(1);
    expect(annotation.file).toBe('/assert.go');
    expect(annotation.message).toBe('missing return at end of function');
  });

  it('matches on unix path with spaces', async () => {
    let line = '   ./assert.go:5:2: missing return at end of function   ';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(5);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('./assert.go');
    expect(annotation.message).toBe('missing return at end of function');
  });

  it('matches on unix path with tabs', async () => {
    let line = '\t./assert.go:5:2: missing return at end of function   ';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(5);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('./assert.go');
    expect(annotation.message).toBe('missing return at end of function');
  });

  it('matches on relative windows path', async () => {
    let line = '.\\main.go:13:2: undefined: fmt.Printl';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('.\\main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
  });

  it('matches on windows path up the tree', async () => {
    let line = '..\\main.go:13:2: undefined: fmt.Printl';
    let annotation = testMatch(line);
    expect(annotation).toBeDefined();
    expect(annotation.line).toBe(13);
    expect(annotation.column).toBe(2);
    expect(annotation.file).toBe('..\\main.go');
    expect(annotation.message).toBe('undefined: fmt.Printl');
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
      exSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);

      await main.run();

      expect(logSpy).toHaveBeenCalledWith('Setup go stable version spec 1.16');
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
      const toolPath = path.normalize('/cache/go/1.17.5/x64');
      exSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);
      const expectedUrl =
        'https://github.com/actions/go-versions/releases/download/1.17.6-1668090892/go-1.17.6-darwin-x64.tar.gz';

      await main.run();

      expect(logSpy).toHaveBeenCalledWith(
        `Setup go stable version spec ${versionSpec}`
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
        `Successfully setup go version ${versionSpec}`
      );
    });

    it('fallback to dist if version is not found in manifest', async () => {
      os.platform = 'linux';
      os.arch = 'x64';

      let versionSpec = '1.13';

      inputs['go-version'] = versionSpec;
      inputs['check-latest'] = true;
      inputs['always-auth'] = false;
      inputs['token'] = 'faketoken';

      // ... but not in the local cache
      findSpy.mockImplementation(() => '');

      dlSpy.mockImplementation(async () => '/some/temp/path');
      let toolPath = path.normalize('/cache/go/1.13.7/x64');
      exSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);

      await main.run();

      let expPath = path.join(toolPath, 'bin');

      expect(dlSpy).toHaveBeenCalled();
      expect(exSpy).toHaveBeenCalled();
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

      let versionSpec = '1.13';

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

      dlSpy.mockImplementation(async () => '/some/temp/path');
      let toolPath = path.normalize('/cache/go/1.13.7/x64');
      exSpy.mockImplementation(async () => '/some/other/temp/path');
      cacheSpy.mockImplementation(async () => toolPath);

      await main.run();

      let expPath = path.join(toolPath, 'bin');

      expect(logSpy).toHaveBeenCalledWith(
        `Failed to resolve version ${versionSpec} from manifest`
      );
      expect(dlSpy).toHaveBeenCalled();
      expect(exSpy).toHaveBeenCalled();
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
});
