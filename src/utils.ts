export enum StableReleaseAlias {
  Stable = 'stable',
  OldStable = 'oldstable'
}

export const isSelfHosted = (): boolean =>
  process.env['AGENT_ISSELFHOSTED'] === '1' ||
  (process.env['AGENT_ISSELFHOSTED'] === undefined &&
    process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted');
/* the above is simplified from:
    process.env['RUNNER_ENVIRONMENT'] === undefined && process.env['AGENT_ISSELFHOSTED'] === '1'
    ||
    process.env['AGENT_ISSELFHOSTED'] === undefined && process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted'
     */
