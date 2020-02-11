import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as installer from './installer';
import * as path from 'path';
import * as system from './system';

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

        // set GOPATH and GOBIN as user value
        const goPath: string = system.getGoPath();
        if (goPath) {
          core.exportVariable('GOPATH', goPath);
          core.addPath(path.join(goPath, 'bin'));
        }
        const goBin: string = process.env['GOBIN'] || '';
        if (goBin) {
          core.exportVariable('GOBIN', goBin);
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
