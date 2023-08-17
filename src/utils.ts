import * as core from '@actions/core';

export enum StableReleaseAlias {
  Stable = 'stable',
  OldStable = 'oldstable'
}

export const isSelfHosted = (): boolean =>
  process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted' &&
  process.env['AGENT_ISSELFHOSTED'] === '1';

export const getCacheInput = (): boolean => {
  // for self-hosted environment turn off cache by default
  if (isSelfHosted() && core.getInput('cache') === '') return false;

  return core.getBooleanInput('cache');
};
