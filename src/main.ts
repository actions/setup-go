import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as installer from './installer';
import path from 'path';
import cp from 'child_process';
import fs from 'fs';

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

    console.log(
      `Setup go ${stable ? 'stable' : ''} version spec ${versionSpec}`
    );

    if (versionSpec) {
      let installDir: string | undefined = tc.find('go', versionSpec);

      if (!installDir) {
        console.log(
          `A version satisfying ${versionSpec} not found locally, attempting to download ...`
        );
        installDir = await installer.downloadGo(versionSpec, stable);
        console.log('Installed');
      }

      if (installDir) {
        core.exportVariable('GOROOT', installDir);
        core.addPath(path.join(installDir, 'bin'));
        console.log('Added go to the path');

        let added = addBinToPath();
        core.debug(`add bin ${added}`);
      } else {
        throw new Error(
          `Could not find a version that satisfied version spec: ${versionSpec}`
        );
      }
    }

    // add problem matchers
    const matchersPath = path.join(__dirname, '..', 'matchers.json');
    console.log(`##[add-matcher]${matchersPath}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

export async function addBinToPath(): Promise<boolean> {
  let added = false;
  let g = await io.which('go');
  _debug(`which go :${g}:`);
  if (!g) {
    _debug('go not in the path');
    return added;
  }

  let buf = cp.execSync('go env GOPATH');
  if (buf) {
    let gp = buf.toString().trim();
    _debug(`go env GOPATH :${gp}:`);
    if (!fs.existsSync(gp)) {
      // some of the hosted images have go install but not profile dir
      _debug(`creating ${gp}`);
      io.mkdirP(gp);
    }

    let bp = path.join(gp, 'bin');
    if (!fs.existsSync(bp)) {
      _debug(`creating ${bp}`);
      io.mkdirP(bp);
    }

    core.addPath(bp);
    added = true;
  }
  return added;
}

export function _debug(message: string) {
  core.debug(message);
}
