export enum StableReleaseAlias {
  Stable = 'stable',
  OldStable = 'oldstable'
}

export const isSelfHosted = (): boolean =>
  process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted' &&
  (process.env['AGENT_ISSELFHOSTED'] === '1' ||
    process.env['AGENT_ISSELFHOSTED'] === undefined);
/* the above is simplified from:
    process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted' && process.env['AGENT_ISSELFHOSTED'] === '1'
    ||
    process.env['RUNNER_ENVIRONMENT'] !== 'github-hosted' && process.env['AGENT_ISSELFHOSTED'] === undefined
*/
