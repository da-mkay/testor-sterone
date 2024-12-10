import { randomFillSync } from 'node:crypto';
import { RepeatedDataProvider } from './repeated-data-provider';

/**
 * Provide random data which is backed by a fixed-size random data pool that is repeatedly used.
 */
export class RepeatedRandomDataProvider extends RepeatedDataProvider {
    private constructor(randomDataPool: Buffer) {
        super(randomDataPool);
    }

    static create(poolSize: number) {
        const randomDataPool = Buffer.allocUnsafe(poolSize);
        randomFillSync(randomDataPool);
        return new RepeatedRandomDataProvider(randomDataPool);
    }
}
