import * as cache from '@actions/cache';
import * as core from '@actions/core';
import fs from 'fs';

import {run} from '../src/cache-save';
import * as cacheUtils from '../src/cache-utils';
import {State} from '../src/constants';

describe('cache-save', () => {
  const primaryKey = 'primary-key';

  let primaryKeyValue: string;
  let matchedKeyValue: string;

  let getBooleanInputSpy: jest.SpyInstance;
  let getStateSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warningSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let setFailedSpy: jest.SpyInstance;
  let saveCacheSpy: jest.SpyInstance;
  let getCacheDirectoryPathSpy: jest.SpyInstance;
  let existsSpy: jest.SpyInstance;

  beforeEach(() => {
    primaryKeyValue = primaryKey;
    matchedKeyValue = 'matched-key';

    getBooleanInputSpy = jest.spyOn(core, 'getBooleanInput');
    getBooleanInputSpy.mockReturnValue(true);

    getStateSpy = jest.spyOn(core, 'getState');
    getStateSpy.mockImplementation((key: string) => {
      if (key === State.CachePrimaryKey) {
        return primaryKeyValue;
      }
      if (key === State.CacheMatchedKey) {
        return matchedKeyValue;
      }
      return '';
    });

    infoSpy = jest.spyOn(core, 'info');
    infoSpy.mockImplementation(() => undefined);

    warningSpy = jest.spyOn(core, 'warning');
    warningSpy.mockImplementation(() => undefined);

    debugSpy = jest.spyOn(core, 'debug');
    debugSpy.mockImplementation(() => undefined);

    setFailedSpy = jest.spyOn(core, 'setFailed');
    setFailedSpy.mockImplementation(() => undefined);

    saveCacheSpy = jest.spyOn(cache, 'saveCache');
    saveCacheSpy.mockImplementation(() => Promise.resolve(0));

    getCacheDirectoryPathSpy = jest.spyOn(cacheUtils, 'getCacheDirectoryPath');
    getCacheDirectoryPathSpy.mockImplementation(() =>
      Promise.resolve(['cache_directory_path', 'cache_directory_path'])
    );

    existsSpy = jest.spyOn(fs, 'existsSync');
    existsSpy.mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
