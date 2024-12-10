jest.mock('../../src/format', () => {
    const originalModule = jest.requireActual('../../src/format') as any;
    return {
        ...originalModule,
        formatSize: jest.fn(),
        formatTime: jest.fn(),
    };
});

import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { ConsoleSpeedMeter } from '../../src/speed-meter/console-speed-meter';
import { formatSize, formatTime } from '../../src/format';
import { MS_1000 } from '../../src/constants';

const MB_1 = 1024 * 1024;
const MS_500 = 500000000n;

class StdoutMock {
    private lines = [''];
    private cursorY = 0;

    clearLine(dir: number, clb?: () => void) {
        if (dir !== 0) {
            throw new Error('"dir !== 0" not implemented in mocked clearLine!');
        }
        this.lines[this.cursorY] = '';
        if (clb) {
            clb();
        }
        return true;
    }

    moveCursor(dx: number, dy: number, clb?: () => void) {
        if (dx !== 0 || dy !== -1) {
            throw new Error('"dx !== 0" and "dy !== -1" not implemented in mocked moveCursor!');
        }
        this.cursorY += dy;
        if (clb) {
            clb();
        }
        return true;
    }

    write(buf: string, enc?: string, clb?: () => void) {
        if (typeof buf !== 'string') {
            throw new Error('Only strings are supported in mocked write!');
        }
        if (!buf.endsWith('\n')) {
            throw new Error('Only strings ending with "\n" are supported in mocked write!');
        } // --> strings end with newline, thus cursorX will always be 0
        if (enc !== undefined) {
            throw new Error('"encoding !== undefined" not supported in mocked write!');
        }
        const lines = buf.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const lineNo = this.cursorY + i;
            const curLine = this.lines[lineNo] || '';
            this.lines[lineNo] = lines[i] + curLine.substring(lines[i].length);
        }
        this.cursorY += lines.length - 1;
        if (clb) {
            clb();
        }
        return true;
    }

    getCurrentOutput() {
        return this.lines.join('\n');
    }
}

