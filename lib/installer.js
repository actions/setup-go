"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util = __importStar(require("util"));
let osPlat = os.platform();
let osArch = os.arch();
if (!tempDirectory) {
    let baseLocation;
    if (process.platform === 'win32') {
        // On windows use the USERPROFILE env variable
        baseLocation = process.env['USERPROFILE'] || 'C:\\';
    }
    else {
        if (process.platform === 'darwin') {
            baseLocation = '/Users';
        }
        else {
            baseLocation = '/home';
        }
    }
    tempDirectory = path.join(baseLocation, 'actions', 'temp');
}
function getGo(version) {
    return __awaiter(this, void 0, void 0, function* () {
        // check cache
        let toolPath;
        toolPath = tc.find('go', normalizeVersion(version));
        if (!toolPath) {
            // download, extract, cache
            toolPath = yield acquireGo(version);
            core.debug('Go tool is cached under ' + toolPath);
        }
        setGoEnvironmentVariables(toolPath);
        toolPath = path.join(toolPath, 'bin');
        //
        // prepend the tools path. instructs the agent to prepend for future tasks
        //
        core.addPath(toolPath);
    });
}
exports.getGo = getGo;
function acquireGo(version) {
    return __awaiter(this, void 0, void 0, function* () {
        //
        // Download - a tool installer intimately knows how to get the tool (and construct urls)
        //
        let fileName = getFileName(version);
        let downloadUrl = getDownloadUrl(fileName);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
        }
        catch (error) {
            core.debug(error);
            throw `Failed to download version ${version}: ${error}`;
        }
        //
        // Extract
        //
        let extPath = tempDirectory;
        if (!extPath) {
            throw new Error('Temp directory not set');
        }
        if (osPlat == 'win32') {
            extPath = yield tc.extractZip(downloadPath);
        }
        else {
            extPath = yield tc.extractTar(downloadPath);
        }
        //
        // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
        //
        const toolRoot = path.join(extPath, 'go');
        version = normalizeVersion(version);
        return yield tc.cacheDir(toolRoot, 'go', version);
    });
}
function getFileName(version) {
    const platform = osPlat == 'win32' ? 'windows' : osPlat;
    const arch = osArch == 'x64' ? 'amd64' : '386';
    const ext = osPlat == 'win32' ? 'zip' : 'tar.gz';
    const filename = util.format('go%s.%s-%s.%s', version, platform, arch, ext);
    return filename;
}
function getDownloadUrl(filename) {
    return util.format('https://storage.googleapis.com/golang/%s', filename);
}
function setGoEnvironmentVariables(goRoot) {
    core.exportVariable('GOROOT', goRoot);
    const goPath = process.env['GOPATH'] || '';
    const goBin = process.env['GOBIN'] || '';
    // set GOPATH and GOBIN as user value
    if (!util.isNullOrUndefined(goPath)) {
        core.exportVariable('GOPATH', goPath);
    }
    if (!util.isNullOrUndefined(goBin)) {
        core.exportVariable('GOBIN', goBin);
    }
}
// This function is required to convert the version 1.10 to 1.10.0.
// Because caching utility accept only sementic version,
// which have patch number as well.
function normalizeVersion(version) {
    const versionPart = version.split('.');
    if (versionPart[1] == null) {
        //append minor and patch version if not available
        return version.concat('.0.0');
    }
    else if (versionPart[2] == null) {
        //append patch version if not available
        return version.concat('.0');
    }
    return version;
}
