import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as installer from './installer';
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

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

    // if there's a globally install go and bin path, prefer that
    let addedBin = addBinToPath();
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

        // if the global installed bin wasn't added,
        // we can add the bin just installed
        if (!addedBin) {
          addBinToPath();
        }
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

function addBinToPath(): boolean {
  let added = false;
  let buf = cp.execSync('go env GOPATH');
  if (buf) {
    let d = buf.toString().trim();
    let bp = path.join(d, 'bin');
    if (fs.existsSync(bp)) {
      core.addPath(bp);
      added = true;
    }
  }
  return added;
}
