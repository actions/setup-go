import * as tempdir from './tempdir';
import * as executil from './executil';

// Load tempDirectory before it gets wiped by tool-cache
const tempDirectory = tempdir.tempDir();

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as semver from 'semver';
import * as restm from 'typed-rest-client/RestClient';

let osPlat: string = os.platform();
let osArch: string = os.arch();

export async function getGo(version: string, gotipRef: string = 'master', bootstrapGo: string = 'go') {
  const selected = await determineVersion(version);
  if (selected) {
    version = selected;
  }

  let toolPath = await acquireGo(version, gotipRef, bootstrapGo);
  core.debug(`Using Go toolchain under ${toolPath}`);

  await setGoEnvironmentVariables(version, toolPath, bootstrapGo);
}

async function acquireGo(version: string, gotipRef: string, bootstrapGo: string): Promise<string> {
  const normVersion = normalizeVersion(version);

  // Let tool-cache fail when we are not using tip.
  // Otherwise throw an error, because we don’t
  // have a temporary directory for Git clone.
  let extPath = tempDirectory;
  if (version == 'gotip') {
    if (!extPath) {
      throw new Error('Temp directory not set');
    }
  }

  // We are doing incremental updates/fetch for tip,
  // this check is a fast path for stable releases.
  if (version != 'tip') {
    const toolRootCache = tc.find('go', normVersion);
    if (toolRootCache) {
      return toolRootCache;
    }
  }

  // This will give us archive name and URL for releases,
  // and Git work tree dir name and clone URL and for tip.
  const filename = getFileName(version);
  const downloadUrl = getDownloadUrl(version, filename);

  // Extract release builds. In case of tip, build from source.
  let toolRoot: string;
  if (version == 'tip') {
      let gitDir: string;
      let workTree: string;
      let commitHash: string;
      // Avoid cloning multiple times by caching git dir.
      // Empty string means that we don’t care about arch.
      gitDir = tc.find('gotip', 'master', '')
      if (!gitDir) {
        gitDir = path.join(extPath, 'gotip.git');
        workTree = path.join(extPath, filename);

        // Clone repo with separate git dir.
        await executil.gitClone(gitDir, downloadUrl, workTree, gotipRef);

        // Extract current commit hash.
        commitHash = await executil.gitRevParse(gitDir, 'HEAD');
      } else {
        // We don’t have a work tree (yet) in this case.
        workTree = '';

        // Cache hit for git dir, fetch new commits from upstream.
        await executil.gitFetch(gitDir);

        // Extract latest commit hash.
        commitHash = await executil.gitRevParse(gitDir, 'FETCH_HEAD');
      }
      // Update cache for git dir.
      gitDir = await tc.cacheDir(gitDir, 'gotip', 'master', '');

      // Avoid building multiple times by caching work tree.
      let workTreeCache = tc.find('gotip', commitHash);
      if (workTreeCache) {
        workTree = workTreeCache;
      } else {
        if (!workTree) {
          // We found gotip.git in cache, but not the work tree.
          //
          workTree = path.join(extPath, filename);
          // Work tree must exist, otherwise Git will complain
          // that “this operation must be run in a work tree”.
          await io.mkdirP(workTree);

          // Hard reset to the latest commit.
          await executil.gitReset(gitDir, workTree, commitHash);
        }

        // The make.bat script on Windows is not smart enough
        // to figure out the path to bootstrap Go toolchain.
        // Make script will show descriptive error message even
        // if we don’t find Go installation on the host.
        let bootstrap: string = '';
        if (bootstrapGo) {
          bootstrap = await executil.goEnv('GOROOT', bootstrapGo);
        }

        // Build gotip from source.
        const cwd = path.join(workTree, 'src');
        const env = {
          'GOROOT_BOOTSTRAP': bootstrap,
          ...process.env,
          // Note that while we disable Cgo for tip builds, it does
          // not disable Cgo entirely. Moreover, we override this
          // value in setGoEnvironmentVariables with whatever the
          // bootstrap toolchain uses. This way we can get reproducible
          // builds without disrupting normal workflows.
          'CGO_ENABLED': '0',
          // Cherry on the cake for completely reproducible builds.
          // The default value depends on the build directory, but
          // is easily overriden with GOROOT environment variable
          // at runtime. Since we already export GOROOT by default,
          // and assume paths would differ between CI runs, we set
          // this to the value Go uses when -trimpath flag is set.
          // See https://go.googlesource.com/go/+/refs/tags/go1.13/src/cmd/go/internal/work/gc.go#553
          'GOROOT_FINAL': 'go',
        }
        let cmd: string;
        if (osPlat != 'win32') {
          cmd = 'bash make.bash';
        } else {
          cmd = 'make.bat';
        }
        await exec.exec(cmd, undefined, { cwd, env });
        // Update cache for work tree.
        workTree = await tc.cacheDir(workTree, 'gotip', commitHash);
      }
      toolRoot = workTree;
  } else {
    let downloadPath: string;
    try {
      core.debug(`Downloading Go from: ${downloadUrl}`);
      downloadPath = await tc.downloadTool(downloadUrl);
    } catch (error) {
      core.debug(error);
      throw new Error(`Failed to download version ${version}: ${error}`);
    }
    // Extract downloaded archive. Note that node extracts
    // with a root folder that matches the filename downloaded.
    if (osPlat == 'win32') {
      extPath = await tc.extractZip(downloadPath);
    } else {
      extPath = await tc.extractTar(downloadPath);
    }
    // Add Go to the cache.
    toolRoot = path.join(extPath, 'go');
    toolRoot = await tc.cacheDir(toolRoot, 'go', normVersion);
  }
  return toolRoot;
}

