import * as cache from '@actions/cache';
import * as core from '@actions/core';
import fs from 'fs';

import * as cacheSave from '../src/cache-save';
import * as cacheUtils from '../src/cache-utils';
import {PackageManagerInfo} from '../src/package-managers';
import {State} from '../src/constants';

describe('cache-save', () => {
  let getCacheDirectoryPathSpy: jest.SpyInstance;
  let saveCacheSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warningSpy: jest.SpyInstance;
  let getBooleanInputSpy: jest.SpyInstance;
  let getStateSpy: jest.SpyInstance;
  let existsSyncSpy: jest.SpyInstance;

  let stateStore: Record<string, string>;

  beforeEach(() => {
    stateStore = {};

    getCacheDirectoryPathSpy = jest.spyOn(cacheUtils, 'getCacheDirectoryPath');
    saveCacheSpy = jest.spyOn(cache, 'saveCache');
    infoSpy = jest.spyOn(core, 'info').mockImplementation();
    warningSpy = jest.spyOn(core, 'warning').mockImplementation();
    getBooleanInputSpy = jest.spyOn(core, 'getBooleanInput');
    getStateSpy = jest.spyOn(core, 'getState').mockImplementation(key => {
      return stateStore[key] || '';
    });
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    getCacheDirectoryPathSpy.mockImplementation(
      (PackageManager: PackageManagerInfo) => {
        return Promise.resolve(['/home/runner/go/pkg/mod']);
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('run', () => {
    it('should skip cache save when cache input is false', async () => {
      getBooleanInputSpy.mockReturnValue(false);

      await cacheSave.run(false);

      expect(saveCacheSpy).not.toHaveBeenCalled();
    });

    it('should save cache with legacy single key', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      stateStore[State.CachePrimaryKey] = 'primary-key-123';
      stateStore[State.CacheMatchedKey] = '';
      saveCacheSpy.mockResolvedValue(12345);

      await cacheSave.run(false);

      expect(saveCacheSpy).toHaveBeenCalledTimes(1);
      expect(saveCacheSpy).toHaveBeenCalledWith(
        ['/home/runner/go/pkg/mod'],
        'primary-key-123'
      );
    });

    it('should skip save when cache hit occurred (legacy mode)', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      stateStore[State.CachePrimaryKey] = 'primary-key-123';
      stateStore[State.CacheMatchedKey] = 'primary-key-123';

      await cacheSave.run(false);

      expect(saveCacheSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit occurred on the primary key')
      );
    });
  });

  describe('multiple invocations', () => {
    it('should save cache for multiple keys from multiple invocations', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      stateStore[State.CachePrimaryKeys] = JSON.stringify([
        'key-go-1.13.1',
        'key-go-1.20.0'
      ]);
      stateStore[State.CacheMatchedKeys] = JSON.stringify(['', '']);
      saveCacheSpy.mockResolvedValue(12345);

      await cacheSave.run(false);

      expect(saveCacheSpy).toHaveBeenCalledTimes(2);
      expect(saveCacheSpy).toHaveBeenNthCalledWith(
        1,
        ['/home/runner/go/pkg/mod'],
        'key-go-1.13.1'
      );
      expect(saveCacheSpy).toHaveBeenNthCalledWith(
        2,
        ['/home/runner/go/pkg/mod'],
        'key-go-1.20.0'
      );
    });

    it('should skip save for keys that had cache hits', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      stateStore[State.CachePrimaryKeys] = JSON.stringify([
        'key-go-1.13.1',
        'key-go-1.20.0'
      ]);
      // First key had a cache hit, second didn't
      stateStore[State.CacheMatchedKeys] = JSON.stringify([
        'key-go-1.13.1',
        ''
      ]);
      saveCacheSpy.mockResolvedValue(12345);

      await cacheSave.run(false);

      // Should only save for the second key
      expect(saveCacheSpy).toHaveBeenCalledTimes(1);
      expect(saveCacheSpy).toHaveBeenCalledWith(
        ['/home/runner/go/pkg/mod'],
        'key-go-1.20.0'
      );
    });

    it('should handle cache already exists error gracefully', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      stateStore[State.CachePrimaryKeys] = JSON.stringify([
        'key-go-1.13.1',
        'key-go-1.20.0'
      ]);
      stateStore[State.CacheMatchedKeys] = JSON.stringify(['', '']);

      saveCacheSpy
        .mockRejectedValueOnce(new Error('Cache already exists'))
        .mockResolvedValueOnce(12345);

      await cacheSave.run(false);

      expect(saveCacheSpy).toHaveBeenCalledTimes(2);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache already exists')
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache saved with the key: key-go-1.20.0')
      );
    });

    it('should handle empty state gracefully', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      // No state set

      await cacheSave.run(false);

      expect(saveCacheSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Primary key was not generated')
      );
    });

    it('should prefer multi-key state over legacy single-key state', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      // Both legacy and multi-key state present
      stateStore[State.CachePrimaryKey] = 'legacy-key';
      stateStore[State.CacheMatchedKey] = '';
      stateStore[State.CachePrimaryKeys] = JSON.stringify(['multi-key-1']);
      stateStore[State.CacheMatchedKeys] = JSON.stringify(['']);
      saveCacheSpy.mockResolvedValue(12345);

      await cacheSave.run(false);

      // Should use multi-key state
      expect(saveCacheSpy).toHaveBeenCalledTimes(1);
      expect(saveCacheSpy).toHaveBeenCalledWith(
        ['/home/runner/go/pkg/mod'],
        'multi-key-1'
      );
    });

    it('should log summary for multiple invocations', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      stateStore[State.CachePrimaryKeys] = JSON.stringify([
        'key-go-1.13.1',
        'key-go-1.20.0',
        'key-go-1.21.0'
      ]);
      // First had cache hit, second and third didn't
      stateStore[State.CacheMatchedKeys] = JSON.stringify([
        'key-go-1.13.1',
        '',
        ''
      ]);
      saveCacheSpy.mockResolvedValue(12345);

      await cacheSave.run(false);

      expect(saveCacheSpy).toHaveBeenCalledTimes(2);
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Saved: 2'));
    });

    it('should warn when cache folder does not exist', async () => {
      getBooleanInputSpy.mockReturnValue(true);
      stateStore[State.CachePrimaryKeys] = JSON.stringify(['key-go-1.13.1']);
      stateStore[State.CacheMatchedKeys] = JSON.stringify(['']);
      existsSyncSpy.mockReturnValue(false);

      await cacheSave.run(false);

      expect(warningSpy).toHaveBeenCalledWith(
        'There are no cache folders on the disk'
      );
      expect(saveCacheSpy).not.toHaveBeenCalled();
    });
  });
});
