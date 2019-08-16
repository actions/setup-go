// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as semver from 'semver';
import * as restm from 'typed-rest-client/RestClient';

let osPlat: string = os.platform();
let osArch: string = os.arch();

if (!tempDirectory) {
  let baseLocation;
  if (process.platform === 'win32') {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\';
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users';
    } else {
      baseLocation = '/home';
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

export async function getGo(version: string) {
  const selected = await determineVersion(version);
  if (selected) {
    version = selected;
  }

  // check cache
  let toolPath: string;
  toolPath = tc.find('go', normalizeVersion(version));

  if (!toolPath) {
    // download, extract, cache
    toolPath = await acquireGo(version);
    core.debug('Go tool is cached under ' + toolPath);
  }

  setGoEnvironmentVariables(toolPath);

  toolPath = path.join(toolPath, 'bin');
  //
  // prepend the tools path. instructs the agent to prepend for future tasks
  //
  core.addPath(toolPath);
}

async function acquireGo(version: string): Promise<string> {
  //
  // Download - a tool installer intimately knows how to get the tool (and construct urls)
  //
  let fileName: string = getFileName(version);
  let downloadUrl: string = getDownloadUrl(fileName);
  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (error) {
    core.debug(error);

    throw `Failed to download version ${version}: ${error}`;
  }

  //
  // Extract
  //
  let extPath: string = tempDirectory;
  if (!extPath) {
    throw new Error('Temp directory not set');
  }

  if (osPlat == 'win32') {
    extPath = await tc.extractZip(downloadPath);
  } else {
    extPath = await tc.extractTar(downloadPath);
  }

  //
  // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
  //
  const toolRoot = path.join(extPath, 'go');
  version = normalizeVersion(version);
  return await tc.cacheDir(toolRoot, 'go', version);
}

function getFileName(version: string): string {
  const platform: string = osPlat == 'win32' ? 'windows' : osPlat;
  const arch: string = osArch == 'x64' ? 'amd64' : '386';
  const ext: string = osPlat == 'win32' ? 'zip' : 'tar.gz';
  const filename: string = util.format(
    'go%s.%s-%s.%s',
    version,
    platform,
    arch,
    ext
  );
  return filename;
}

function getDownloadUrl(filename: string): string {
  return util.format('https://storage.googleapis.com/golang/%s', filename);
}

function setGoEnvironmentVariables(goRoot: string) {
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
}

// This function is required to convert the version 1.10 to 1.10.0.
// Because caching utility accept only sementic version,
// which have patch number as well.
function normalizeVersion(version: string): string {
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
  if (!version.endsWith('.x')) {
    const versionPart = version.split('.');

    if (versionPart[1] == null || versionPart[2] == null) {
      return await getLatestVersion(version.concat('.x'));
    } else {
      return version;
    }
  }

  return await getLatestVersion(version);
}

async function getLatestVersion(version: string): Promise<string> {
  // clean .x syntax: 1.10.x -> 1.10
  const trimmedVersion = version.slice(0, version.length - 2);

  const versions = await getPossibleVersions(trimmedVersion);

  core.debug(`evaluating ${versions.length} versions`);

  if (version.length === 0) {
    throw new Error('unable to get latest version');
  }

  core.debug(`matched: ${versions[0]}`);

  return versions[0];
}

interface IGoRef {
  ref: string;
}

async function getAvailableVersions(): Promise<string[]> {
  let rest: restm.RestClient = new restm.RestClient('setup-go');
  let tags: IGoRef[] =
    (await rest.get<IGoRef[]>(
      'https://api.github.com/repos/golang/go/git/refs/tags'
    )).result || [];

  return tags
    .filter(tag => tag.ref.match(/go\d+\.[\w\.]+/g))
    .map(tag => tag.ref.replace('refs/tags/go', ''));
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
