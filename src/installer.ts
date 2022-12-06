import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as path from 'path';
import * as semver from 'semver';
import * as httpm from '@actions/http-client';
import * as sys from './system';
import fs from 'fs';
import os from 'os';
import {StableReleaseAlias} from './utils';

type InstallationType = 'dist' | 'manifest';

export interface IGoVersionFile {
  filename: string;
  // darwin, linux, windows
  os: string;
  arch: string;
}

export interface IGoVersion {
  version: string;
  stable: boolean;
  files: IGoVersionFile[];
}

export interface IGoVersionInfo {
  type: InstallationType;
  downloadUrl: string;
  resolvedVersion: string;
  fileName: string;
}

export async function getGo(
  versionSpec: string,
  checkLatest: boolean,
  auth: string | undefined,
  arch = os.arch()
) {
  let manifest: tc.IToolRelease[] | undefined;
  let osPlat: string = os.platform();

  if (
    versionSpec === StableReleaseAlias.Stable ||
    versionSpec === StableReleaseAlias.OldStable
  ) {
    manifest = await getManifest(auth);
    versionSpec = await resolveStableVersionInput(
      versionSpec,
      auth,
      arch,
      manifest
    );
  }

  if (checkLatest) {
    core.info('Attempting to resolve the latest version from the manifest...');
    const resolvedVersion = await resolveVersionFromManifest(
      versionSpec,
      true,
      auth,
      arch,
      manifest
    );
    if (resolvedVersion) {
      versionSpec = resolvedVersion;
      core.info(`Resolved as '${versionSpec}'`);
    } else {
      core.info(`Failed to resolve version ${versionSpec} from manifest`);
    }
  }

  // check cache
  let toolPath: string;
  toolPath = tc.find('go', versionSpec, arch);
  // If not found in cache, download
  if (toolPath) {
    core.info(`Found in cache @ ${toolPath}`);
    return toolPath;
  }
  core.info(`Attempting to download ${versionSpec}...`);
  let downloadPath = '';
  let info: IGoVersionInfo | null = null;

  //
  // Try download from internal distribution (popular versions only)
  //
  try {
    info = await getInfoFromManifest(versionSpec, true, auth, arch, manifest);
    if (info) {
      downloadPath = await installGoVersion(info, auth, arch);
    } else {
      core.info(
        'Not found in manifest.  Falling back to download directly from Go'
      );
    }
  } catch (err) {
    if (
      err instanceof tc.HTTPError &&
      (err.httpStatusCode === 403 || err.httpStatusCode === 429)
    ) {
      core.info(
        `Received HTTP status code ${err.httpStatusCode}.  This usually indicates the rate limit has been exceeded`
      );
    } else {
      core.info(err.message);
    }
    core.debug(err.stack);
    core.info('Falling back to download directly from Go');
  }

  //
  // Download from storage.googleapis.com
  //
  if (!downloadPath) {
    info = await getInfoFromDist(versionSpec, arch);
    if (!info) {
      throw new Error(
        `Unable to find Go version '${versionSpec}' for platform ${osPlat} and architecture ${arch}.`
      );
    }

    try {
      core.info('Install from dist');
      downloadPath = await installGoVersion(info, undefined, arch);
    } catch (err) {
      throw new Error(`Failed to download version ${versionSpec}: ${err}`);
    }
  }

  return downloadPath;
}

async function resolveVersionFromManifest(
  versionSpec: string,
  stable: boolean,
  auth: string | undefined,
  arch: string,
  manifest: tc.IToolRelease[] | undefined
): Promise<string | undefined> {
  try {
    const info = await getInfoFromManifest(
      versionSpec,
      stable,
      auth,
      arch,
      manifest
    );
    return info?.resolvedVersion;
  } catch (err) {
    core.info('Unable to resolve a version from the manifest...');
    core.debug(err.message);
  }
}

async function installGoVersion(
  info: IGoVersionInfo,
  auth: string | undefined,
  arch: string
): Promise<string> {
  core.info(`Acquiring ${info.resolvedVersion} from ${info.downloadUrl}`);

  // Windows requires that we keep the extension (.zip) for extraction
  const isWindows = os.platform() === 'win32';
  const tempDir = process.env.RUNNER_TEMP || '.';
  const fileName = isWindows ? path.join(tempDir, info.fileName) : undefined;

  const downloadPath = await tc.downloadTool(info.downloadUrl, fileName, auth);

  core.info('Extracting Go...');
  let extPath = await extractGoArchive(downloadPath);
  core.info(`Successfully extracted go to ${extPath}`);
  if (info.type === 'dist') {
    extPath = path.join(extPath, 'go');
  }

  core.info('Adding to the cache ...');
  const cachedDir = await tc.cacheDir(
    extPath,
    'go',
    makeSemver(info.resolvedVersion),
    arch
  );
  core.info(`Successfully cached go to ${cachedDir}`);
  return cachedDir;
}

export async function extractGoArchive(archivePath: string): Promise<string> {
  const platform = os.platform();
  let extPath: string;

  if (platform === 'win32') {
    extPath = await tc.extractZip(archivePath);
  } else {
    extPath = await tc.extractTar(archivePath);
  }

  return extPath;
}

export async function getManifest(auth: string | undefined) {
  return tc.getManifestFromRepo('actions', 'go-versions', auth, 'main');
}

