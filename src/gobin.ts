import * as childProcess from 'child_process';
import * as path from 'path';
import {promisify} from 'util';

const exec = promisify(childProcess.exec);

export async function getGOBIN(installDir: string): Promise<string> {
  const goExecutable = path.join(installDir, 'bin', 'go');

  const result = await exec(`${goExecutable} env GOPATH`);
  const gopath = result.stdout;
  return path.join(gopath, 'bin');
}
