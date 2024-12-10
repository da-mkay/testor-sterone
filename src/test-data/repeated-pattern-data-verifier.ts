import { RepeatedPatternDataProvider } from './repeated-pattern-data-provider';
import { TestDataVerifier } from './test-data-verifier';

export class RepeatedPatternDataVerifier implements TestDataVerifier {
    private pos = 0;
    private readonly poolSize: number;

    private constructor(private readonly verifyData: Buffer) {
        this.poolSize = verifyData.length;
    }

    static create(dataProvider: RepeatedPatternDataProvider) {
        return new RepeatedPatternDataVerifier(dataProvider.getDataPool());
    }

    private incPos(size: number) {
        this.pos = (this.pos + size) % this.poolSize;
    }

    verify(chunk: Buffer, bytes: number): void {
        let chunkPos = 0;
        while (chunkPos < bytes) {
            const compareBytes = Math.min(this.poolSize - this.pos, bytes - chunkPos);
            if (chunk.compare(this.verifyData, this.pos, this.pos + compareBytes, chunkPos, chunkPos + compareBytes) !== 0) {
                throw new Error('Mismatch!');
            }
            chunkPos += compareBytes;
            this.incPos(compareBytes);
        }
    }
}
