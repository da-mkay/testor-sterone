import { describe, expect, test } from '@jest/globals';
import { BafJumps } from '../../src/jumps/baf-jumps';
import { testJumps } from './jumps-utils';

describe('BafJumps', () => {
    describe('name', () => {
        test("should return 'BAF'", () => {
            expect(new BafJumps().name).toEqual('BAF');
        });
    });

    describe('getJump', () => {
        testJumps(new BafJumps());

        test('should return undefined for negative values', () => {
            const jumps = new BafJumps();
            expect(jumps.getJump(8, -1)).toBeUndefined();
            expect(jumps.getJump(8, -2)).toBeUndefined();
        });

        test('should return undefined for too big values', () => {
            const jumps = new BafJumps();
            expect(jumps.getJump(8, 8)).toBeUndefined();
            expect(jumps.getJump(8, 9)).toBeUndefined();
        });

        test('should jump back and forth', () => {
            const jumps = new BafJumps();
            const range = [...Array(8).keys()];
            const j = range.map((i) => jumps.getJump(8, i));
            expect(j).toEqual([0, 4, 1, 5, 2, 6, 3, 7]);

            const range2 = [...Array(7).keys()];
            const j2 = range2.map((i) => jumps.getJump(7, i));
            expect(j2).toEqual([0, 4, 1, 5, 2, 6, 3]);
        });
    });
});
