import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as _ from 'lodash'
import {supportedPackageManagers, PackageManagerInfo} from './package-managers';
import * as glob from "@actions/glob";

export const getCommandOutput = async (toolCommand: string) => {
    let {stdout, stderr, exitCode} = await exec.getExecOutput(
        toolCommand,
        undefined,
        {ignoreReturnCode: true}
    );

    if (exitCode) {
        stderr = !stderr.trim()
            ? `The '${toolCommand}' command failed with exit code: ${exitCode}`
            : stderr;
        throw new Error(stderr);
    }

    return stdout.trim();
};

export const getPackageManagerInfo = async (packageManager: string) => {
    if (!supportedPackageManagers[packageManager]) {
        throw new Error(
            `It's not possible to use ${packageManager}, please, check correctness of the package manager name spelling.`
        );
    }
    const obtainedPackageManager = supportedPackageManagers[packageManager];

    return obtainedPackageManager;
};

export const getCacheDirectoryPath = async (
    packageManagerInfo: PackageManagerInfo
) => {
    const pathOutputs = await Promise.allSettled(
        packageManagerInfo.cacheFolderCommandList.map(async command =>
            getCommandOutput(command)
        )
    );

    const results = pathOutputs.map(item => {
        if (item.status === 'fulfilled') {
            return item.value;
        } else {
            core.info(`[warning]getting cache directory path failed: ${item.reason}`);
        }

        return '';
    });

    const cachePaths = results.filter(item => item);

    if (!cachePaths.length) {
        throw new Error(`Could not get cache folder paths.`);
    }

    return cachePaths;
};

export function isGhes(): boolean {
    const ghUrl = new URL(
        process.env['GITHUB_SERVER_URL'] || 'https://github.com'
    );
    return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM';
}

/**
 * Memoize it in order to avoid confusing multiple messages
 */
export function isCacheFeatureAvailable(): boolean {
    if (cache.isFeatureAvailable()) {
        return true;
    }

    if (isGhes()) {
        core.warning(
            'Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.'
        );
        return false;
    }

    core.warning(
        'The runner was not able to contact the cache service. Caching will be skipped'
    );
    return false;
}

/**
 * Checks if the caching of dependencies is requested
 *   - `cache-mod` input takes precedence over `cache` input if set
 */
export function needModCache(): Boolean {
    const cache = core.getBooleanInput('cache');
    const modCache = core.getInput('cache-mod').toLowerCase()

    return (modCache === 'true' || cache && modCache !== 'false')
}

/**
 * Checks if the caching of intermediate build files is requested
 *   - `cache-mod` input takes precedence over `cache` input if set
 */
export function needBuildCache(): Boolean {
    const cache = core.getBooleanInput('cache');
    const buildCache = core.getInput('cache-build').toLowerCase()

    return (buildCache === 'true' || cache && buildCache !== 'false')
}

export function getModDependenciesPath(): string {
    return core.getInput('cache-dependency-path')
}

export function getBuildDependenciesPath(): string {
    return core.getInput('cache-build-path') || "**/*.go"
}

export function getBuildCachePath(): Promise<string> {
    return  getCommandOutput('go env GOCACHE')
}