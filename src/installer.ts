import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as path from 'path';
import * as semver from 'semver';
import * as httpm from '@actions/http-client';
import * as sys from './system';
import os from 'os';
import {version} from 'process';

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
  versionSpecResolver: string | undefined,
  stable: boolean,
  auth: string | undefined
): Promise<string> {
  let versionInfo: IGoVersionInfo | null = null;

  if (versionSpecResolver) {
    core.info(
      `Resolving versionSpec '${versionSpec}' from '${versionSpecResolver}'`
    );
    switch (versionSpecResolver) {
      case 'manifest':
        versionInfo = await getInfoFromManifest(versionSpec, stable, auth);
        break;
      case 'dist':
        versionInfo = await getInfoFromDist(versionSpec, stable);
        break;
    }
  }

  if (versionInfo && versionInfo.resolvedVersion.length > 0) {
    versionSpec = versionInfo.resolvedVersion;

    // Freeze these to protect (un)intentional overwrites.
    Object.freeze(versionInfo);
    Object.freeze(versionSpec);
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
    if (versionInfo?.type == 'manifest') {
      info = versionInfo;
    } else {
      // The version search in the cache was a miss. We either have no previous
      // explicit version resolution attempt or it came from 'dist' version registry
      // and have an `downloadUrl` pointing to an external resource.
      //
      // Check the @actions/go-versions manifest with current `versionSpec`; either
      // an explicit one or a semver range.
      info = await getInfoFromManifest(versionSpec, stable, auth);
    }

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
    if (versionInfo?.type == 'dist') {
      info = versionInfo;
    } else {
      // Version search didn't match anything available in the cache or @actions/go-versions.
      // We either have no previous explicit version resolution attempt or downloading from
      // @actions/go-versions manifest specified URL somehow failed.
      info = await getInfoFromDist(versionSpec, stable);
    }

    if (!info) {
      let osPlat: string = os.platform();
      let osArch: string = os.arch();
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

async function installGoVersion(
  info: IGoVersionInfo,
  auth: string | undefined
): Promise<string> {
  core.info(`Acquiring ${info.resolvedVersion} from ${info.downloadUrl}`);
  const downloadPath = await tc.downloadTool(info.downloadUrl, undefined, auth);

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
  const arch = os.arch();
  let extPath: string;

  if (arch === 'win32') {
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
  versionSpec: string,
  stable: boolean
): Promise<IGoVersionInfo | null> {
  let version: IGoVersion | undefined;
  version = await findMatch(versionSpec, stable);
  if (!version) {
    return null;
  }

  let downloadUrl: string = `https://storage.googleapis.com/golang/${version.files[0].filename}`;

  return <IGoVersionInfo>{
    type: 'dist',
    downloadUrl: downloadUrl,
    resolvedVersion: makeSemver(version.version),
    fileName: version.files[0].filename
  };
}

export async function findMatch(
  versionSpec: string,
  stable: boolean
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

    // 1.13.0 is advertised as 1.13 preventing being able to match exactly 1.13.0
    // since a semver of 1.13 would match latest 1.13
    let parts: string[] = version.split('.');
    if (parts.length == 2) {
      version = version + '.0';
    }

    core.debug(`check ${version} satisfies ${versionSpec}`);
    if (
      semver.satisfies(version, versionSpec) &&
      (!stable || candidate.stable === stable)
    ) {
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
// 1.10beta1 => 1.10.0-beta1, 1.10rc1 => 1.10.0-rc1
// 1.8.5beta1 => 1.8.5-beta1, 1.8.5rc1 => 1.8.5-rc1
export function makeSemver(version: string): string {
  version = version.replace('go', '');
  version = version.replace('beta', '-beta').replace('rc', '-rc');
  let parts = version.split('-');

  let verPart: string = parts[0];
  let prereleasePart = parts.length > 1 ? `-${parts[1]}` : '';

  let verParts: string[] = verPart.split('.');
  if (verParts.length == 2) {
    verPart += '.0';
  }

  return `${verPart}${prereleasePart}`;
}
