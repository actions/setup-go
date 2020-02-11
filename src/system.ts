import * as os from 'os';
import * as path from 'path';

export function getPlatform(): string {
  // darwin and linux match already
  // freebsd not supported yet but future proofed.

  // 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'
  let plat: string = os.platform();

  // wants 'darwin', 'freebsd', 'linux', 'windows'
  if (plat === 'win32') {
    plat = 'windows';
  }

  return plat;
}

export function getArch(): string {
  // 'arm', 'arm64', 'ia32', 'mips', 'mipsel', 'ppc', 'ppc64', 's390', 's390x', 'x32', and 'x64'.
  let arch: string = os.arch();

  // wants amd64, 386, arm64, armv61, ppc641e, s390x
  // currently not supported by runner but future proofed mapping
  switch (arch) {
    case 'x64':
      arch = 'amd64';
      break;
    // case 'ppc':
    //   arch = 'ppc64';
    //   break;
    case 'x32':
      arch = '386';
      break;
  }

  return arch;
}

// Get GOPATH as user value or as defined by https://golang.org/doc/code.html#GOPATH
export function getGoPath(): string {
  const home: string = process.env['HOME'] || '';
  const goPath: string = process.env['GOPATH'] || '';

  if (goPath) {
    return goPath;
  } else if (home) {
    return path.join(home, 'go');
  }

  return '';
}
