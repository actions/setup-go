import * as core from '@actions/core';

export enum StableReleaseAlias {
  Stable = 'stable',
  OldStable = 'oldstable'
}

export const isSelfHosted = (): boolean =>
  process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted' &&
  process.env['AGENT_ISSELFHOSTED'] !== '0';
