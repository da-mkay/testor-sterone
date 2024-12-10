import { describe, beforeEach, expect, test, jest, afterEach } from '@jest/globals';
import { SpeedMeterBase } from '../../src/speed-meter/speed-meter-base';
import { MS_1000 } from '../../src/constants';

const MB_1 = 1024 * 1024;
const MS_1 = 1000000n;

class SpeedMeterMock extends SpeedMeterBase {
    stop(): void {
        throw new Error('Method not implemented.');
    }
    doUpdateStats() {
        this.updateStats(process.hrtime.bigint());
    }
}

describe('SpeedMeterBase', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(async () => {
        if ((global.Date as any).isFake) {
            await jest.runOnlyPendingTimersAsync();
            jest.useRealTimers();
        }
    });

    describe('start', () => {
        test('should reset all values', async () => {
            const sm = new SpeedMeterMock();
            sm.start(MB_1);
            jest.advanceTimersByTime(1000);
            sm.addBytes(MB_1);
            const startTime = sm['startTime'];
            expect(sm['progressSnapshots']['list'].length).toEqual(2);
            expect(sm['bytesSumTotal']).toEqual(MB_1);
            expect(sm['size']).toEqual(MB_1);
            expect(sm['curSpeed']).toEqual(MB_1);
            expect(sm['avgSpeed']).toEqual(MB_1);
            expect(sm['minSpeed']).toEqual(MB_1);
            expect(sm['maxSpeed']).toEqual(MB_1);
            expect(sm['secondsElapsed']).toEqual(1);
            expect(sm['secondsRemaining']).toEqual(0);

            jest.advanceTimersByTime(1000);
            sm.start(2 * MB_1);
            expect(sm['startTime']).toEqual(startTime + 2n * MS_1000);
            expect(sm['progressSnapshots']['list'].length).toEqual(1);
            expect(sm['bytesSumTotal']).toEqual(0);
            expect(sm['size']).toEqual(2 * MB_1);
            expect(sm['curSpeed']).toBeUndefined();
            expect(sm['avgSpeed']).toBeUndefined();
            expect(sm['minSpeed']).toBeUndefined();
            expect(sm['maxSpeed']).toBeUndefined();
            expect(sm['secondsElapsed']).toBeUndefined();
            expect(sm['secondsRemaining']).toBeUndefined();
        });
    });

    describe('getStats', () => {
        test('should return current stats', async () => {
            const sm = new SpeedMeterMock();
            sm.start(MB_1);
            jest.advanceTimersByTime(1000);
            sm.addBytes(MB_1);
            const expected = {
                bytesSumTotal: sm['bytesSumTotal'],
                size: sm['size'],
                curSpeed: sm['curSpeed'],
                minSpeed: sm['minSpeed'],
                maxSpeed: sm['maxSpeed'],
                avgSpeed: sm['avgSpeed'],
                secondsElapsed: sm['secondsElapsed'],
                secondsRemaining: sm['secondsRemaining'],
            };
            expect(sm.getStats()).toEqual(expected);
        });
    });

    describe('addBytes', () => {
        test('should do nothing if passed number of bytes is lower than 1', async () => {
            const sm = new SpeedMeterMock();
            sm.start(MB_1);
            const expected = {
                size: MB_1,
                bytesSumTotal: 0,
                curSpeed: undefined,
                minSpeed: undefined,
                maxSpeed: undefined,
                avgSpeed: undefined,
                secondsElapsed: undefined,
                secondsRemaining: undefined,
            };
            sm.addBytes(0);
            expect(sm['progressSnapshots']['list'].length).toEqual(1);
            expect(sm.getStats()).toEqual(expected);
            sm.addBytes(-1);
            expect(sm['progressSnapshots']['list'].length).toEqual(1);
            expect(sm.getStats()).toEqual(expected);
        });

        test('should increase bytesSumTotal by specified number of bytes', async () => {
            jest.useRealTimers();
            const sm = new SpeedMeterMock();
            sm.start(MB_1);
            sm.addBytes(1024);
            expect(sm.getStats().bytesSumTotal).toEqual(1024);
            sm.addBytes(1024);
            expect(sm.getStats().bytesSumTotal).toEqual(2048);
        });

        test('should add progress snapshots', async () => {
            jest.useRealTimers();
            const sm = new SpeedMeterMock();
            const addSpy = jest.spyOn(sm['progressSnapshots'], 'add');
            sm.start(MB_1);
            expect(addSpy).toHaveBeenCalledTimes(0);
            sm.addBytes(1024);
            expect(addSpy).toHaveBeenCalledTimes(1);
            expect(addSpy).toHaveBeenNthCalledWith(1, expect.anything(), 1024);
            sm.addBytes(123);
            expect(addSpy).toHaveBeenCalledTimes(2);
            expect(addSpy).toHaveBeenNthCalledWith(2, expect.anything(), 1024 + 123);
        });

        test('should not emit "longOperation" if transfer duration is lower than or equal to 1s', async () => {
            const sm = new SpeedMeterMock();
            const emitSpy = jest.spyOn(sm, 'emit');
            sm.start(2 * MB_1);
            jest.advanceTimersByTime(999);
            sm.addBytes(MB_1);
            expect(emitSpy).toHaveBeenCalledTimes(0);
            jest.advanceTimersByTime(1000);
            sm.addBytes(MB_1);
            expect(emitSpy).toHaveBeenCalledTimes(0);
        });

        test('should emit "longOperation" if transfer duration is greater than 1s', async () => {
            const sm = new SpeedMeterMock();
            const emitSpy = jest.spyOn(sm, 'emit');
            sm.start(2 * MB_1);
            jest.advanceTimersByTime(1001);
            sm.addBytes(MB_1);
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenNthCalledWith(1, 'longOperation', MS_1000 + MS_1, MB_1);
            jest.advanceTimersByTime(2000);
            sm.addBytes(1024);
            expect(emitSpy).toHaveBeenCalledTimes(2);
            expect(emitSpy).toHaveBeenNthCalledWith(2, 'longOperation', 2n * MS_1000, 1024);
        });

        test('should call updateStats with current time', async () => {
            const sm = new SpeedMeterMock();
            const updateSpy = jest.spyOn(sm as any, 'updateStats');
            sm.start(MB_1);
            jest.advanceTimersByTime(1234);
            sm.addBytes(1024);
            expect(updateSpy).toHaveBeenCalledTimes(1);
            expect(updateSpy).toHaveBeenNthCalledWith(1, BigInt(1234) * MS_1);
            jest.advanceTimersByTime(4321);
            sm.addBytes(1024);
            expect(updateSpy).toHaveBeenCalledTimes(2);
            expect(updateSpy).toHaveBeenNthCalledWith(2, BigInt(1234 + 4321) * MS_1);
        });
    });

    describe('updateStats', () => {
        test('should not calculate stats (except elapsed time) if ProgressSnapshots provides undefined stats', () => {
            const sm = new SpeedMeterMock();
            const updateSpy = jest.spyOn(sm as any, 'updateStats');
            sm.start(MB_1);
            jest.advanceTimersByTime(1234);
            // no addBytes call in between, so progressSnapshots contains only 1 entry
            // --> progressSnapshots.getLastDurationStats() returns undefined
            expect(sm['progressSnapshots']['list'].length).toEqual(1);
            expect(sm['progressSnapshots'].getLastDurationStats()).toBeUndefined();
            expect(updateSpy).toHaveBeenCalledTimes(0);
            sm.doUpdateStats();
            expect(updateSpy).toHaveBeenCalledTimes(1);
            expect(updateSpy).toHaveNthReturnedWith(1, undefined);
            expect(sm['progressSnapshots']['list'].length).toEqual(1);
            expect(sm['progressSnapshots'].getLastDurationStats()).toBeUndefined();
            const expected = {
                size: MB_1,
                bytesSumTotal: 0,
                curSpeed: undefined,
                minSpeed: undefined,
                maxSpeed: undefined,
                avgSpeed: undefined,
                secondsElapsed: 1,
                secondsRemaining: undefined,
            };
            expect(sm.getStats()).toEqual(expected);
        });

        test('should calculate stats once we have data for at least 1s', () => {
            const sm = new SpeedMeterMock();
            const updateSpy = jest.spyOn(sm as any, 'updateStats');
            sm.start(6 * MB_1);
            jest.advanceTimersByTime(500);
            expect(updateSpy).toHaveBeenCalledTimes(0);
            sm.addBytes(MB_1);
            expect(updateSpy).toHaveBeenCalledTimes(1);
            const expected1 = {
                size: 6 * MB_1,
                bytesSumTotal: MB_1,
                curSpeed: undefined,
                minSpeed: undefined,
                maxSpeed: undefined,
                avgSpeed: undefined,
                secondsElapsed: 0,
                secondsRemaining: undefined,
            };
            expect(sm.getStats()).toEqual(expected1);

            jest.advanceTimersByTime(499); // not yet 1s passed
            expect(updateSpy).toHaveBeenCalledTimes(1);
            sm.addBytes(MB_1);
            expect(updateSpy).toHaveBeenCalledTimes(2);
            const expected2 = {
                size: 6 * MB_1,
                bytesSumTotal: 2 * MB_1,
                curSpeed: undefined,
                minSpeed: undefined,
                maxSpeed: undefined,
                avgSpeed: undefined,
                secondsElapsed: 0,
                secondsRemaining: undefined,
            };
            expect(sm.getStats()).toEqual(expected2);

            jest.advanceTimersByTime(1); // now 1s passed
            expect(updateSpy).toHaveBeenCalledTimes(2);
            sm.addBytes(MB_1);
            expect(updateSpy).toHaveBeenCalledTimes(3);
            const expected3 = {
                size: 6 * MB_1,
                bytesSumTotal: 3 * MB_1,
                curSpeed: 3145728,
                minSpeed: 3145728,
                maxSpeed: 3145728,
                avgSpeed: 3145728,
                secondsElapsed: 1,
                secondsRemaining: 1,
            };
            expect(sm.getStats()).toEqual(expected3);

            jest.advanceTimersByTime(1000); // another 1s passed
            expect(updateSpy).toHaveBeenCalledTimes(3);
            sm.addBytes(MB_1 / 2);
            expect(updateSpy).toHaveBeenCalledTimes(4);
            const expected4 = {
                size: 6 * MB_1,
                bytesSumTotal: 3 * MB_1 + MB_1 / 2,
                curSpeed: 1571292,
                minSpeed: 1571292,
                maxSpeed: 3145728,
                avgSpeed: 1835008,
                secondsElapsed: 2,
                secondsRemaining: 2,
            };
            expect(sm.getStats()).toEqual(expected4);

            jest.advanceTimersByTime(1000); // another 1s passed
            expect(updateSpy).toHaveBeenCalledTimes(4);
            sm.addBytes(MB_1);
            expect(updateSpy).toHaveBeenCalledTimes(5);
            const expected5 = {
                size: 6 * MB_1,
                bytesSumTotal: 4 * MB_1 + MB_1 / 2,
                curSpeed: MB_1,
                minSpeed: MB_1,
                maxSpeed: 3145728,
                avgSpeed: 1572864,
                secondsElapsed: 3,
                secondsRemaining: 2,
            };
            expect(sm.getStats()).toEqual(expected5);
        });
    });
});
