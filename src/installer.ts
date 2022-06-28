import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as path from 'path';
import * as semver from 'semver';
import * as httpm from '@actions/http-client';
import * as sys from './system';
import fs from 'fs';
import os from 'os';

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
  auth: string | undefined
) {
  let osPlat: string = os.platform();
  let osArch: string = os.arch();

  if (checkLatest) {
    core.info('Attempting to resolve the latest version from the manifest...');
    const resolvedVersion = await resolveVersionFromManifest(
      versionSpec,
      true,
      auth
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
  toolPath = tc.find('go', versionSpec);
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
    info = await getInfoFromManifest(versionSpec, true, auth);
    if (info) {
      downloadPath = await installGoVersion(info, auth);
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
    info = await getInfoFromDist(versionSpec);
    if (!info) {
      throw new Error(
        `Unable to find Go version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`
      );
    }

    try {
      core.info('Install from dist');
      downloadPath = await installGoVersion(info, undefined);
    } catch (err) {
      throw new Error(`Failed to download version ${versionSpec}: ${err}`);
    }
  }

  return downloadPath;
}

async function resolveVersionFromManifest(
  versionSpec: string,
  stable: boolean,
  auth: string | undefined
): Promise<string | undefined> {
  try {
    const info = await getInfoFromManifest(versionSpec, stable, auth);
    return info?.resolvedVersion;
  } catch (err) {
    core.info('Unable to resolve a version from the manifest...');
    core.debug(err.message);
  }
}

async function installGoVersion(
  info: IGoVersionInfo,
  auth: string | undefined
): Promise<string> {
  core.info(`Acquiring ${info.resolvedVersion} from ${info.downloadUrl}`);
  let downloadPath: string;
  const platform = os.platform();
  if(platform === 'win32') {
    downloadPath = await tc.downloadTool(info.downloadUrl, info.fileName, auth);
  } else {
    downloadPath = await tc.downloadTool(info.downloadUrl, undefined, auth);
  }

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
    makeSemver(info.resolvedVersion)
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

export async function getInfoFromManifest(
  versionSpec: string,
  stable: boolean,
  auth: string | undefined
): Promise<IGoVersionInfo | null> {
  let info: IGoVersionInfo | null = null;
  const releases = await tc.getManifestFromRepo(
    'actions',
    'go-versions',
    auth,
    'main'
  );
  core.info(`matching ${versionSpec}...`);
  const rel = await tc.findFromManifest(versionSpec, stable, releases);

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
  versionSpec: string
): Promise<IGoVersionInfo | null> {
  let version: IGoVersion | undefined;
  version = await findMatch(versionSpec);
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
  versionSpec: string
): Promise<IGoVersion | undefined> {
  let archFilter = sys.getArch();
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

  if (path.basename(versionFilePath) === 'go.mod') {
    const match = contents.match(/^go (\d+(\.\d+)*)/m);
    return match ? match[1] : '';
  }

  return contents.trim();
}
