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

const IS_WINDOWS = process.platform === 'win32';

describe('installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
  }, 100000);

  afterAll(async () => {
    try {
      await io.rmRF(toolDir);
      await io.rmRF(tempDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('Acquires version of go if no matching version is installed', async () => {
    await installer.getGo('1.10.8');
    const goDir = path.join(toolDir, 'go', '1.10.8', os.arch());

    expect(fs.existsSync(`${goDir}.complete`)).toBe(true);
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(goDir, 'bin', 'go.exe'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(goDir, 'bin', 'go'))).toBe(true);
    }
  }, 100000);

  describe('the latest release of a go version', () => {
    beforeEach(() => {
      nock('https://api.github.com')
        .get('/repos/golang/go/git/refs/tags')
        .replyWithFile(200, path.join(dataDir, 'golang-tags.json'));
    });

    afterEach(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('Acquires latest release version of go 1.10 if using 1.10 and no matching version is installed', async () => {
      await installer.getGo('1.10');
      const goDir = path.join(toolDir, 'go', '1.10.8', os.arch());

      expect(fs.existsSync(`${goDir}.complete`)).toBe(true);
      if (IS_WINDOWS) {
        expect(fs.existsSync(path.join(goDir, 'bin', 'go.exe'))).toBe(true);
      } else {
        expect(fs.existsSync(path.join(goDir, 'bin', 'go'))).toBe(true);
      }
    }, 100000);

    it('Acquires latest release version of go 1.10 if using 1.10.x and no matching version is installed', async () => {
      await installer.getGo('1.10.x');
      const goDir = path.join(toolDir, 'go', '1.10.8', os.arch());

      expect(fs.existsSync(`${goDir}.complete`)).toBe(true);
      if (IS_WINDOWS) {
        expect(fs.existsSync(path.join(goDir, 'bin', 'go.exe'))).toBe(true);
      } else {
        expect(fs.existsSync(path.join(goDir, 'bin', 'go'))).toBe(true);
      }
    }, 100000);

    it('Acquires latest release version of go if using 1.x and no matching version is installed', async () => {
      await installer.getGo('1.x');
      const goDir = path.join(toolDir, 'go', '1.13.0-beta1', os.arch());

      expect(fs.existsSync(`${goDir}.complete`)).toBe(true);
      if (IS_WINDOWS) {
        expect(fs.existsSync(path.join(goDir, 'bin', 'go.exe'))).toBe(true);
      } else {
        expect(fs.existsSync(path.join(goDir, 'bin', 'go'))).toBe(true);
      }
    }, 100000);
  });

  it('Throws if no location contains correct go version', async () => {
    let thrown = false;
    try {
      await installer.getGo('1000.0');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Uses version of go installed in cache', async () => {
    const goDir: string = path.join(toolDir, 'go', '250.0.0', os.arch());
    await io.mkdirP(goDir);
    fs.writeFileSync(`${goDir}.complete`, 'hello');
    // This will throw if it doesn't find it in the cache (because no such version exists)
    await installer.getGo('250.0');
    return;
  });

  it('Doesnt use version of go that was only partially installed in cache', async () => {
    const goDir: string = path.join(toolDir, 'go', '251.0.0', os.arch());
    await io.mkdirP(goDir);
    let thrown = false;
    try {
      // This will throw if it doesn't find it in the cache (because no such version exists)
      await installer.getGo('251.0');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    return;
  });
});
