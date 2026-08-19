import * as core from '@actions/core';
import * as io from '@actions/io';
import * as installer from './installer.js';
import * as semver from 'semver';
import path from 'path';
import {fileURLToPath} from 'url';
import {restoreCache} from './cache-restore.js';
import {isCacheFeatureAvailable} from './cache-utils.js';
import cp from 'child_process';
import fs from 'fs';
import os from 'os';
import {Architecture} from './types.js';

export async function run() {
  try {
    //
    // versionSpec is optional.  If supplied, install / use from the tool cache
    // If not supplied then problem matchers will still be setup.  Useful for self-hosted.
    //
    const {version: versionSpec, latestPatchApplied} = resolveVersionInput();
    setGoToolchain();

    const cache = core.getBooleanInput('cache');
    core.info(`Setup go version spec ${versionSpec}`);

    let arch = core.getInput('architecture') as Architecture;

    if (!arch) {
      arch = os.arch() as Architecture;
    }

    if (versionSpec) {
      const token = core.getInput('token');
      const auth = !token ? undefined : `token ${token}`;

      let checkLatest = core.getBooleanInput('check-latest');
      if (latestPatchApplied && !checkLatest) {
        // the runner's tool cache may only hold a stale patch release; the
        // newest one has to come from the versions manifest
        core.info(
          'go-version-file-behavior: latest-patch implies check-latest'
        );
        checkLatest = true;
      }

      const goDownloadBaseUrl =
        core.getInput('go-download-base-url') ||
        process.env['GO_DOWNLOAD_BASE_URL'] ||
        undefined;

      if (goDownloadBaseUrl) {
        core.info(`Using custom Go download base URL: ${goDownloadBaseUrl}`);
      }

      const installDir = await installer.getGo(
        versionSpec,
        checkLatest,
        auth,
        arch,
        goDownloadBaseUrl,
        latestPatchApplied
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
    const matchersPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../..',
      'matchers.json'
    );
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

interface ResolvedVersionInput {
  version: string;
  // true when latest-patch widened the version into a range; the newest
  // matching patch must then be resolved from the versions manifest, not
  // just the runner's local tool cache
  latestPatchApplied: boolean;
}

function resolveVersionInput(): ResolvedVersionInput {
  let version = core.getInput('go-version');
  const versionFilePath = core.getInput('go-version-file');

  const behavior = core.getInput('go-version-file-behavior') || 'exact';
  if (behavior !== 'exact' && behavior !== 'latest-patch') {
    throw new Error(
      `Invalid go-version-file-behavior: '${behavior}'. Supported values: 'exact', 'latest-patch'`
    );
  }

  if (version && versionFilePath) {
    core.warning(
      'Both go-version and go-version-file inputs are specified, only go-version will be used'
    );
  }

  if (version) {
    return {version, latestPatchApplied: false};
  }

  if (versionFilePath) {
    if (!fs.existsSync(versionFilePath)) {
      throw new Error(
        `The specified go version file at: ${versionFilePath} does not exist`
      );
    }
    const versionFile = installer.parseGoVersionFile(versionFilePath);
    version = versionFile.version;

    if (behavior === 'latest-patch' && version) {
      if (versionFile.fromToolchainDirective) {
        core.info(
          `Using toolchain directive version ${version} as written (latest-patch does not widen an explicit toolchain pin)`
        );
      } else {
        const spec = installer.latestPatchSpec(version);
        if (spec === version) {
          core.info(
            `Using version ${version} as written (latest-patch only widens exact major.minor.patch versions)`
          );
        } else {
          if (
            core.getInput('go-download-base-url') ||
            process.env['GO_DOWNLOAD_BASE_URL']
          ) {
            throw new Error(
              `go-version-file-behavior: 'latest-patch' is not supported with a custom download base URL because version ranges cannot be resolved against it. Use the default 'exact' behavior.`
            );
          }
          core.info(
            `Using latest patch release satisfying ${spec} (version file specifies ${version})`
          );
          return {version: spec, latestPatchApplied: true};
        }
      }
    }
  }

  return {version, latestPatchApplied: false};
}

function setGoToolchain() {
  // docs: https://go.dev/doc/toolchain
  // "local indicates the bundled Go toolchain (the one that shipped with the go command being run)"
  // this is so any 'go' command is run with the selected Go version
  // and doesn't trigger a toolchain download and run commands with that
  // see e.g. issue #424
  // and a similar discussion: https://github.com/docker-library/golang/issues/472.
  // Set the value in process env so any `go` commands run as child-process
  // don't cause toolchain downloads
  process.env[installer.GOTOOLCHAIN_ENV_VAR] = installer.GOTOOLCHAIN_LOCAL_VAL;
  // and in the runner env so e.g. a user running `go mod tidy` won't cause it
  core.exportVariable(
    installer.GOTOOLCHAIN_ENV_VAR,
    installer.GOTOOLCHAIN_LOCAL_VAL
  );
}
