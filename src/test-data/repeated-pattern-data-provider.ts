import { RepeatedDataProvider } from './repeated-data-provider';

export class RepeatedPatternDataProvider extends RepeatedDataProvider {
    private constructor(
        dataPool: Buffer,
        readonly pattern: string,
    ) {
        super(dataPool);
    }

    static create(poolSize: number, pattern: number) {
        const dataPool = Buffer.alloc(poolSize, pattern);
        return new RepeatedPatternDataProvider(dataPool, '0x' + pattern.toString(16).toUpperCase());
    }
}
