import { Jumps } from './jumps';

interface PrecalcResults {
    readonly jumpSize: number;
    readonly numbersPerBigRound: number;
    readonly numbersPerSmallRound: number;
    readonly bigRounds: number;
    readonly numbersInAllBigRounds: number;
}

/**
 * Similar to BTree jumps, but need no pre-calculation.
 */
export class Log2Jumps implements Jumps {
    readonly name = 'Log2';

    private precalcResults = new Map<number, PrecalcResults>();

    getJump(chunks: number, i: number): number {
        if (i >= chunks || i < 0) {
            return undefined;
        }
        if (chunks === 1) {
            return 0;
        }

        // Depending on the chunk-count there are up to two possible number-counts per round:
        // Example:
        // Let chunks==128, then the numbers to return are:
        // In 1st round: 0, 7, 14, 21, ..., 119, 126 (19 numbers -> big round)
        // In 2nd round: 1, 8, 15, 22, ..., 120, 127 (19 numbers -> big round)
        // In 3rd round: 2, 9, 16, 23, ..., 121      (18 numbers -> small round)
        if (!this.precalcResults.has(chunks)) {
            const jumpSize = Math.round(Math.log2(chunks)); // e.g. 7 if chunks==128
            const numbersPerBigRound = Math.ceil(chunks / jumpSize); // 19 in example
            const numbersPerSmallRound = numbersPerBigRound - 1;
            const bigRounds = chunks - jumpSize * (numbersPerBigRound - 1); // 2 in example
            const numbersInAllBigRounds = bigRounds * numbersPerBigRound;
            this.precalcResults.set(chunks, {
                jumpSize,
                numbersPerBigRound,
                numbersPerSmallRound,
                bigRounds,
                numbersInAllBigRounds,
            });
        }
        const c = this.precalcResults.get(chunks);
        if (i <= c.numbersInAllBigRounds) {
            return Math.floor(i / c.numbersPerBigRound) + (i % c.numbersPerBigRound) * c.jumpSize;
        }
        i = i - c.numbersInAllBigRounds;
        return c.bigRounds + Math.floor(i / c.numbersPerSmallRound) + (i % c.numbersPerSmallRound) * c.jumpSize;
    }
}
