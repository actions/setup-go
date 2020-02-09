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
const tc = __importStar(require("@actions/tool-cache"));
const path = __importStar(require("path"));
const semver = __importStar(require("semver"));
const httpm = __importStar(require("@actions/http-client"));
const sys = __importStar(require("./system"));
function downloadGo(versionSpec, stable) {
    return __awaiter(this, void 0, void 0, function* () {
        let toolPath;
        try {
            let match = yield findMatch(versionSpec, stable);
            if (match) {
                // download
                let downloadUrl = `https://storage.googleapis.com/golang/${match.files[0]}`;
                let downloadPath = yield tc.downloadTool(downloadUrl);
                // extract
                let extPath = sys.getPlatform() == 'windows'
                    ? yield tc.extractZip(downloadPath)
                    : yield tc.extractTar(downloadPath);
                // extracts with a root folder that matches the fileName downloaded
                const toolRoot = path.join(extPath, 'go');
                toolPath = yield tc.cacheDir(toolRoot, 'go', versionSpec);
            }
        }
        catch (error) {
            throw `Failed to download version ${versionSpec}: ${error}`;
        }
        return toolPath;
    });
}
exports.downloadGo = downloadGo;
function findMatch(versionSpec, stable) {
    return __awaiter(this, void 0, void 0, function* () {
        let archFilter = sys.getArch();
        let platFilter = sys.getPlatform();
        let match;
        const dlUrl = 'https://golang.org/dl/?mode=json&include=all';
        // this returns versions descending so latest is first
        let http = new httpm.HttpClient('setup-go');
        let candidates = (yield http.getJson(dlUrl)).result;
        if (!candidates) {
            throw new Error(`golang download url did not return results: ${dlUrl}`);
        }
        let goFile;
        for (let i = 0; i < candidates.length; i++) {
            let candidate = candidates[i];
            let version = candidate.version.replace('go', '');
            // 1.13.0 is advertised as 1.13 preventing being able to match exactly 1.13.0
            // since a semver of 1.13 would match latest 1.13
            let parts = version.split('.');
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
        }
        if (match && goFile) {
            match.files = [goFile];
        }
        return match;
    });
}
exports.findMatch = findMatch;
