import { describe, expect, test, jest } from '@jest/globals';
import { ProgressSnapshots } from '../../src/speed-meter/progress-snapshots';
import { MS_100, MS_1000 } from '../../src/constants';

const MS_50 = 50000000n;
const MS_75 = 75000000n;

describe('ProgressSnapshots', () => {
    describe('clear', () => {
        test('should reset the internal snapshot list', async () => {
            const ps = new ProgressSnapshots();
            expect(ps['list']).toHaveLength(0);
            ps.clear(1000n);
            expect(ps['list']).toHaveLength(1);
            expect(ps['list'][0]['at']).toEqual(1000n);
            expect(ps['list'][0]['bytesTotal']).toEqual(0);

            ps.add(1000n + MS_100, 5);
            ps.add(1000n + 2n * MS_100, 10);
            expect(ps['list']).toHaveLength(3);

            ps.clear(1000n + 3n * MS_100);
            expect(ps['list']).toHaveLength(1);
            expect(ps['list'][0]['at']).toEqual(300001000n);
            expect(ps['list'][0]['bytesTotal']).toEqual(0);
        });

        test('should reset the internal cache of last duration stats', async () => {
            const ps = new ProgressSnapshots();
            const updateSpy = jest.spyOn(ps as any, 'updateSnapshotList');
            ps.clear(1000n);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            expect(updateSpy).toHaveBeenCalledTimes(1);

            ps.add(1000n + MS_100, 5);
            ps.getLastDurationStats();
            expect(ps['cachedLastDurationStats']).toBeDefined();

            ps.clear(1000n + MS_100);
            expect(updateSpy).toHaveBeenCalledTimes(2);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
        });
    });

    describe('add', () => {
        test('should add snapshot to the end of the list if list contains one snapshot', async () => {
            const ps = new ProgressSnapshots();
            ps.clear(1000n);
            expect(ps['list']).toHaveLength(1);
            ps.add(1000n + MS_100, 5);
            expect(ps['list']).toHaveLength(2);

            ps.clear(1000n);
            expect(ps['list']).toHaveLength(1);
            ps.add(1000n + MS_1000, 5);
            expect(ps['list']).toHaveLength(2);

            ps.clear(1000n);
            expect(ps['list']).toHaveLength(1);
            ps.add(1000n + 2n * MS_1000 + MS_100, 5);
            expect(ps['list']).toHaveLength(2);

            ps.clear(1000n);
            expect(ps['list']).toHaveLength(1);
            ps.add(3n * MS_1000, 5);
            expect(ps['list']).toHaveLength(2);
        });

        test('should add snapshot to the end of the list if the last two snapshots have a time difference of at least 100ms', async () => {
            const ps = new ProgressSnapshots();
            ps.clear(1000n);
            ps.add(1000n + MS_100 - 1n, 5);
            expect(ps['list']).toHaveLength(2);
            ps.add(1000n + MS_100, 5);
            expect(ps['list']).toHaveLength(2); // not added, because existing two snapshots have time diff lower than 100ms

            ps.clear(1000n);
            ps.add(1000n + MS_100, 5);
            expect(ps['list']).toHaveLength(2);
            ps.add(1000n + MS_100 + 1n, 5);
            expect(ps['list']).toHaveLength(3);
            expect(ps['list'][ps['list'].length - 1].bytesTotal).toEqual(5);
            expect(ps['list'][ps['list'].length - 1].at).toEqual(1000n + MS_100 + 1n);

            ps.clear(1000n);
            ps.add(1000n + MS_100, 1);
            expect(ps['list']).toHaveLength(2);
            ps.add(1000n + 2n * MS_100, 5);
            expect(ps['list']).toHaveLength(3);
            expect(ps['list'][ps['list'].length - 1].bytesTotal).toEqual(5);
            expect(ps['list'][ps['list'].length - 1].at).toEqual(1000n + 2n * MS_100);

            ps.clear(1000n);
            ps.add(1000n + 2n * MS_100, 1);
            expect(ps['list']).toHaveLength(2);
            ps.add(1000n + 2n * MS_100 + 1n, 5);
            expect(ps['list']).toHaveLength(3);
            expect(ps['list'][ps['list'].length - 1].bytesTotal).toEqual(5);
            expect(ps['list'][ps['list'].length - 1].at).toEqual(1000n + 2n * MS_100 + 1n);
        });

        test('should replace last snapshot if the last two snapshots have a time difference lower tan 100ms', async () => {
            const ps = new ProgressSnapshots();
            ps.clear(1000n);
            ps.add(1000n + MS_50, 5);
            expect(ps['list']).toHaveLength(2);
            expect(ps['list'][1]['at']).toEqual(1000n + MS_50);
            expect(ps['list'][1]['bytesTotal']).toEqual(5);
            ps.add(1000n + MS_75, 10);
            expect(ps['list']).toHaveLength(2);
            expect(ps['list'][1]['at']).toEqual(1000n + MS_75);
            expect(ps['list'][1]['bytesTotal']).toEqual(10);
            ps.add(1000n + MS_100 - 1n, 20);
            expect(ps['list']).toHaveLength(2);
            expect(ps['list'][1]['at']).toEqual(1000n + MS_100 - 1n);
            expect(ps['list'][1]['bytesTotal']).toEqual(20);
            ps.add(1000n + MS_100, 30);
            expect(ps['list']).toHaveLength(2);
            expect(ps['list'][1]['at']).toEqual(1000n + MS_100);
            expect(ps['list'][1]['bytesTotal']).toEqual(30);
        });

        test('should keep as few as possible snapshots to cover a duration of at least 1s', async () => {
            const ps = new ProgressSnapshots();
            ps.clear(1000n);
            ps.add(1000n + MS_100, 5);
            ps.add(1000n + 2n * MS_100, 10);
            ps.add(1000n + 9n * MS_100, 15);
            ps.add(1000n + MS_1000, 20);
            ps.add(1000n + MS_1000 + 2n * MS_100, 25);
            expect(ps['list'][0].at).toEqual(1000n + 2n * MS_100);
            expect(ps['list'][0].bytesTotal).toEqual(10);
            expect(ps.getLastDurationStats().duration).toEqual(MS_1000);
        });

        test('should reset the internal cache of last duration stats when replacing last snapshot in list', async () => {
            const ps = new ProgressSnapshots();
            const replaceSpy = jest.spyOn(ps as any, 'replaceLastSnapshot');
            ps.clear(1000n);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            ps.add(1000n + MS_50, 5);
            expect(replaceSpy).toHaveBeenCalledTimes(0);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            ps.getLastDurationStats();
            expect(ps['cachedLastDurationStats']).toBeDefined();
            ps.add(1000n + MS_75, 15);
            expect(replaceSpy).toHaveBeenCalledTimes(1);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
        });

        test('should reset the internal cache of last duration stats when adding snapshot to list', async () => {
            const ps = new ProgressSnapshots();
            const addSpy = jest.spyOn(ps as any, 'addSnapshot');
            ps.clear(1000n);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            ps.add(1000n + MS_100, 5);
            expect(addSpy).toHaveBeenCalledTimes(1);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            ps.getLastDurationStats();
            expect(ps['cachedLastDurationStats']).toBeDefined();
            ps.add(1000n + 2n * MS_100, 15);
            expect(addSpy).toHaveBeenCalledTimes(2);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
        });

        test('should reset the internal cache of last duration stats when removing outdated snapshots', async () => {
            const ps = new ProgressSnapshots();
            const removeSpy = jest.spyOn(ps as any, 'removeOutdated');
            const updateSpy = jest.spyOn(ps as any, 'updateSnapshotList');

            ps.clear(1000n);
            ps.add(1000n + MS_100, 5);
            ps.add(1000n + 2n * MS_100, 10);
            ps.add(1000n + 9n * MS_100, 15);
            ps.add(1000n + MS_1000, 20);
            expect(removeSpy).toHaveBeenCalledTimes(4);
            expect(updateSpy).toHaveBeenCalledTimes(1); // by clear()
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            ps.getLastDurationStats();
            expect(ps['cachedLastDurationStats']).toBeDefined();
            ps.add(1000n + MS_1000 + 2n * MS_100, 25);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            expect(removeSpy).toHaveBeenCalledTimes(5);
            expect(updateSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('getLastDurationStats', () => {
        test('should return undefined if there is only one snapshot', async () => {
            const ps = new ProgressSnapshots();
            ps.clear(123n);
            expect(ps['list'].length).toEqual(1);
            expect(ps.getLastDurationStats()).toBeUndefined();
        });

        test('should return newly calculated stats and cache the result', async () => {
            const ps = new ProgressSnapshots();
            ps.clear(MS_1000);
            ps.add(2n * MS_1000, 1024);
            expect(ps['list'].length).toEqual(2);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            const stats = ps.getLastDurationStats();
            expect(stats).toEqual({
                duration: MS_1000,
                bytesTotal: 1024,
            });
            expect(ps['cachedLastDurationStats']).toBe(stats);
        });

        test('should return cached stats if set', async () => {
            const ps = new ProgressSnapshots();
            ps.clear(MS_1000);
            ps.add(2n * MS_1000, 1024);
            expect(ps['cachedLastDurationStats']).toBeUndefined();
            const stats = ps.getLastDurationStats();
            expect(ps['cachedLastDurationStats']).toBe(stats);
            const stats2 = ps.getLastDurationStats();
            expect(ps['cachedLastDurationStats']).toBe(stats);
            expect(ps['cachedLastDurationStats']).toBe(stats2);
        });
    });
});
