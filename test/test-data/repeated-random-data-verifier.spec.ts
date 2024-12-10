import { describe, expect, test } from '@jest/globals';
import { RepeatedRandomDataVerifier } from '../../src/test-data/repeated-random-data-verifier';

describe('RepeatedRandomDataVerifier', () => {
    describe('verify', () => {
        test('should validate the specified number of bytes when filling varification buffer at once', () => {
            const v0 = RepeatedRandomDataVerifier.create(3);
            expect(() => {
                v0.verify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0a, 1, 2]), 3);
            }).not.toThrow();
            const v1 = RepeatedRandomDataVerifier.create(3);
            expect(() => {
                v1.verify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0a, 1, 2]), 4);
            }).not.toThrow();
            const v2 = RepeatedRandomDataVerifier.create(3);
            expect(() => {
                v2.verify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0a, 0x0b, 0x0c, 1, 2]), 6);
            }).not.toThrow();
            const v3 = RepeatedRandomDataVerifier.create(3);
            expect(() => {
                v3.verify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0a, 0x0b, 0x0c, 0x0a, 1, 2]), 7);
            }).not.toThrow();
        });

        test('should validate the specified number of bytes when filling varification buffer step by step', () => {
            const v0 = RepeatedRandomDataVerifier.create(3);
            v0.verify(Buffer.from([0x0a, 0x0b]), 2);
            expect(() => {
                v0.verify(Buffer.from([0x0c, 0x0a, 1, 2]), 1);
            }).not.toThrow();
            const v1 = RepeatedRandomDataVerifier.create(3);
            v1.verify(Buffer.from([0x0a, 0x0b]), 2);
            expect(() => {
                v1.verify(Buffer.from([0x0c, 0x0a, 1, 2]), 2);
            }).not.toThrow();
            const v2 = RepeatedRandomDataVerifier.create(3);
            v2.verify(Buffer.from([0x0a, 0x0b]), 2);
            expect(() => {
                v2.verify(Buffer.from([0x0c, 0x0a, 0x0b, 0x0c, 1, 2]), 4);
            }).not.toThrow();
            const v3 = RepeatedRandomDataVerifier.create(3);
            v3.verify(Buffer.from([0x0a, 0x0b]), 2);
            expect(() => {
                v3.verify(Buffer.from([0x0c, 0x0a, 0x0b, 0x0c, 0x0a, 1, 2]), 5);
            }).not.toThrow();
        });

        test('should fail to validate the specified number of bytes when filling varification buffer at once', () => {
            const v1 = RepeatedRandomDataVerifier.create(3);
            expect(() => {
                v1.verify(Buffer.from([0x0a, 0x0b, 0x0c, 1, 2]), 4);
            }).toThrow('Mismatch!');
            const v2 = RepeatedRandomDataVerifier.create(3);
            expect(() => {
                v2.verify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0a, 0x0b, 1, 2]), 6);
            }).toThrow('Mismatch!');
            const v3 = RepeatedRandomDataVerifier.create(3);
            expect(() => {
                v3.verify(Buffer.from([0x0a, 0x0b, 0x0c, 0x0a, 0x0b, 0x0c, 1, 2]), 7);
            }).toThrow('Mismatch!');
        });

        test('should fail to validate the specified number of bytes when filling varification buffer step by step', () => {
            const v1 = RepeatedRandomDataVerifier.create(3);
            v1.verify(Buffer.from([0x0a, 0x0b]), 2);
            expect(() => {
                v1.verify(Buffer.from([0x0c, 1, 2]), 2);
            }).toThrow('Mismatch!');
            const v2 = RepeatedRandomDataVerifier.create(3);
            v2.verify(Buffer.from([0x0a, 0x0b]), 2);
            expect(() => {
                v2.verify(Buffer.from([0x0c, 0x0a, 0x0b, 1, 2]), 4);
            }).toThrow('Mismatch!');
            const v3 = RepeatedRandomDataVerifier.create(3);
            v3.verify(Buffer.from([0x0a, 0x0b]), 2);
            expect(() => {
                v3.verify(Buffer.from([0x0c, 0x0a, 0x0b, 0x0c, 1, 2]), 5);
            }).toThrow('Mismatch!');
        });
    });
});
