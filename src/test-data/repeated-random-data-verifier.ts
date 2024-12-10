import { TestDataVerifier } from './test-data-verifier';

export class RepeatedRandomDataVerifier implements TestDataVerifier {
    private pos = 0;
    private verifyData: Buffer;
    private verifyDataFilled = false;

    private constructor(private readonly verifyDataSize: number) {}

    static create(verifyDataSize: number) {
        const v = new RepeatedRandomDataVerifier(verifyDataSize);
        v.verifyData = Buffer.allocUnsafe(verifyDataSize);
        return v;
    }

    private incPos(size: number) {
        this.pos = (this.pos + size) % this.verifyDataSize;
    }

    verify(chunk: Buffer, bytes: number): void {
        if (!this.verifyDataFilled) {
            const takeBytes = Math.min(this.verifyDataSize - this.pos, bytes);
            chunk.copy(this.verifyData, this.pos, 0, takeBytes);
            this.incPos(takeBytes);
            this.verifyDataFilled = this.pos === 0;
            if (bytes === takeBytes) {
                return;
            }
            // rest of chunk will be verified against verifyData
            chunk = chunk.subarray(takeBytes);
            bytes -= takeBytes;
        }
        let chunkPos = 0;
        while (chunkPos < bytes) {
            const compareBytes = Math.min(this.verifyDataSize - this.pos, bytes - chunkPos);
            if (chunk.compare(this.verifyData, this.pos, this.pos + compareBytes, chunkPos, chunkPos + compareBytes) !== 0) {
                throw new Error('Mismatch!');
            }
            chunkPos += compareBytes;
            this.incPos(compareBytes);
        }
    }
}
