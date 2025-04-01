import {isSelfHosted} from '../src/utils';

describe('utils', () => {
  describe('isSelfHosted', () => {
    let AGENT_ISSELFHOSTED: string | undefined;
    let RUNNER_ENVIRONMENT: string | undefined;

    beforeEach(() => {
      AGENT_ISSELFHOSTED = process.env['AGENT_ISSELFHOSTED'];
      delete process.env['AGENT_ISSELFHOSTED'];
      RUNNER_ENVIRONMENT = process.env['RUNNER_ENVIRONMENT'];
      delete process.env['RUNNER_ENVIRONMENT'];
    });

    afterEach(() => {
      if (AGENT_ISSELFHOSTED === undefined) {
        delete process.env['AGENT_ISSELFHOSTED'];
      } else {
        process.env['AGENT_ISSELFHOSTED'] = AGENT_ISSELFHOSTED;
      }
      if (RUNNER_ENVIRONMENT === undefined) {
        delete process.env['RUNNER_ENVIRONMENT'];
      } else {
        process.env['RUNNER_ENVIRONMENT'] = RUNNER_ENVIRONMENT;
      }
    });

    it('isSelfHosted should be true if no environment variables set', () => {
      expect(isSelfHosted()).toBeTruthy();
    });

    it('isSelfHosted should be true if environment variable is not set to denote GitHub hosted', () => {
      process.env['RUNNER_ENVIRONMENT'] = 'some';
      expect(isSelfHosted()).toBeTruthy();
    });

    it('isSelfHosted should be true if environment variable set to denote Azure Pipelines self hosted', () => {
      process.env['AGENT_ISSELFHOSTED'] = '1';
      expect(isSelfHosted()).toBeTruthy();
    });

    it('isSelfHosted should be false if environment variable set to denote GitHub hosted', () => {
      process.env['RUNNER_ENVIRONMENT'] = 'github-hosted';
      expect(isSelfHosted()).toBeFalsy();
    });

    it('isSelfHosted should be false if environment variable is not set to denote Azure Pipelines self hosted', () => {
      process.env['AGENT_ISSELFHOSTED'] = 'some';
      expect(isSelfHosted()).toBeFalsy();
    });
  });
});
