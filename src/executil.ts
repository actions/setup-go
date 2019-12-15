import * as exec from '@actions/exec';

export async function stdout(cmd: string, args: string[]): Promise<string> {
  let s: string = '';
  // For some strange reason, exec ignores process.env
  // unless we pass it explicitly.
  const env: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) {
      continue;
    }
    env[key] = value;
  }
  await exec.exec(cmd, args, {
    env,
    silent: true,
    listeners: {
      stdout: (buf: Buffer) => {
        s += buf.toString();
      },
    },
  });
  return s;
}

export async function git(args: string[], opts?: any) {
  let rc: number = await exec.exec('git', args, opts);
  if (rc != 0) {
    throw new Error(`git: exit code ${rc}`);
  }
}

export async function gitClone(gitDir: string, gitRepo: string, workTree: string, ref: string) {
  let args: string[] = [
    'clone',
    `--branch=${ref}`,
    `--separate-git-dir=${gitDir}`,
    '--depth=1',
    '--',
    gitRepo,
    workTree,
  ];
  await git(args);
}

export async function gitFetch(gitDir: string) {
  let args: string[] = [
    `--git-dir=${gitDir}`,
    'fetch',
    '--depth=1',
  ];
  await git(args);
}

export async function gitRevParse(gitDir: string, spec: string): Promise<string> {
  let args: string[] = [
    `--git-dir=${gitDir}`,
    'rev-parse',
    '--verify',
    spec,
  ];
  let hash = await stdout('git', args);
  return hash.trim();
}

export async function gitReset(gitDir: string, workTree: string, spec: string) {
  let args: string[] = [
    `--git-dir=${gitDir}`,
    `--work-tree=${workTree}`,
    'reset',
    '--hard',
    spec,
  ];
  await git(args);
}

export async function goEnv(envVar: string, goExe: string = 'go'): Promise<string> {
  let envVal = await stdout(goExe, ['env', '--', envVar]);
  return envVal.trim();
}
