import * as core from '@actions/core';
import * as io from '@actions/io';
import * as installer from './installer';
import path from 'path';
import cp from 'child_process';
import fs from 'fs';
import {URL} from 'url';

export async function run() {
  try {
    //
    // versionSpec is optional.  If supplied, install / use from the tool cache
    // If not supplied then problem matchers will still be setup.  Useful for self-hosted.
    //
    let versionSpec = core.getInput('go-version');

    // stable will be true unless false is the exact input
    // since getting unstable versions should be explicit
    let stable = (core.getInput('stable') || 'true').toUpperCase() === 'TRUE';

    core.info(`Setup go ${stable ? 'stable' : ''} version spec ${versionSpec}`);

    if (versionSpec) {
      let token = core.getInput('token');
      let auth = !token || isGhes() ? undefined : `token ${token}`;

      // Tool cache can be stale in GitHub and self-hosted runners. If supplied
      // `go-version` is a semver range--instead of an explicit version--it will
      // be tried through the version inventory in cache, first. Even though
      // the GitHub local copy or origin distribution may have newer versions
      // matching the passed range, as long as the cache can satisfy the range,
      // the latest version from cache will be used.
      //
      // Allow passing a prefered version inventory for resolving versionSpec.
      // - "manifest": GitHub hosted (@actions/go-versions)
      // - "dist": Origin (https://golang.org/dl/?mode=json&include=all)
      let resolver = core.getInput('version-resolver');
      if (resolver && resolver != 'manifest' && resolver != 'dist') {
        throw new Error(`Unknown version-resolver: '${resolver}'`);
      }

      const installDir = await installer.getGo(
        versionSpec,
        resolver,
        stable,
        auth
      );

      core.exportVariable('GOROOT', installDir);
      core.addPath(path.join(installDir, 'bin'));
      core.info('Added go to the path');

      let added = await addBinToPath();
      core.debug(`add bin ${added}`);
      core.info(`Successfully setup go version ${versionSpec}`);
    }

    // add problem matchers
    const matchersPath = path.join(__dirname, '..', 'matchers.json');
    core.info(`##[add-matcher]${matchersPath}`);

    // output the version actually being used
    let goPath = await io.which('go');
    let goVersion = (cp.execSync(`${goPath} version`) || '').toString();
    core.info(goVersion);

    core.startGroup('go env');
    let goEnv = (cp.execSync(`${goPath} env`) || '').toString();
    core.info(goEnv);
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
}

export async function addBinToPath(): Promise<boolean> {
  let added = false;
  let g = await io.which('go');
  core.debug(`which go :${g}:`);
  if (!g) {
    core.debug('go not in the path');
    return added;
  }

  let buf = cp.execSync('go env GOPATH');
  if (buf) {
    let gp = buf.toString().trim();
    core.debug(`go env GOPATH :${gp}:`);
    if (!fs.existsSync(gp)) {
      // some of the hosted images have go install but not profile dir
      core.debug(`creating ${gp}`);
      io.mkdirP(gp);
    }

    let bp = path.join(gp, 'bin');
    if (!fs.existsSync(bp)) {
      core.debug(`creating ${bp}`);
      io.mkdirP(bp);
    }

    core.addPath(bp);
    added = true;
  }
  return added;
}

function isGhes(): boolean {
  const ghUrl = new URL(
    process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  );
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM';
}
