import { describe, expect, test } from '@jest/globals';
import { Log2Jumps } from '../../src/jumps/log2-jumps';
import { testJumps } from './jumps-utils';

function getJumpNaive(chunks: number, i: number): number {
    if (chunks === 1) {
        return 0;
    }
    const jumpSize = Math.round(Math.log2(chunks));
    for (let k = 0; k < jumpSize; k++) {
        const jumpsInRound = Math.floor((chunks - 1 - k) / jumpSize);
        if (i <= jumpsInRound) {
            return k + i * jumpSize;
        }
        i -= jumpsInRound + 1;
    }
    throw new Error('i out of range');
}

describe('Log2Jumps', () => {
    describe('name', () => {
        test("should return 'Log2'", () => {
            expect(new Log2Jumps().name).toEqual('Log2');
        });
    });

    describe('getJump', () => {
        testJumps(new Log2Jumps());

        test('should return undefined for negative values', () => {
            const jumps = new Log2Jumps();
            expect(jumps.getJump(8, -1)).toBeUndefined();
            expect(jumps.getJump(8, -2)).toBeUndefined();
        });

        test('should return undefined for too big values', () => {
            const jumps = new Log2Jumps();
            expect(jumps.getJump(8, 8)).toBeUndefined();
            expect(jumps.getJump(8, 9)).toBeUndefined();
        });

        test('should jump logarithmic as in naive implementation', () => {
            const jumps = new Log2Jumps();

            for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 32, 64, 128, 256, 512, 1024]) {
                const range = [...Array(n).keys()];
                const j = range.map((i) => getJumpNaive(n, i));
                const k = range.map((i) => jumps.getJump(n, i));
                expect(j).toEqual(k);
            }
        });
    });
});
