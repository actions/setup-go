import * as childProcess from 'child_process';
import * as path from 'path';
import {promisify} from 'util';

const execFile = promisify(childProcess.execFile);

export async function getGOBIN(installDir: string): Promise<string> {
  const goExecutable = path.join(installDir, 'bin', 'go');

  const result = await execFile(goExecutable, ['env', 'GOPATH']);
  const gopath = result.stdout.replace(/\s+$/, '');
  return path.join(gopath, 'bin');
}
