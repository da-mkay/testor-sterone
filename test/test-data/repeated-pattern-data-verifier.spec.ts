import { describe, expect, test } from '@jest/globals';
import { RepeatedPatternDataProvider } from '../../src/test-data/repeated-pattern-data-provider';
import { RepeatedPatternDataVerifier } from '../../src/test-data/repeated-pattern-data-verifier';

describe('RepeatedPatternDataVerifier', () => {
    describe('verify', () => {
        test('should validate the specified number of bytes (smaller than pool size)', () => {
            const p = RepeatedPatternDataProvider.create(5, 0x55);
            const v = RepeatedPatternDataVerifier.create(p);
            expect(() => {
                v.verify(Buffer.from([0x55, 0x55, 0x55, 1, 2]), 3);
            }).not.toThrow();
        });

        test('should validate the specified number of bytes (greater than pool size)', () => {
            const p = RepeatedPatternDataProvider.create(5, 0x55);
            const v = RepeatedPatternDataVerifier.create(p);
            expect(() => {
                v.verify(Buffer.from([0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 1, 2]), 7);
            }).not.toThrow();
        });

        test('should fail to validate the specified number of bytes (smaller than pool size)', () => {
            const p = RepeatedPatternDataProvider.create(5, 0x55);
            const v = RepeatedPatternDataVerifier.create(p);
            expect(() => {
                v.verify(Buffer.from([0x55, 0x55, 0x55, 1, 2]), 4);
            }).toThrow('Mismatch!');
        });

        test('should fail to validate the specified number of bytes (greater than pool size)', () => {
            const p = RepeatedPatternDataProvider.create(5, 0x55);
            const v = RepeatedPatternDataVerifier.create(p);
            expect(() => {
                v.verify(Buffer.from([0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 1, 2]), 8);
            }).toThrow('Mismatch!');
        });
    });
});
