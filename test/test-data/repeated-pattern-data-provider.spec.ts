import { describe, expect, test } from '@jest/globals';
import { RepeatedPatternDataProvider } from '../../src/test-data/repeated-pattern-data-provider';

describe('RepeatedPatternDataProvider', () => {
    describe('create', () => {
        test('should create a data pool of specified number of bytes and pattern', () => {
            const p = RepeatedPatternDataProvider.create(4, 0x55);
            expect(p.getDataPool().equals(Buffer.from([0x55, 0x55, 0x55, 0x55]))).toBe(true);
        });
    });

    describe('pattern', () => {
        test('should be the pattern in hex-notation', () => {
            const p1 = RepeatedPatternDataProvider.create(1, 0);
            expect(p1.pattern).toEqual('0x0');
            const p2 = RepeatedPatternDataProvider.create(1, 0x55);
            expect(p2.pattern).toEqual('0x55');
            const p3 = RepeatedPatternDataProvider.create(1, 0xaa);
            expect(p3.pattern).toEqual('0xAA');
            const p4 = RepeatedPatternDataProvider.create(1, 0xff);
            expect(p4.pattern).toEqual('0xFF');
        });
    });
});
