import { SpeedMeterBase } from './speed-meter-base';
import { formatSize, formatTime, padLeftDecimal, twoDecimalPlaces } from '../format';

export class ConsoleSpeedMeter extends SpeedMeterBase {
    private statsPrinted: boolean;
    private interval: NodeJS.Timeout;
    private state: string;
    private out = process.stdout;

    constructor(
        private readonly indent: string,
        private readonly showState: boolean,
    ) {
        super();
    }

    private printStats() {
        if (this.statsPrinted) {
            if (this.showState) {
                this.out.clearLine(0);
                this.out.moveCursor(0, -1);
            }
            this.out.clearLine(0);
            this.out.moveCursor(0, -1);
            this.out.clearLine(0);
            this.out.moveCursor(0, -1);
            this.out.clearLine(0);
            this.out.moveCursor(0, -1);
            this.out.clearLine(0);
            this.out.moveCursor(0, -1);
            this.out.clearLine(0);
        }
        const stats = this.getStats();
        this.out.write(
            this.indent +
                'Speed:     [CUR] ' +
                padLeftDecimal(formatSize(stats.curSpeed ?? 0), 3) +
                '/s   [AVG] ' +
                padLeftDecimal(formatSize(stats.avgSpeed ?? 0), 3) +
                '/s   [MIN] ' +
                padLeftDecimal(formatSize(stats.minSpeed ?? 0), 3) +
                '/s   [MAX] ' +
                padLeftDecimal(formatSize(stats.maxSpeed ?? 0), 3) +
                '/s\n',
        );
        this.out.write(
            this.indent +
                'Progress:  ' +
                twoDecimalPlaces((stats.bytesSumTotal / stats.size) * 100) +
                ' %   (' +
                stats.bytesSumTotal +
                ' B = ' +
                formatSize(stats.bytesSumTotal) +
                ')' +
                '\n',
        );
        if (this.showState) {
            this.out.write(this.indent + 'State:     ' + (this.state || '') + '\n');
        }
        this.out.write(this.indent + 'Elapsed:   ' + formatTime(stats.secondsElapsed ?? 0) + '\n');
        this.out.write(this.indent + 'Remaining: ' + formatTime(stats.secondsRemaining ?? 0) + '\n');
        this.statsPrinted = true;
    }

    start(size: number) {
        super.start(size);
        this.statsPrinted = false;
        // interval for throttling printStats
        const msInterval = 500;
        this.interval = setInterval(() => {
            // Print stats because time is moving on -> update elapsed time, avg. speed
            const now = process.hrtime.bigint();
            this.updateStats(now);
            this.printStats();
        }, msInterval);
    }

    setState(s: string) {
        this.state = s;
    }

    stop() {
        clearInterval(this.interval);
        this.printStats();
    }
}
