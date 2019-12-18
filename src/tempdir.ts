// See https://github.com/actions/toolkit/blob/17acd9c66fb3dd360ef8c65fcd7c3b864064b5c7/packages/tool-cache/src/tool-cache.ts#L20-L45

import * as path from 'path';
import * as io from '@actions/io';

export function tempDir(): string {
  let tempDirectory: string = process.env['RUNNER_TEMP'] || '';
  if (!tempDirectory) {
    let baseLocation: string;
    if (process.platform === 'win32') {
      // On windows use the USERPROFILE env variable.
      baseLocation = process.env['USERPROFILE'] || 'C:\\';
    } else {
      if (process.platform === 'darwin') {
        baseLocation = '/Users';
      } else {
        baseLocation = '/home';
      }
    }
    if (!tempDirectory) {
      tempDirectory = path.join(baseLocation, 'actions', 'temp');
    }
  }
  io.mkdirP(tempDirectory);
  return tempDirectory;
}
