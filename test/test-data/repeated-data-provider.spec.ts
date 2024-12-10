import { describe, expect, test } from '@jest/globals';
import { RepeatedDataProvider } from '../../src/test-data/repeated-data-provider';

class MockRepeatedDataProvider extends RepeatedDataProvider {
    constructor(dataPool: Buffer) {
        super(dataPool);
    }
}

describe('RepeatedDataProvider', () => {
    describe('getDataPool', () => {
        test('should return data pool passed to constructor', () => {
            const buf = Buffer.from([0x1, 0x2, 0x3]);
            const p = new MockRepeatedDataProvider(buf);
            expect(p.getDataPool()).toBe(buf);
        });
    });

    describe('fillBuffer', () => {
        test('should fill buffer with up to count bytes', () => {
            const buf = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]);
            const p = new MockRepeatedDataProvider(buf);
            const b = Buffer.alloc(3);
            p.fillBuffer(b, 2); // third byte stays untouched
            const expectedBuf = Buffer.concat([buf.subarray(0, 2), Buffer.from([0])]);
            expect(b.equals(expectedBuf)).toEqual(true);
        });

        test('should fill buffer with next part of data pool', () => {
            const buf = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]);
            const p = new MockRepeatedDataProvider(buf);
            const b = Buffer.alloc(2);
            p.fillBuffer(b, 2);
            expect(b.equals(buf.subarray(0, 2))).toEqual(true);
            p.fillBuffer(b, 2);
            expect(b.equals(buf.subarray(2, 4))).toEqual(true);
        });

        test('should take bytes from beginning of data pool once its end is reached', () => {
            const buf = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]);
            const p = new MockRepeatedDataProvider(buf);
            const b = Buffer.alloc(3);
            p.fillBuffer(b, 3);
            expect(b.equals(buf.subarray(0, 3))).toEqual(true);
            p.fillBuffer(b, 3);
            expect(b.equals(Buffer.concat([buf.subarray(3, 5), buf.subarray(0, 1)]))).toEqual(true);
        });

        test('should copy bytes from data pool multiple times to target buffer if count is greater than pool size', () => {
            const buf = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]);
            const p = new MockRepeatedDataProvider(buf);
            const b = Buffer.alloc(15);
            p.fillBuffer(b, 15);
            const expectedBuf = Buffer.concat([buf, buf, buf]);
            expect(b.equals(expectedBuf)).toEqual(true);
        });
    });
});
