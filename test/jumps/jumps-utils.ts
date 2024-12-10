import { expect, test } from '@jest/globals';
import { Jumps } from '../../src/jumps/jumps';

export const testJumps = (jumps: Jumps) => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 32, 64, 128, 256, 512, 1024]) {
        test('should jump to each of ' + n + ' available positions', () => {
            const range = [...Array(n).keys()];
            const j = range.map((i) => jumps.getJump(n, i));
            const jSorted = j.sort((a, b) => a - b);
            expect(range).toEqual(jSorted);
        });
    }
};
