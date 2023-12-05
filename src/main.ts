import * as core from '@actions/core';
import * as io from '@actions/io';
import * as installer from './installer';
import * as semver from 'semver';
import path from 'path';
import {restoreCache} from './cache-restore';
import {isCacheFeatureAvailable} from './cache-utils';
import cp from 'child_process';
import fs from 'fs';
import os from 'os';

export async function run() {
  try {
    //
    // versionSpec is optional.  If supplied, install / use from the tool cache
    // If not supplied then problem matchers will still be setup.  Useful for self-hosted.
    //
    const versionSpec = resolveVersionInput();

    const cache = core.getBooleanInput('cache');
    core.info(`Setup go version spec ${versionSpec}`);

    let arch = core.getInput('architecture');

    if (!arch) {
      arch = os.arch();
    }

    if (versionSpec) {
      const token = core.getInput('token');
      const auth = !token ? undefined : `token ${token}`;

      const checkLatest = core.getBooleanInput('check-latest');

      const installDir = await installer.getGo(
        versionSpec,
        checkLatest,
        auth,
        arch
      );

      const installDirVersion = path.basename(path.dirname(installDir));

      core.addPath(path.join(installDir, 'bin'));
      core.info('Added go to the path');

      const version = installer.makeSemver(installDirVersion);
      // Go versions less than 1.9 require GOROOT to be set
      if (semver.lt(version, '1.9.0')) {
        core.info('Setting GOROOT for Go version < 1.9');
        core.exportVariable('GOROOT', installDir);
      }

      core.info(`Successfully set up Go version ${versionSpec}`);
    } else {
      core.info(
        '[warning]go-version input was not specified. The action will try to use pre-installed version.'
      );
    }

    const added = await addBinToPath();
    core.debug(`add bin ${added}`);

    const goPath = await io.which('go');
    const goVersion = (cp.execSync(`${goPath} version`) || '').toString();

    if (cache && isCacheFeatureAvailable()) {
      const packageManager = 'default';
      const cacheDependencyPath = core.getInput('cache-dependency-path');
      try {
        await restoreCache(
          parseGoVersion(goVersion),
          packageManager,
          cacheDependencyPath
        );
      } catch (error) {
        core.warning(`Restore cache failed: ${(error as Error).message}`);
      }
    }

    // add problem matchers
    const matchersPath = path.join(__dirname, '../..', 'matchers.json');
    core.info(`##[add-matcher]${matchersPath}`);

    // output the version actually being used
    core.info(goVersion);

    core.setOutput('go-version', parseGoVersion(goVersion));

    core.startGroup('go env');
    const goEnv = (cp.execSync(`${goPath} env`) || '').toString();
    core.info(goEnv);
    core.endGroup();
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

export async function addBinToPath(): Promise<boolean> {
  let added = false;
  const g = await io.which('go');
  core.debug(`which go :${g}:`);
  if (!g) {
    core.debug('go not in the path');
    return added;
  }

  const buf = cp.execSync('go env GOPATH');
  if (buf.length > 1) {
    const gp = buf.toString().trim();
    core.debug(`go env GOPATH :${gp}:`);
    if (!fs.existsSync(gp)) {
      // some of the hosted images have go install but not profile dir
      core.debug(`creating ${gp}`);
      await io.mkdirP(gp);
    }

    const bp = path.join(gp, 'bin');
    if (!fs.existsSync(bp)) {
      core.debug(`creating ${bp}`);
      await io.mkdirP(bp);
    }

    core.addPath(bp);
    added = true;
  }
  return added;
}

export function parseGoVersion(versionString: string): string {
  // get the installed version as an Action output
  // based on go/src/cmd/go/internal/version/version.go:
  // fmt.Printf("go version %s %s/%s\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)
  // expecting go<version> for runtime.Version()
  return versionString.split(' ')[2].slice('go'.length);
}

function resolveVersionInput(): string {
  let version = core.getInput('go-version');
  const versionFilePath = core.getInput('go-version-file');

  if (version && versionFilePath) {
    core.warning(
      'Both go-version and go-version-file inputs are specified, only go-version will be used'
    );
  }

  if (version) {
    return version;
  }

  if (versionFilePath) {
    if (!fs.existsSync(versionFilePath)) {
      throw new Error(
        `The specified go version file at: ${versionFilePath} does not exist`
      );
    }
    version = installer.parseGoVersionFile(versionFilePath);
  }

  return version;
}
