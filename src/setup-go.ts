import * as core from '@actions/core';
import * as installer from './installer';
import * as path from 'path';

async function run() {
  try {
    //
    // Version is optional.  If supplied, install / use from the tool cache
    // If not supplied then task is still used to setup proxy, auth, etc...
    //
    let version = core.getInput('version');
    if (!version) {
      version = core.getInput('go-version');
    }
    if (version) {
      await installer.getGo(version);
    }

    // TODO: setup proxy from runner proxy config

    const matchersPath = path.join(__dirname, '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'go.json')}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
