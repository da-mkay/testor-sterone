jest.mock('node:fs/promises');

import { open } from 'node:fs/promises';
import { describe, expect, test, jest, afterEach, beforeEach } from '@jest/globals';
import { BlockDeviceTest } from '../../src/block-device/block-device-test';
import { MandatoryBlockDeviceInfo } from '../../src/block-device/block-device-info';
import { registerPlatformMock } from '../mock-platform';
import { Mode, PathLike, constants } from 'node:fs';
import { RepeatedPatternDataProvider } from '../../src/test-data/repeated-pattern-data-provider';
import { Jumps } from '../../src/jumps/jumps';

const exampleBdInfo: MandatoryBlockDeviceInfo = {
    name: 'name',
    path: 'path',
    size: 4096,
};

const alternatingJumps: Jumps = {
    name: 'Alternating',
    getJump(chunks, i) {
        const firstHalfStart = 0;
        const secondtHalfStart = Math.ceil(chunks / 2); // = 3 if chunks = 5
        // sequence for chunks=5: 0,3,1,4,2
        return Math.floor(i / 2) + (i % 2 === 0 ? firstHalfStart : secondtHalfStart);
    },
};
const alternatingJumps2: Jumps = {
    name: 'Alternating',
    getJump(chunks, i) {
        const firstHalfStart = 0;
        const secondtHalfStart = Math.floor(chunks / 2); // = 2 if chunks = 5
        // sequence for chunks=5: 2,0,3,1,4
        return Math.floor(i / 2) + (i % 2 === 0 ? secondtHalfStart : firstHalfStart);
    },
};

