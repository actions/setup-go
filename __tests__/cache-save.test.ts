import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

jest.unstable_mockModule('@actions/cache', () => ({
  saveCache: jest.fn(),
  restoreCache: jest.fn(),
  isFeatureAvailable: jest.fn()
}));

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getState: jest.fn(),
  saveState: jest.fn()
}));

const realFs = (await import('fs')).default;
const fsExports = {...realFs, existsSync: jest.fn()};
jest.unstable_mockModule('fs', () => ({...fsExports, default: fsExports}));

// Import real cache-utils (with mocked @actions) before mocking it
const realCacheUtils = await import('../src/cache-utils.js');

jest.unstable_mockModule('../src/cache-utils.js', () => ({
  ...realCacheUtils,
  getCacheDirectoryPath: jest.fn()
}));

const cache = await import('@actions/cache');
const core = await import('@actions/core');
const fs = (await import('fs')).default;
const cacheUtils = await import('../src/cache-utils.js');
const {run} = await import('../src/cache-save.js');
const {State} = await import('../src/constants.js');

describe('cache-save', () => {
  const primaryKey = 'primary-key';

  let primaryKeyValue: string;
  let matchedKeyValue: string;

  let getBooleanInputSpy: jest.Mock<typeof core.getBooleanInput>;
  let getStateSpy: jest.Mock<typeof core.getState>;
  let infoSpy: jest.Mock<typeof core.info>;
  let warningSpy: jest.Mock<typeof core.warning>;
  let debugSpy: jest.Mock<typeof core.debug>;
  let setFailedSpy: jest.Mock<typeof core.setFailed>;
  let saveCacheSpy: jest.Mock<typeof cache.saveCache>;
  let getCacheDirectoryPathSpy: jest.Mock<
    typeof cacheUtils.getCacheDirectoryPath
  >;
  let existsSpy: jest.Mock<typeof fs.existsSync>;

  beforeEach(() => {
    primaryKeyValue = primaryKey;
    matchedKeyValue = 'matched-key';

    getBooleanInputSpy = core.getBooleanInput as jest.Mock<
      typeof core.getBooleanInput
    >;
    getBooleanInputSpy.mockReturnValue(true);

    getStateSpy = core.getState as jest.Mock<typeof core.getState>;
    getStateSpy.mockImplementation((key: string) => {
      if (key === State.CachePrimaryKey) {
        return primaryKeyValue;
      }
      if (key === State.CacheMatchedKey) {
        return matchedKeyValue;
      }
      return '';
    });

    infoSpy = core.info as jest.Mock<typeof core.info>;
    infoSpy.mockImplementation(() => undefined);

    warningSpy = core.warning as jest.Mock<typeof core.warning>;
    warningSpy.mockImplementation(() => undefined);

    debugSpy = core.debug as jest.Mock<typeof core.debug>;
    debugSpy.mockImplementation(() => undefined);

    setFailedSpy = core.setFailed as jest.Mock<typeof core.setFailed>;
    setFailedSpy.mockImplementation(() => undefined);

    saveCacheSpy = cache.saveCache as jest.Mock<typeof cache.saveCache>;
    saveCacheSpy.mockImplementation(() => Promise.resolve(0));

    getCacheDirectoryPathSpy = cacheUtils.getCacheDirectoryPath as jest.Mock<
      typeof cacheUtils.getCacheDirectoryPath
    >;
    getCacheDirectoryPathSpy.mockImplementation(() =>
      Promise.resolve(['cache_directory_path', 'cache_directory_path'])
    );

    existsSpy = fs.existsSync as jest.Mock<typeof fs.existsSync>;
    existsSpy.mockImplementation(() => true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not save cache when the cache input is false', async () => {
    getBooleanInputSpy.mockReturnValue(false);

    await run();

    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(warningSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('does not save cache when there are no cache folders on the disk', async () => {
    existsSpy.mockImplementation(() => false);

    await run();

    expect(warningSpy).toHaveBeenCalledWith(
      'There are no cache folders on the disk'
    );
    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('does not save cache when the primary key was not generated', async () => {
    primaryKeyValue = '';

    await run();

    expect(infoSpy).toHaveBeenCalledWith(
      'Primary key was not generated. Please check the log messages above for more errors or information'
    );
    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('does not save cache when a cache hit occurred on the primary key', async () => {
    matchedKeyValue = primaryKey;

    await run();

    expect(infoSpy).toHaveBeenCalledWith(
      `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    expect(saveCacheSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('saves cache when the primary key differs from the matched key', async () => {
    await run();

    expect(saveCacheSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      `Cache saved with the key: ${primaryKey}`
    );
    expect(warningSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('save with -1 cacheId , should not fail workflow', async () => {
    saveCacheSpy.mockImplementation(() => Promise.resolve(-1));

    await run();

    expect(saveCacheSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      `Cache was not saved for the key: ${primaryKey}`
    );
    expect(infoSpy).not.toHaveBeenCalledWith(
      `Cache saved with the key: ${primaryKey}`
    );
    expect(warningSpy).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  it('saves with error from toolkit, should not fail workflow', async () => {
    saveCacheSpy.mockImplementation(() =>
      Promise.reject(new Error('Unable to reach the service'))
    );

    await run();

    expect(saveCacheSpy).toHaveBeenCalled();
    expect(warningSpy).toHaveBeenCalledWith('Unable to reach the service');
    expect(setFailedSpy).not.toHaveBeenCalled();
  });
});