describe('ConsoleSpeedMeter', () => {
    beforeEach(() => {
        const formatModule = jest.requireActual('../../src/format') as { formatSize: typeof formatSize; formatTime: typeof formatTime };
        (formatSize as jest.Mock<typeof formatSize>).mockImplementation((bytes) => formatModule.formatSize(bytes));
        (formatTime as jest.Mock<typeof formatTime>).mockImplementation((secs) => formatModule.formatTime(secs));
        jest.useFakeTimers();
    });

    afterEach(async () => {
        if ((global.Date as any).isFake) {
            await jest.runOnlyPendingTimersAsync();
            jest.useRealTimers();
        }
    });

    describe('start', () => {
        test('should start calling updateStats and printStats every 500ms', async () => {
            const csm = new ConsoleSpeedMeter('', true);
            csm['out'] = new StdoutMock() as any;
            const updateSpy = jest.spyOn(csm as any, 'updateStats');
            const printSpy = jest.spyOn(csm as any, 'printStats');

            expect(jest.getTimerCount()).toEqual(0);
            expect(updateSpy).toHaveBeenCalledTimes(0);
            expect(printSpy).toHaveBeenCalledTimes(0);
            csm.start(MB_1);
            expect(jest.getTimerCount()).toEqual(1);
            expect(updateSpy).toHaveBeenCalledTimes(0);
            expect(printSpy).toHaveBeenCalledTimes(0);

            await jest.advanceTimersToNextTimerAsync();
            expect(jest.getTimerCount()).toEqual(1);
            expect(updateSpy).toHaveBeenCalledTimes(1);
            expect(updateSpy).toHaveBeenNthCalledWith(1, MS_500);
            expect(printSpy).toHaveBeenCalledTimes(1);
            expect(process.hrtime.bigint()).toEqual(MS_500);

            await jest.advanceTimersToNextTimerAsync();
            expect(jest.getTimerCount()).toEqual(1);
            expect(updateSpy).toHaveBeenCalledTimes(2);
            expect(updateSpy).toHaveBeenNthCalledWith(2, MS_1000);
            expect(printSpy).toHaveBeenCalledTimes(2);
            expect(process.hrtime.bigint()).toEqual(MS_1000);
        });
    });

    describe('stop', () => {
        test('should stop calling updateStats and printStats every 500ms and call printStats once', async () => {
            const csm = new ConsoleSpeedMeter('', true);
            csm['out'] = new StdoutMock() as any;
            const updateSpy = jest.spyOn(csm as any, 'updateStats');
            const printSpy = jest.spyOn(csm as any, 'printStats');

            expect(jest.getTimerCount()).toEqual(0);
            expect(updateSpy).toHaveBeenCalledTimes(0);
            expect(printSpy).toHaveBeenCalledTimes(0);
            csm.start(MB_1);
            expect(jest.getTimerCount()).toEqual(1);
            expect(updateSpy).toHaveBeenCalledTimes(0);
            expect(printSpy).toHaveBeenCalledTimes(0);
            csm.stop();

            expect(jest.getTimerCount()).toEqual(0);
            expect(updateSpy).toHaveBeenCalledTimes(0);
            expect(printSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('printStats', () => {
        test('should indent each non-empty line', async () => {
            const csm = new ConsoleSpeedMeter('@@@', false);
            const stdoutMock = new StdoutMock();
            csm['out'] = stdoutMock as any;
            jest.spyOn(csm, 'getStats').mockReturnValueOnce({
                size: MB_1,
                bytesSumTotal: 0,
                avgSpeed: undefined,
                curSpeed: undefined,
                maxSpeed: undefined,
                minSpeed: undefined,
                secondsElapsed: undefined,
                secondsRemaining: undefined,
            });
            csm['printStats']();
            const lines = stdoutMock.getCurrentOutput().split('\n');
            expect(lines.filter((line) => line !== '').every((line) => line.startsWith('@@@'))).toEqual(true);
        });

        test('should print zeros for each undefined value', async () => {
            const csm = new ConsoleSpeedMeter('', false);
            const stdoutMock = new StdoutMock();
            csm['out'] = stdoutMock as any;
            jest.spyOn(csm, 'getStats').mockReturnValueOnce({
                size: MB_1,
                bytesSumTotal: 0,
                avgSpeed: undefined,
                curSpeed: undefined,
                maxSpeed: undefined,
                minSpeed: undefined,
                secondsElapsed: undefined,
                secondsRemaining: undefined,
            });
            csm['printStats']();
            expect(stdoutMock.getCurrentOutput())
                .toEqual(`Speed:     [CUR]   0.00 B/s   [AVG]   0.00 B/s   [MIN]   0.00 B/s   [MAX]   0.00 B/s
Progress:  0.00 %   (0 B = 0.00 B)
Elapsed:   00d 00h 00m 00s
Remaining: 00d 00h 00m 00s
`);
        });

        test('should reset current output on each call', async () => {
            const csm = new ConsoleSpeedMeter('', false);
            const stdoutMock = new StdoutMock();
            csm['out'] = stdoutMock as any;
            const statsSpy = jest.spyOn(csm, 'getStats');
            statsSpy.mockReturnValueOnce({
                size: MB_1,
                bytesSumTotal: 0,
                avgSpeed: undefined,
                curSpeed: undefined,
                maxSpeed: undefined,
                minSpeed: undefined,
                secondsElapsed: undefined,
                secondsRemaining: undefined,
            });
            csm['printStats']();
            expect(stdoutMock.getCurrentOutput())
                .toEqual(`Speed:     [CUR]   0.00 B/s   [AVG]   0.00 B/s   [MIN]   0.00 B/s   [MAX]   0.00 B/s
Progress:  0.00 %   (0 B = 0.00 B)
Elapsed:   00d 00h 00m 00s
Remaining: 00d 00h 00m 00s
`);

            statsSpy.mockReturnValueOnce({
                size: MB_1,
                bytesSumTotal: 0,
                avgSpeed: 1,
                curSpeed: 2,
                maxSpeed: 3,
                minSpeed: 4,
                secondsElapsed: 5,
                secondsRemaining: 6,
            });
            csm['printStats']();
            expect(stdoutMock.getCurrentOutput())
                .toEqual(`Speed:     [CUR]   2.00 B/s   [AVG]   1.00 B/s   [MIN]   4.00 B/s   [MAX]   3.00 B/s
Progress:  0.00 %   (0 B = 0.00 B)
Elapsed:   00d 00h 00m 05s
Remaining: 00d 00h 00m 06s
`);
        });

        test('should use formatSize() for to render speeds and progress', async () => {
            (formatSize as jest.Mock<typeof formatSize>).mockImplementation((bytes) => '#' + bytes + '.AB#');
            const csm = new ConsoleSpeedMeter('', false);
            const stdoutMock = new StdoutMock();
            csm['out'] = stdoutMock as any;
            jest.spyOn(csm, 'getStats').mockReturnValue({
                size: MB_1,
                bytesSumTotal: 1,
                minSpeed: 2,
                avgSpeed: 3,
                curSpeed: 4,
                maxSpeed: 5,
                secondsElapsed: undefined,
                secondsRemaining: undefined,
            });
            csm['printStats']();
            expect(stdoutMock.getCurrentOutput()).toEqual(`Speed:     [CUR]  #4.AB#/s   [AVG]  #3.AB#/s   [MIN]  #2.AB#/s   [MAX]  #5.AB#/s
Progress:  0.00 %   (1 B = #1.AB#)
Elapsed:   00d 00h 00m 00s
Remaining: 00d 00h 00m 00s
`);
            expect(formatSize).toHaveBeenCalledWith(1);
            expect(formatSize).toHaveBeenCalledWith(2);
            expect(formatSize).toHaveBeenCalledWith(3);
            expect(formatSize).toHaveBeenCalledWith(4);
            expect(formatSize).toHaveBeenCalledWith(5);
        });

        test('should use formatTime() to render elapsed and remaining time', async () => {
            (formatTime as jest.Mock<typeof formatTime>)
                .mockImplementationOnce((s) => `schon ${s} Sekunden`)
                .mockImplementationOnce((s) => `noch ${s} Sekunden`);
            const csm = new ConsoleSpeedMeter('', false);
            const stdoutMock = new StdoutMock();
            csm['out'] = stdoutMock as any;
            jest.spyOn(csm, 'getStats').mockReturnValue({
                size: MB_1,
                bytesSumTotal: 0,
                minSpeed: undefined,
                avgSpeed: undefined,
                curSpeed: undefined,
                maxSpeed: undefined,
                secondsElapsed: 1,
                secondsRemaining: 2,
            });
            csm['printStats']();
            expect(stdoutMock.getCurrentOutput())
                .toEqual(`Speed:     [CUR]   0.00 B/s   [AVG]   0.00 B/s   [MIN]   0.00 B/s   [MAX]   0.00 B/s
Progress:  0.00 %   (0 B = 0.00 B)
Elapsed:   schon 1 Sekunden
Remaining: noch 2 Sekunden
`);
            expect(formatTime).toHaveBeenCalledWith(1);
            expect(formatTime).toHaveBeenCalledWith(2);
        });

        test('should print state if initialized with showState=true', async () => {
            const csm = new ConsoleSpeedMeter('', true);
            csm.setState('Just trying');
            const stdoutMock = new StdoutMock();
            csm['out'] = stdoutMock as any;
            jest.spyOn(csm, 'getStats').mockReturnValue({
                size: MB_1,
                bytesSumTotal: 0,
                minSpeed: undefined,
                avgSpeed: undefined,
                curSpeed: undefined,
                maxSpeed: undefined,
                secondsElapsed: 0,
                secondsRemaining: 0,
            });
            csm['printStats']();
            expect(stdoutMock.getCurrentOutput())
                .toEqual(`Speed:     [CUR]   0.00 B/s   [AVG]   0.00 B/s   [MIN]   0.00 B/s   [MAX]   0.00 B/s
Progress:  0.00 %   (0 B = 0.00 B)
State:     Just trying
Elapsed:   00d 00h 00m 00s
Remaining: 00d 00h 00m 00s
`);
        });
    });
});
