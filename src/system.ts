import os from 'os';
import {Architecture} from './types';

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

export function getArch(arch: Architecture): string {
  // 'arm', 'arm64', 'ia32', 'mips', 'mipsel', 'ppc', 'ppc64', 's390', 's390x', 'x32', and 'x64'.

  // wants amd64, 386, arm64, armv6l, ppc64le, s390x
  // currently not supported by runner but future proofed mapping
  switch (arch) {
    case 'x64':
      arch = 'amd64';
      break;
    // In case of ppc64, further distinction is needed to determine the endianness
    // of the host as it can either be ppc64(Big Endian) or ppc64le (Little Endian) to download
    // the correct bundle.
    case 'ppc64':
      if (os.endianness() === 'LE') {
        arch = 'ppc64le';
      } else {
        arch = 'ppc64';
      }
      break;
    case 'x32':
      arch = '386';
      break;
    case 'arm':
      arch = 'armv6l';
      break;
  }

  return arch;
}
