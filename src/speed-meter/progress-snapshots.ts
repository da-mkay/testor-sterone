import { MS_100, MS_1000 } from '../constants';

interface ProgressSnapshot {
    readonly at: bigint;
    readonly bytesTotal: number;
}

export interface LastDurationStats {
    readonly duration: bigint;
    readonly bytesTotal: number;
}

export class ProgressSnapshots {
    private list: ProgressSnapshot[] = [];
    private cachedLastDurationStats: LastDurationStats;

    clear(at: bigint) {
        this.updateSnapshotList([
            {
                bytesTotal: 0,
                at,
            },
        ]);
    }

    add(at: bigint, bytesTotal: number): bigint {
        const snapshot: ProgressSnapshot = {
            bytesTotal,
            at,
        };
        const duration = at - this.list[this.list.length - 1].at;
        if (this.list.length >= 2) {
            const a = this.list[this.list.length - 2];
            const b = this.list[this.list.length - 1];
            // aggregate values by 100ms steps
            if (b.at - a.at < MS_100) {
                this.replaceLastSnapshot(snapshot);
            } else {
                this.addSnapshot(snapshot);
            }
        } else {
            this.addSnapshot(snapshot);
        }
        this.removeOutdated();
        return duration;
    }

    getLastDurationStats(): LastDurationStats {
        const last = this.list[this.list.length - 1];
        if (this.list.length > 1) {
            if (this.cachedLastDurationStats === undefined) {
                this.cachedLastDurationStats = {
                    duration: last.at - this.list[0].at,
                    bytesTotal: last.bytesTotal - this.list[0].bytesTotal,
                };
            }
            return this.cachedLastDurationStats;
        }
    }

    private updateSnapshotList(list: ProgressSnapshot[]) {
        this.list = list;
        this.cachedLastDurationStats = undefined;
    }

    private addSnapshot(snapshot: ProgressSnapshot) {
        this.list.push(snapshot);
        this.cachedLastDurationStats = undefined;
    }

    private replaceLastSnapshot(snapshot: ProgressSnapshot) {
        this.list[this.list.length - 1] = snapshot;
        this.cachedLastDurationStats = undefined;
    }

    private removeOutdated() {
        const last = this.list[this.list.length - 1];
        for (let i = 0; i < this.list.length; i++) {
            // keep values for a duration of 1000ms
            const a = this.list[i];
            if (last.at - a.at < MS_1000) {
                if (i > 1) {
                    this.updateSnapshotList(this.list.slice(i - 1));
                }
                break;
            }
        }
    }
}
