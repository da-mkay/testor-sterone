import * as EventEmitter from 'node:events';
import { LastDurationStats, ProgressSnapshots } from './progress-snapshots';
import { MS_1000 } from '../constants';

export abstract class SpeedMeterBase extends EventEmitter {
    private progressSnapshots = new ProgressSnapshots();
    private lastDurationStats: LastDurationStats;
    private bytesSumTotal?: number;
    private size: number;
    private startTime: bigint;
    private curSpeed?: number;
    private minSpeed?: number;
    private maxSpeed?: number;
    private avgSpeed?: number;
    private secondsElapsed?: number;
    private secondsRemaining?: number;

    protected updateStats(now: bigint) {
        // We use bigints here, because for small chunks we would measure 0 milliseconds using Date.now() leading to Infinity-speed
        const nsElapsed = now - this.startTime;
        this.secondsElapsed = Math.floor(Number(nsElapsed / 1000000000n));
        const lastDurationStats = this.progressSnapshots.getLastDurationStats();
        if (this.lastDurationStats === undefined || this.lastDurationStats !== lastDurationStats) {
            this.lastDurationStats = lastDurationStats;
            if (lastDurationStats !== undefined && lastDurationStats.duration >= MS_1000) {
                this.curSpeed = Number((BigInt(lastDurationStats.bytesTotal) * 1000000000n) / lastDurationStats.duration);
                this.minSpeed = this.minSpeed === undefined ? this.curSpeed : Math.min(this.curSpeed, this.minSpeed);
                this.maxSpeed = this.maxSpeed === undefined ? this.curSpeed : Math.max(this.curSpeed, this.maxSpeed);
                this.avgSpeed = Number((BigInt(this.bytesSumTotal) * 1000000000n) / nsElapsed);
                this.secondsRemaining = Math.ceil((this.size - this.bytesSumTotal) / this.curSpeed);
            }
        }
    }

    getStats() {
        return {
            bytesSumTotal: this.bytesSumTotal,
            size: this.size,
            curSpeed: this.curSpeed,
            minSpeed: this.minSpeed,
            maxSpeed: this.maxSpeed,
            avgSpeed: this.avgSpeed,
            secondsElapsed: this.secondsElapsed,
            secondsRemaining: this.secondsRemaining,
        };
    }

    start(size: number) {
        this.startTime = process.hrtime.bigint();
        this.progressSnapshots.clear(this.startTime);
        this.bytesSumTotal = 0;
        this.size = size;
        this.curSpeed = undefined;
        this.avgSpeed = undefined;
        this.minSpeed = undefined;
        this.maxSpeed = undefined;
        this.secondsElapsed = undefined;
        this.secondsRemaining = undefined;
    }

    addBytes(b: number) {
        if (b < 1) {
            return;
        }
        const now = process.hrtime.bigint();
        this.bytesSumTotal += b;
        const duration = this.progressSnapshots.add(now, this.bytesSumTotal);
        if (duration > MS_1000) {
            // inform listeners that last read/write took long
            this.emit('longOperation', duration, b);
        }
        this.updateStats(now);
    }

    abstract stop(): void;
}