function getDownloadUrl(version: string, filename: string): string {
  if (version == 'tip') {
    return 'https://go.googlesource.com/go';
  }
  return util.format('https://storage.googleapis.com/golang/%s', filename);
}

function getFileName(version: string): string {
  const arches: {[arch: string]: string} = {
    x64: 'amd64',
    arm: 'armv6l',
    arm64: 'arm64',
    default: '386'
  };

  const platform: string = osPlat == 'win32' ? 'windows' : osPlat;
  const arch: string = arches[osArch] || arches['default'];
  let ext: string;
  if (version == 'tip') {
    // Git work tree for tip builds does not have an extension.
    ext = '';
  } else if (osPlat == 'win32') {
    ext = '.zip';
  } else {
    ext = '.tar.gz'
  }
  const filename: string = util.format(
    'go%s.%s-%s%s',
    version,
    platform,
    arch,
    ext
  );

  return filename;
}

async function setGoEnvironmentVariables(version: string, goRoot: string, bootstrapGo: string) {
  if (version == 'tip') {
    // We build tip with CGO_ENABLED=0, but that could be confusing
    // if the bootstrap toolchain uses CGO_ENABLED=1 by default. So
    // we re-export this value for the tip toolchain.
    const cgo = await executil.goEnv('CGO_ENABLED', bootstrapGo);
    core.exportVariable('CGO_ENABLED', cgo);
  }

  core.exportVariable('GOROOT', goRoot);

  const goPath: string = process.env['GOPATH'] || '';
  const goBin: string = process.env['GOBIN'] || '';

  // set GOPATH and GOBIN as user value
  if (goPath) {
    core.exportVariable('GOPATH', goPath);
  }
  if (goBin) {
    core.exportVariable('GOBIN', goBin);
  }

  let goRootBin = path.join(goRoot, 'bin');
  core.addPath(goRootBin);
}

// This function is required to convert the version 1.10 to 1.10.0.
// Because caching utility accept only sementic version,
// which have patch number as well.
function normalizeVersion(version: string): string {
  if (version == 'tip') {
    return version;
  }

  const versionPart = version.split('.');
  if (versionPart[1] == null) {
    //append minor and patch version if not available
    return version.concat('.0.0');
  } else {
    // handle beta and rc: 1.10beta1 => 1.10.0-beta1, 1.10rc1 => 1.10.0-rc1
    if (versionPart[1].includes('beta') || versionPart[1].includes('rc')) {
      versionPart[1] = versionPart[1]
        .replace('beta', '.0-beta')
        .replace('rc', '.0-rc');
      return versionPart.join('.');
    }
  }

  if (versionPart[2] == null) {
    //append patch version if not available
    return version.concat('.0');
  } else {
    // handle beta and rc: 1.8.5beta1 => 1.8.5-beta1, 1.8.5rc1 => 1.8.5-rc1
    if (versionPart[2].includes('beta') || versionPart[2].includes('rc')) {
      versionPart[2] = versionPart[2]
        .replace('beta', '-beta')
        .replace('rc', '-rc');
      return versionPart.join('.');
    }
  }

  return version;
}

async function determineVersion(version: string): Promise<string> {
  if (version == 'tip') {
    return version;
  }
  if (version == 'latest') {
    return await getLatestVersion('');
  }
  if (!version.endsWith('.x')) {
    return version;
  }
  return await getLatestVersion(version);
}

async function getLatestVersion(version: string): Promise<string> {
  // clean .x syntax: 1.10.x -> 1.10
  const trimmedVersion = version.slice(0, version.length - 2);

  const versions = await getPossibleVersions(trimmedVersion);

  core.debug(`evaluating ${versions.length} versions`);

  if (versions.length === 0) {
    throw new Error('unable to get latest version');
  }

  core.debug(`matched: ${versions[0]}`);

  return versions[0];
}

interface IGoRef {
  version: string;
}

async function getAvailableVersions(): Promise<string[]> {
  let rest: restm.RestClient = new restm.RestClient('setup-go');
  let tags: IGoRef[] =
    (await rest.get<IGoRef[]>('https://golang.org/dl/?mode=json&include=all'))
      .result || [];

  return tags.map(tag => tag.version.replace('go', ''));
}

async function getPossibleVersions(version: string): Promise<string[]> {
  const versions = await getAvailableVersions();
  const possibleVersions = versions.filter(v => v.startsWith(version));

  const versionMap = new Map();
  possibleVersions.forEach(v => versionMap.set(normalizeVersion(v), v));

  return Array.from(versionMap.keys())
    .sort(semver.rcompare)
    .map(v => versionMap.get(v));
}
