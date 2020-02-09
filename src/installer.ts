import * as tc from '@actions/tool-cache';
import * as path from 'path';
import * as semver from 'semver';
import * as httpm from '@actions/http-client'
import * as sys from './system'

export async function downloadGo(versionSpec: string, stable: boolean): Promise<string | undefined> {
  let toolPath: string | undefined;

  try {
    let match: IGoVersion | undefined = await findMatch(versionSpec, stable);

    if (match) {
      // download
      let downloadUrl: string = `https://storage.googleapis.com/golang/${match.files[0]}`;
      let downloadPath: string = await tc.downloadTool(downloadUrl);

      // extract
      let extPath: string = sys.getPlatform() == 'windows'?
        await tc.extractZip(downloadPath): await tc.extractTar(downloadPath);

      // extracts with a root folder that matches the fileName downloaded
      const toolRoot = path.join(extPath, 'go');
      toolPath = await tc.cacheDir(toolRoot, 'go', versionSpec);
    }
  } catch (error) {
    throw `Failed to download version ${versionSpec}: ${error}`;
  }

  return toolPath;
}

export interface IGoVersionFile {
  filename: string,
  // darwin, linux, windows
  os: string,
  arch: string
}

export interface IGoVersion {
  version: string;
  stable: boolean;
  files: IGoVersionFile[];
}

export async function findMatch(versionSpec: string, stable: boolean): Promise<IGoVersion | undefined> {
  let archFilter = sys.getArch();
  let platFilter = sys.getPlatform();

  let match: IGoVersion| undefined;
  const dlUrl: string = 'https://golang.org/dl/?mode=json&include=all';

  // this returns versions descending so latest is first
  let http: httpm.HttpClient = new httpm.HttpClient('setup-go');
  let candidates: IGoVersion[] | null =  (await http.getJson<IGoVersion[]>(dlUrl)).result;

  if (!candidates) {
    throw new Error(`golang download url did not return results: ${dlUrl}`);
  }
  
  let goFile: IGoVersionFile | undefined;
  for (let i=0; i < candidates.length; i++) {
    let candidate: IGoVersion = candidates[i];
    let version = candidate.version.replace('go', '');
    
    // 1.13.0 is advertised as 1.13 preventing being able to match exactly 1.13.0
    // since a semver of 1.13 would match latest 1.13
    let parts: string[] = version.split('.');
    if (parts.length == 2) {
      version = version + '.0';
    }

    //console.log(version, versionSpec);
    if (semver.satisfies(version, versionSpec) && candidate.stable == stable) {
      goFile = candidate.files.find(file => {
        return file.arch === archFilter && file.os === platFilter;
      });

      if (goFile) {
        match = candidate;
        break;
      }
    }
  };

  if (match && goFile) {
    match.files = [ goFile ];
  }

  return match;
}
