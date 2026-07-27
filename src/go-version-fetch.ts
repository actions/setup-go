import * as httpm from '@actions/http-client';
import type {IGoVersion} from './installer.js';

export async function getVersionsDist(
  dlUrl: string
): Promise<IGoVersion[] | null> {
  // this returns versions descending so latest is first
  const http: httpm.HttpClient = new httpm.HttpClient('setup-go', [], {
    allowRedirects: true,
    maxRedirects: 3
  });
  return (await http.getJson<IGoVersion[]>(dlUrl)).result;
}
