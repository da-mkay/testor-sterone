import { describe, expect, test, jest } from '@jest/globals';
import { RepeatedRandomDataProvider } from '../../src/test-data/repeated-random-data-provider';

const srcBuf = Buffer.from([Math.floor(Math.random() * 255), Math.floor(Math.random() * 255)]);
jest.mock('node:crypto', () => ({
    randomFillSync: jest.fn((buf: Buffer) => buf.fill(srcBuf)),
}));

describe('RepeatedRandomDataProvider', () => {
    describe('create', () => {
        test('should create a data pool of specified number of random bytes', () => {
            const p = RepeatedRandomDataProvider.create(4);
            expect(p.getDataPool().equals(Buffer.concat([srcBuf, srcBuf]))).toBe(true);
        });
    });
});
