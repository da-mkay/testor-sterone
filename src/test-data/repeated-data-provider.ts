import { TestDataProvider } from './test-data-provider';

export abstract class RepeatedDataProvider implements TestDataProvider {
    private pos = 0;
    private readonly poolSize: number;

    protected constructor(private readonly dataPool: Buffer) {
        this.poolSize = dataPool.length;
    }

    private incPos(size: number) {
        this.pos = (this.pos + size) % this.poolSize;
    }

    getDataPool() {
        return this.dataPool;
    }

    fillBuffer(buf: Buffer, count: number) {
        // NOTE: It's best to enter the loop only once to keep speed at max! Thus, use count that fulfills:
        //       "poolSize % count === 0"
        let bufPos = 0;
        while (bufPos < count) {
            const cp = Math.min(count - bufPos, this.poolSize - this.pos);
            this.dataPool.copy(buf, bufPos, this.pos, this.pos + cp);
            bufPos += cp;
            this.incPos(cp);
        }
    }
}