export async function getInfoFromManifest(
  versionSpec: string,
  stable: boolean,
  auth: string | undefined,
  arch = os.arch(),
  manifest?: tc.IToolRelease[] | undefined
): Promise<IGoVersionInfo | null> {
  let info: IGoVersionInfo | null = null;
  if (!manifest) {
    core.debug('No manifest cached');
    manifest = await getManifest(auth);
  }

  core.info(`matching ${versionSpec}...`);

  const rel = await tc.findFromManifest(versionSpec, stable, manifest, arch);

  if (rel && rel.files.length > 0) {
    info = <IGoVersionInfo>{};
    info.type = 'manifest';
    info.resolvedVersion = rel.version;
    info.downloadUrl = rel.files[0].download_url;
    info.fileName = rel.files[0].filename;
  }

  return info;
}

async function getInfoFromDist(
  versionSpec: string,
  arch: string
): Promise<IGoVersionInfo | null> {
  let version: IGoVersion | undefined;
  version = await findMatch(versionSpec, arch);
  if (!version) {
    return null;
  }

  let downloadUrl: string = `https://storage.googleapis.com/golang/${version.files[0].filename}`;

  return <IGoVersionInfo>{
    type: 'dist',
    downloadUrl: downloadUrl,
    resolvedVersion: version.version,
    fileName: version.files[0].filename
  };
}

export async function findMatch(
  versionSpec: string,
  arch = os.arch()
): Promise<IGoVersion | undefined> {
  let archFilter = sys.getArch(arch);
  let platFilter = sys.getPlatform();

  let result: IGoVersion | undefined;
  let match: IGoVersion | undefined;

  const dlUrl: string = 'https://golang.org/dl/?mode=json&include=all';
  let candidates: IGoVersion[] | null = await module.exports.getVersionsDist(
    dlUrl
  );
  if (!candidates) {
    throw new Error(`golang download url did not return results`);
  }

  if (
    versionSpec === StableReleaseAlias.Stable ||
    versionSpec === StableReleaseAlias.OldStable
  ) {
    const fixedCandidates = candidates.map(item => {
      return {...item, version: makeSemver(item.version)};
    });
    versionSpec = await resolveStableVersionInput(
      versionSpec,
      undefined,
      archFilter,
      fixedCandidates
    );
  }

  let goFile: IGoVersionFile | undefined;
  for (let i = 0; i < candidates.length; i++) {
    let candidate: IGoVersion = candidates[i];
    let version = makeSemver(candidate.version);

    core.debug(`check ${version} satisfies ${versionSpec}`);
    if (semver.satisfies(version, versionSpec)) {
      goFile = candidate.files.find(file => {
        core.debug(
          `${file.arch}===${archFilter} && ${file.os}===${platFilter}`
        );
        return file.arch === archFilter && file.os === platFilter;
      });

      if (goFile) {
        core.debug(`matched ${candidate.version}`);
        match = candidate;
        break;
      }
    }
  }

  if (match && goFile) {
    // clone since we're mutating the file list to be only the file that matches
    result = <IGoVersion>Object.assign({}, match);
    result.files = [goFile];
  }

  return result;
}

export async function getVersionsDist(
  dlUrl: string
): Promise<IGoVersion[] | null> {
  // this returns versions descending so latest is first
  let http: httpm.HttpClient = new httpm.HttpClient('setup-go', [], {
    allowRedirects: true,
    maxRedirects: 3
  });
  return (await http.getJson<IGoVersion[]>(dlUrl)).result;
}

//
// Convert the go version syntax into semver for semver matching
// 1.13.1 => 1.13.1
// 1.13 => 1.13.0
// 1.10beta1 => 1.10.0-beta.1, 1.10rc1 => 1.10.0-rc.1
// 1.8.5beta1 => 1.8.5-beta.1, 1.8.5rc1 => 1.8.5-rc.1
export function makeSemver(version: string): string {
  version = version.replace('go', '');
  version = version.replace('beta', '-beta.').replace('rc', '-rc.');
  let parts = version.split('-');

  let semVersion = semver.coerce(parts[0])?.version;
  if (!semVersion) {
    throw new Error(
      `The version: ${version} can't be changed to SemVer notation`
    );
  }

  if (!parts[1]) {
    return semVersion;
  }

  const fullVersion = semver.valid(`${semVersion}-${parts[1]}`);

  if (!fullVersion) {
    throw new Error(
      `The version: ${version} can't be changed to SemVer notation`
    );
  }
  return fullVersion;
}

export function parseGoVersionFile(versionFilePath: string): string {
  const contents = fs.readFileSync(versionFilePath).toString();

  if (
    path.basename(versionFilePath) === 'go.mod' ||
    path.basename(versionFilePath) === 'go.work'
  ) {
    const match = contents.match(/^go (\d+(\.\d+)*)/m);
    return match ? match[1] : '';
  }

  return contents.trim();
}

export async function resolveStableVersionInput(
  versionSpec: string,
  auth: string | undefined,
  arch = os.arch(),
  manifest: tc.IToolRelease[] | IGoVersion[] | undefined
): Promise<string> {
  if (!manifest) {
    core.debug('No manifest cached');
    manifest = await getManifest(auth);
  }

  const releases = manifest
    .map(item => {
      const index = item.files.findIndex(item => item.arch === arch);
      if (index === -1) {
        return '';
      }
      return item.version;
    })
    .filter(item => !!item);

  if (versionSpec === StableReleaseAlias.Stable) {
    core.info(`stable version resolved as ${releases[0]}`);

    return releases[0] ?? versionSpec;
  } else {
    const versions = releases.map(
      release => `${semver.major(release)}.${semver.minor(release)}`
    );
    const uniqueVersions = Array.from(new Set(versions));

    const oldstableVersion = releases.find(item =>
      item.startsWith(uniqueVersions[1])
    );

    core.info(`oldstable version resolved as ${oldstableVersion}`);

    if (!oldstableVersion) {
      return versionSpec;
    }

    return oldstableVersion;
  }
}
