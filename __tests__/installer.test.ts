import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');
import nock = require('nock');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');
const dataDir = path.join(__dirname, 'data');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;
import * as installer from '../src/installer';
import * as executil from '../src/executil';

const osarch = os.arch();
const IS_WINDOWS = process.platform === 'win32';
const goExe: string = IS_WINDOWS ? 'go.exe' : 'go';

const cleanup = async () => {
  await io.rmRF(toolDir);
  await io.rmRF(tempDir);
}
beforeAll(cleanup, 100000);
afterAll(cleanup, 100000);

let bootstrapCgo: string = '';
let bootstrapGo: string = '';
beforeAll(async () => {
  bootstrapGo = await io.which('go', false);
  if (!bootstrapGo) {
    return;
  }
  bootstrapCgo = await executil.goEnv('CGO_ENABLED', bootstrapGo);
  // Override the value for acquireGo, because running getGo tests
  // exports different GOROOT each time.
  const bootstrapGoroot = await executil.goEnv('GOROOT', bootstrapGo);
  process.env['GOROOT_BOOTSTRAP'] = bootstrapGoroot
})

const describeTable = describe.each([
  ['tip',    '+60f14fd', 'go1.13beta1', '0.0.0-devel.60f14fddfee107dedd76c0be6b422a3d8ccc841a'],
  ['tip',    '+a5bfd9d', 'go1.14beta1', '0.0.0-devel.a5bfd9da1d1b24f326399b6b75558ded14514f23'],
  ['latest', 'go1.13',   'n/a',         '1.13.0'],
  ['1.x',    'go1.13',   'n/a',         '1.13.0'],
  ['1.10.x', 'go1.10.8', 'n/a',         '1.10.8'],
  ['1.10.8', 'go1.10.8', 'n/a',         '1.10.8'],
  ['1.10',   'go1.10',   'n/a',         '1.10.0'],
]);
describeTable('Go %s (%s)', (version: string, goVersion: string, gitRef: string, normVersion: string) => {
  const gotip = version == 'tip';
  const cacheDir = gotip ? 'gotip' : 'go';
  const goRoot = path.join(toolDir, cacheDir, normVersion, osarch);
  const goTool = path.join(goRoot, 'bin', goExe);

  if (!gotip) {
    beforeAll(() => {
      nock('https://golang.org')
        .get('/dl/')
        .query({mode: 'json', include: 'all'})
        .replyWithFile(200, path.join(dataDir, 'golang-dl.json'));
    });
    afterAll(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });
  }

  const timeout = gotip ? 300000 : 100000;
  test('installation', async () => {
    const promise = installer.getGo(version, gitRef, bootstrapGo);
    await expect(promise).resolves.toBeUndefined();
  }, timeout);

  if (gotip) {
    const gitDir = path.join(toolDir, cacheDir, '0.0.0-devel', 'noarch');
    test('git cache check', async () => {
      const promise = fs.promises.access(gitDir);
      await expect(promise).resolves.toBeUndefined();
    });
  }

  test('tool existence check', async () => {
    const promise = fs.promises.access(goTool);
    await expect(promise).resolves.toBeUndefined();
  });

  test('cache completeness check', async () => {
    const promise = fs.promises.access(`${goRoot}.complete`);
    await expect(promise).resolves.toBeUndefined();
  });

  goVersion = ' ' + goVersion;
  if (!gotip) {
    goVersion += ' ';
  }
  test('version check', async () => {
    const promise = executil.stdout(goTool, ['version']);
    await expect(promise).resolves.toContain(goVersion);
  });

  if (!gotip) {
    return;
  }
  test('CGO_ENABLED check', async () => {
    const promise = executil.goEnv('CGO_ENABLED', goTool);
    await expect(promise).resolves.toBe(bootstrapCgo);
  });
});

describe('installer cache', () => {
  const version = '1000.0';
  const normVersion = '1000.0.0';
  const cacheDir = 'go';
  const goRoot = path.join(toolDir, cacheDir, normVersion, osarch);

  test('throws on incorrect version', async () => {
    const promise = installer.getGo(version);
    await expect(promise).rejects.toThrow();
  });

  test('throws on partial install', async () => {
    await io.mkdirP(goRoot);

    const promise = installer.getGo(version);
    await expect(promise).rejects.toThrow();
  })

  test('uses existing version', async () => {
    await fs.promises.writeFile(`${goRoot}.complete`, 'hello');

    const promise = installer.getGo(version);
    await expect(promise).resolves.toBeUndefined();
  });
});
