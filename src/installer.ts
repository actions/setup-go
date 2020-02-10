import * as tc from '@actions/tool-cache';
import * as path from 'path';
import * as semver from 'semver';
import * as httpm from '@actions/http-client';
import * as sys from './system';
import {debug} from '@actions/core';

export async function downloadGo(
  versionSpec: string,
  stable: boolean
): Promise<string | undefined> {
  let toolPath: string | undefined;

  try {
    let match: IGoVersion | undefined = await findMatch(versionSpec, stable);

    if (match) {
      // download
      debug(`match ${match.version}`);
      let downloadUrl: string = `https://storage.googleapis.com/golang/${match.files[0].filename}`;
      let downloadPath: string = await tc.downloadTool(downloadUrl);
      debug(`downloaded to ${downloadPath}`);

      // extract
      let extPath: string =
        sys.getPlatform() == 'windows'
          ? await tc.extractZip(downloadPath)
          : await tc.extractTar(downloadPath);
      debug(`extracted to ${extPath}`);

      // extracts with a root folder that matches the fileName downloaded
      const toolRoot = path.join(extPath, 'go');
      toolPath = await tc.cacheDir(toolRoot, 'go', versionSpec);
    }
  } catch (error) {
    throw new Error(`Failed to download version ${versionSpec}: ${error}`);
  }

  return toolPath;
}

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

export async function findMatch(
  versionSpec: string,
  stable: boolean
): Promise<IGoVersion | undefined> {
  let archFilter = sys.getArch();
  let platFilter = sys.getPlatform();

  let result: IGoVersion | undefined;
  let match: IGoVersion | undefined;

  const dlUrl: string = 'https://golang.org/dl/?mode=json&include=all';
  let candidates: IGoVersion[] | null = await module.exports.getVersions(dlUrl);
  if (!candidates) {
    throw new Error(`golang download url did not return results`);
  }

  let goFile: IGoVersionFile | undefined;
  for (let i = 0; i < candidates.length; i++) {
    let candidate: IGoVersion = candidates[i];
    let version = candidate.version.replace('go', '');

    // 1.13.0 is advertised as 1.13 preventing being able to match exactly 1.13.0
    // since a semver of 1.13 would match latest 1.13
    let parts: string[] = version.split('.');
    if (parts.length == 2) {
      version = version + '.0';
    }

    debug(`check ${version} satisfies ${versionSpec}`);
    if (semver.satisfies(version, versionSpec) && candidate.stable == stable) {
      goFile = candidate.files.find(file => {
        debug(`${file.arch}===${archFilter} && ${file.os}===${platFilter}`);
        return file.arch === archFilter && file.os === platFilter;
      });

      if (goFile) {
        debug(`matched ${candidate.version}`);
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

export async function getVersions(dlUrl: string): Promise<IGoVersion[] | null> {
  // this returns versions descending so latest is first
  let http: httpm.HttpClient = new httpm.HttpClient('setup-go');
  return (await http.getJson<IGoVersion[]>(dlUrl)).result;
}