describe('BlockDeviceTest', () => {
    describe('constructor', () => {
        const mockPlatform = registerPlatformMock();

        test('should use sensible default values for options', async () => {
            mockPlatform('darwin');
            let bdt = new BlockDeviceTest(exampleBdInfo);
            let options = bdt['options'];
            expect(options.ioChunkSize).toEqual(4 * 1024 * 1024);
            expect(options.startAt).toEqual(0);
            expect(options.openMode).toEqual('direct');

            mockPlatform('linux');
            bdt = new BlockDeviceTest(exampleBdInfo);
            options = bdt['options'];
            expect(options.ioChunkSize).toEqual(4 * 1024 * 1024);
            expect(options.startAt).toEqual(0);
            expect(options.openMode).toEqual('direct');

            mockPlatform('win32');
            bdt = new BlockDeviceTest(exampleBdInfo);
            options = bdt['options'];
            expect(options.ioChunkSize).toEqual(4 * 1024 * 1024);
            expect(options.startAt).toEqual(0);
            expect(options.openMode).toEqual('dsync');

            mockPlatform('sunos');
            bdt = new BlockDeviceTest(exampleBdInfo);
            options = bdt['options'];
            expect(options.ioChunkSize).toEqual(4 * 1024 * 1024);
            expect(options.startAt).toEqual(0);
            expect(options.openMode).toEqual('normal');
        });

        test('should override default values with options', async () => {
            let bdt = new BlockDeviceTest(exampleBdInfo, {
                ioChunkSize: 2048,
                openMode: 'normal',
                startAt: 1024,
            });
            let options = bdt['options'];
            expect(options.ioChunkSize).toEqual(2048);
            expect(options.startAt).toEqual(1024);
            expect(options.openMode).toEqual('normal');
        });

        test('should throw error if invalid chunk size is used for direct mode', async () => {
            expect(() => {
                new BlockDeviceTest(exampleBdInfo, {
                    ioChunkSize: 123,
                    openMode: 'direct',
                });
            }).toThrow('Chunk size must be multiple of 512 in direct mode!');
        });

        test('should throw error if invalid start offset is used for direct mode', async () => {
            expect(() => {
                new BlockDeviceTest(exampleBdInfo, {
                    startAt: 1,
                    openMode: 'direct',
                });
            }).toThrow('Start offset must be multiple of 512 in direct mode!');
        });

        test('should adjust test size in direct mode if test size does not align to 512 bytes', async () => {
            const bdInfo1: MandatoryBlockDeviceInfo = {
                name: 'name',
                path: 'path',
                size: 1234,
            };
            const bdt1 = new BlockDeviceTest(bdInfo1, {
                openMode: 'direct',
            });
            expect(bdt1.testSize).toEqual(1024);
        });
    });

    describe('getAlignedBuffer', () => {
        test('should try to read to buffer using direct mode until no EINVAL errors occurrs', async () => {
            let calls = 0;
            (open as jest.Mock<typeof open>).mockImplementation(async (path: PathLike, flags?: string | number, mode?: Mode) => {
                return {
                    read: () => {
                        if (++calls < 3) {
                            return Promise.reject({ code: 'EINVAL' });
                        }
                        return Promise.resolve();
                    },
                    close: () => {},
                } as any;
            });

            const bdt = new BlockDeviceTest(exampleBdInfo);
            const buf = await bdt['getAlignedBuffer'](512);
            expect(calls).toEqual(3);
            expect(buf.length).toEqual(512);
        });

        test('should re-throw errors other than EINVAL', async () => {
            (open as jest.Mock<typeof open>).mockImplementation(async (path: PathLike, flags?: string | number, mode?: Mode) => {
                return {
                    read: () => {
                        return Promise.reject({ code: 'EFOOBAR' });
                    },
                    close: () => {},
                } as any;
            });

            const bdt = new BlockDeviceTest(exampleBdInfo);
            await expect(bdt['getAlignedBuffer'](512)).rejects.toEqual({ code: 'EFOOBAR' });
        });

        test('should throw error if no buffer alignment was found', async () => {
            (open as jest.Mock<typeof open>).mockImplementation(async (path: PathLike, flags?: string | number, mode?: Mode) => {
                return {
                    read: () => {
                        return Promise.reject({ code: 'EINVAL' });
                    },
                    close: () => {},
                } as any;
            });

            const bdt = new BlockDeviceTest(exampleBdInfo);
            await expect(bdt['getAlignedBuffer'](512)).rejects.toThrow('Buffer alignment not found!');
        });
    });

    describe('open', () => {
        test('should create buffer using getAlignedBuffer in direct mode', async () => {
            const bdt = new BlockDeviceTest(exampleBdInfo, { openMode: 'direct' });
            (open as jest.Mock<typeof open>).mockImplementation(async (path: PathLike, flags?: string | number, mode?: Mode) => {
                return {
                    read: () => Promise.resolve(),
                    close: () => {},
                } as any;
            });
            const spyAligned = jest.spyOn(bdt as any, 'getAlignedBuffer');
            await bdt['open']('read');
            expect(spyAligned).toHaveBeenCalledTimes(1);
        });

        test('should create buffer NOT using getAlignedBuffer in non-direct mode', async () => {
            const bdt = new BlockDeviceTest(exampleBdInfo, { openMode: 'normal' });
            (open as jest.Mock<typeof open>).mockImplementation(async (path: PathLike, flags?: string | number, mode?: Mode) => {
                return {} as any;
            });
            const spyAligned = jest.spyOn(bdt as any, 'getAlignedBuffer');
            await bdt['open']('read');
            expect(spyAligned).toHaveBeenCalledTimes(0);
        });

        test('should open path using correct read/write flags and open mode', async () => {
            const calls: any[] = [];
            (open as jest.Mock<typeof open>).mockImplementation(async (path: PathLike, flags?: string | number, mode?: Mode) => {
                calls.push([path, flags]);
                return {
                    read: () => Promise.resolve(),
                    close: () => {},
                } as any;
            });

            const bdt1 = new BlockDeviceTest(exampleBdInfo, { openMode: 'normal' });
            await bdt1['open']('read');
            await bdt1['open']('readwrite');
            await bdt1['open']('write');
            const bdt2 = new BlockDeviceTest({ ...exampleBdInfo, path: 'path2' }, { openMode: 'direct' });
            // mock getAlignedBuffer, because original implementation will call open as well
            const spyAligned = jest.spyOn(bdt2 as any, 'getAlignedBuffer').mockImplementation((size) => Buffer.allocUnsafe(size as number));
            await bdt2['open']('read');
            await bdt2['open']('readwrite');
            await bdt2['open']('write');
            const bdt3 = new BlockDeviceTest({ ...exampleBdInfo, path: 'path3' }, { openMode: 'dsync' });
            await bdt3['open']('read');
            await bdt3['open']('readwrite');
            await bdt3['open']('write');

            expect(calls).toEqual([
                ['path', constants.O_RDONLY],
                ['path', constants.O_RDWR],
                ['path', constants.O_WRONLY],
                ['path2', constants.O_DIRECT | constants.O_RDONLY],
                ['path2', constants.O_DIRECT | constants.O_RDWR],
                ['path2', constants.O_DIRECT | constants.O_WRONLY],
                ['path3', constants.O_DSYNC | constants.O_RDONLY],
                ['path3', constants.O_DSYNC | constants.O_RDWR],
                ['path3', constants.O_DSYNC | constants.O_WRONLY],
            ]);
        });
    });

    describe('writeTestData', () => {
        test('should open path in write mode', async () => {
            const bdt1 = new BlockDeviceTest(exampleBdInfo, { openMode: 'normal' });
            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                return {
                    write: () => {},
                    close: () => {},
                };
            });
            await bdt1.writeTestData({ fillBuffer(buf, count) {} });
            expect(spyOpen).toHaveBeenCalledTimes(1);
            expect(spyOpen).toHaveBeenCalledWith('write');
        });

        test('should get data from dataProvider and write it to path chunk by chunk', async () => {
            const bdInfo: MandatoryBlockDeviceInfo = {
                name: 'name',
                path: 'path',
                size: 13,
            };
            const bdt1 = new BlockDeviceTest(bdInfo, { openMode: 'normal', ioChunkSize: 3 });
            const written: (string | number)[][] = [];
            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                this.ioBuffer = Buffer.allocUnsafe(this.options.ioChunkSize);
                return {
                    write: (buf, offset, length, pos) => {
                        const bytes = ['pos' + pos, ...buf.subarray(offset, offset + length)];
                        written.push(bytes);
                    },
                    close: () => {},
                };
            });
            let lastPos = 0;
            await bdt1.writeTestData({
                fillBuffer(buf, count) {
                    for (let i = 0; i < count; i++) {
                        buf[i] = ++lastPos;
                    }
                },
            });
            expect(written).toEqual([
                ['pos0', 1, 2, 3],
                ['pos3', 4, 5, 6],
                ['pos6', 7, 8, 9],
                ['pos9', 10, 11, 12],
                ['pos12', 13],
            ]);
        });

        test('should emit "bytes-processed" once a chunk was processed', async () => {
            const bdInfo: MandatoryBlockDeviceInfo = {
                name: 'name',
                path: 'path',
                size: 13,
            };
            const bdt1 = new BlockDeviceTest(bdInfo, { openMode: 'normal', ioChunkSize: 3 });
            let lastActualBytesProcessed = -1;
            const events: [number, number][] = [];

            bdt1.addListener('bytes-processed', (bytesProcessed) => {
                events.push([lastActualBytesProcessed, bytesProcessed]);
                lastActualBytesProcessed = -1;
            });

            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                this.ioBuffer = Buffer.allocUnsafe(this.options.ioChunkSize);
                return {
                    write: (buf, offset, length, pos) => {
                        lastActualBytesProcessed = length;
                    },
                    close: () => {},
                };
            });
            await bdt1.writeTestData({ fillBuffer(buf, count) {} });
            expect(events).toEqual([
                [3, 3],
                [3, 3],
                [3, 3],
                [3, 3],
                [1, 1],
            ]);
        });
    });

    describe('readTestData', () => {
        test('should open path in read mode', async () => {
            const bdt1 = new BlockDeviceTest(exampleBdInfo, { openMode: 'normal' });
            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                return {
                    read: () => {},
                    close: () => {},
                };
            });
            await bdt1.readTestData({ verify(chunk, bytes) {} });
            expect(spyOpen).toHaveBeenCalledTimes(1);
            expect(spyOpen).toHaveBeenCalledWith('read');
        });

        test('should read data chunk by chunk from path and verify it using dataVerifier', async () => {
            const bdInfo: MandatoryBlockDeviceInfo = {
                name: 'name',
                path: 'path',
                size: 13,
            };
            const bdt1 = new BlockDeviceTest(bdInfo, { openMode: 'normal', ioChunkSize: 3 });
            const read: (string | number)[][] = [];
            let lastPos = 0;
            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                this.ioBuffer = Buffer.allocUnsafe(this.options.ioChunkSize);
                return {
                    read: (buf, offset, length, pos) => {
                        for (let i = offset; i < offset + length; i++) {
                            buf[i] = ++lastPos;
                        }
                        const bytes = ['pos' + pos, ...buf.subarray(offset, offset + length)];
                        read.push(bytes);
                    },
                    close: () => {},
                };
            });
            const verifiedChunks: number[][] = [];
            await bdt1.readTestData({
                verify(chunk, bytes) {
                    verifiedChunks.push([...chunk.subarray(0, bytes)]);
                },
            });
            const expectedChunksRead = [
                ['pos0', 1, 2, 3],
                ['pos3', 4, 5, 6],
                ['pos6', 7, 8, 9],
                ['pos9', 10, 11, 12],
                ['pos12', 13],
            ];
            expect(read).toEqual(expectedChunksRead);
            expect(verifiedChunks).toEqual(expectedChunksRead.map((chunk) => chunk.slice(1))); // slice, because pos data is not part of real chunk
        });

        test('should emit "bytes-processed" once a chunk was processed', async () => {
            const bdInfo: MandatoryBlockDeviceInfo = {
                name: 'name',
                path: 'path',
                size: 13,
            };
            const bdt1 = new BlockDeviceTest(bdInfo, { openMode: 'normal', ioChunkSize: 3 });
            let lastActualBytesProcessed = -1;
            const events: [number, number][] = [];

            bdt1.addListener('bytes-processed', (bytesProcessed) => {
                events.push([lastActualBytesProcessed, bytesProcessed]);
                lastActualBytesProcessed = -1;
            });

            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                this.ioBuffer = Buffer.allocUnsafe(this.options.ioChunkSize);
                return {
                    read: (buf, offset, length, pos) => {
                        lastActualBytesProcessed = length;
                    },
                    close: () => {},
                };
            });
            await bdt1.readTestData({ verify(chunk, bytes) {} });
            expect(events).toEqual([
                [3, 3],
                [3, 3],
                [3, 3],
                [3, 3],
                [1, 1],
            ]);
        });
    });

    describe('crossTestData', () => {
        test('should open path in readwrite mode', async () => {
            const bdt1 = new BlockDeviceTest(exampleBdInfo, { openMode: 'normal' });
            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                this.ioBuffer = Buffer.allocUnsafe(this.options.ioChunkSize);
                return {
                    read: () => {},
                    write: () => {},
                    close: () => {},
                };
            });
            await bdt1.crossTestData(
                [RepeatedPatternDataProvider.create(3, 0xaa)],
                [
                    {
                        name: 'Alternating',
                        getJump(chunks, i) {
                            return 0;
                        },
                    },
                ],
                512,
            );
            expect(spyOpen).toHaveBeenCalledTimes(1);
            expect(spyOpen).toHaveBeenCalledWith('readwrite');
        });

        test('should process stripe by stripe while writing and verifying each data-pattern using correct jumps', async () => {
            const exampleBdInfo: MandatoryBlockDeviceInfo = {
                name: 'name',
                path: 'path',
                size: 29,
            };
            const ioChunkSize = 2;
            const bdt1 = new BlockDeviceTest(exampleBdInfo, { openMode: 'normal', ioChunkSize });
            const actions: ['r' | 'w', number, number[]][] = [];
            const bufFile = Buffer.allocUnsafe(exampleBdInfo.size);
            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                this.ioBuffer = Buffer.allocUnsafe(this.options.ioChunkSize);
                return {
                    write: (buf: Buffer, offset: number, length: number, pos: number) => {
                        buf.copy(bufFile, pos, offset, offset + length);
                        actions.push(['w', pos, [...bufFile.subarray(pos, pos + length)]]);
                    },
                    read: (buf: Buffer, offset: number, length: number, pos: number) => {
                        bufFile.copy(buf, offset, pos, pos + length);
                        actions.push(['r', pos, [...buf.subarray(offset, offset + length)]]);
                    },
                    close: () => {},
                };
            });
            await bdt1.crossTestData(
                [RepeatedPatternDataProvider.create(ioChunkSize, 0xaa), RepeatedPatternDataProvider.create(ioChunkSize, 0x55)],
                [alternatingJumps, alternatingJumps2],
                10,
            );
            expect(actions).toEqual([
                // first stripe
                ['w', 0, [0xaa, 0xaa]],
                ['w', 6, [0xaa, 0xaa]],
                ['w', 2, [0xaa, 0xaa]],
                ['w', 8, [0xaa, 0xaa]],
                ['w', 4, [0xaa, 0xaa]],
                ['r', 0, [0xaa, 0xaa]],
                ['r', 6, [0xaa, 0xaa]],
                ['r', 2, [0xaa, 0xaa]],
                ['r', 8, [0xaa, 0xaa]],
                ['r', 4, [0xaa, 0xaa]],

                ['w', 4, [0x55, 0x55]],
                ['w', 0, [0x55, 0x55]],
                ['w', 6, [0x55, 0x55]],
                ['w', 2, [0x55, 0x55]],
                ['w', 8, [0x55, 0x55]],
                ['r', 4, [0x55, 0x55]],
                ['r', 0, [0x55, 0x55]],
                ['r', 6, [0x55, 0x55]],
                ['r', 2, [0x55, 0x55]],
                ['r', 8, [0x55, 0x55]],

                // second stripe
                ['w', 10, [0xaa, 0xaa]],
                ['w', 16, [0xaa, 0xaa]],
                ['w', 12, [0xaa, 0xaa]],
                ['w', 18, [0xaa, 0xaa]],
                ['w', 14, [0xaa, 0xaa]],
                ['r', 10, [0xaa, 0xaa]],
                ['r', 16, [0xaa, 0xaa]],
                ['r', 12, [0xaa, 0xaa]],
                ['r', 18, [0xaa, 0xaa]],
                ['r', 14, [0xaa, 0xaa]],

                ['w', 14, [0x55, 0x55]],
                ['w', 10, [0x55, 0x55]],
                ['w', 16, [0x55, 0x55]],
                ['w', 12, [0x55, 0x55]],
                ['w', 18, [0x55, 0x55]],
                ['r', 14, [0x55, 0x55]],
                ['r', 10, [0x55, 0x55]],
                ['r', 16, [0x55, 0x55]],
                ['r', 12, [0x55, 0x55]],
                ['r', 18, [0x55, 0x55]],

                // third stripe
                ['w', 20, [0xaa, 0xaa]],
                ['w', 26, [0xaa, 0xaa]],
                ['w', 22, [0xaa, 0xaa]],
                ['w', 28, [0xaa]],
                ['w', 24, [0xaa, 0xaa]],
                ['r', 20, [0xaa, 0xaa]],
                ['r', 26, [0xaa, 0xaa]],
                ['r', 22, [0xaa, 0xaa]],
                ['r', 28, [0xaa]],
                ['r', 24, [0xaa, 0xaa]],

                ['w', 24, [0x55, 0x55]],
                ['w', 20, [0x55, 0x55]],
                ['w', 26, [0x55, 0x55]],
                ['w', 22, [0x55, 0x55]],
                ['w', 28, [0x55]],
                ['r', 24, [0x55, 0x55]],
                ['r', 20, [0x55, 0x55]],
                ['r', 26, [0x55, 0x55]],
                ['r', 22, [0x55, 0x55]],
                ['r', 28, [0x55]],
            ]);
        });

        test('should emit "bytes-processed" once a chunk was processed', async () => {
            const bdInfo: MandatoryBlockDeviceInfo = {
                name: 'name',
                path: 'path',
                size: 29,
            };
            const ioChunkSize = 2;
            const bdt1 = new BlockDeviceTest(bdInfo, { openMode: 'normal', ioChunkSize });
            let lastActualBytesProcessed = -1;
            const events: [number, number][] = [];

            bdt1.addListener('bytes-processed', (bytesProcessed) => {
                events.push([lastActualBytesProcessed, bytesProcessed]);
                lastActualBytesProcessed = -1;
            });

            const bufFile = Buffer.allocUnsafe(exampleBdInfo.size);
            const spyOpen = jest.spyOn(bdt1 as any, 'open').mockImplementation(async function (mode) {
                this.ioBuffer = Buffer.allocUnsafe(this.options.ioChunkSize);
                return {
                    write: (buf: Buffer, offset: number, length: number, pos: number) => {
                        buf.copy(bufFile, pos, offset, offset + length);
                        lastActualBytesProcessed = length;
                    },
                    read: (buf: Buffer, offset: number, length: number, pos: number) => {
                        bufFile.copy(buf, offset, pos, pos + length);
                        lastActualBytesProcessed = length;
                    },
                    close: () => {},
                };
            });
            await bdt1.crossTestData(
                [RepeatedPatternDataProvider.create(ioChunkSize, 0xaa), RepeatedPatternDataProvider.create(ioChunkSize, 0x55)],
                [alternatingJumps, alternatingJumps2],
                10,
            );
            expect(events).toEqual([
                // first stripe
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],

                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],

                // second stripe
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],

                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],

                // third stripe
                [2, 2],
                [2, 2],
                [2, 2],
                [1, 1],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [1, 1],
                [2, 2],

                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [1, 1],
                [2, 2],
                [2, 2],
                [2, 2],
                [2, 2],
                [1, 1],
            ]);
        });
    });
});
