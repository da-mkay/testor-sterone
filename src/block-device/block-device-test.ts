import { open } from 'node:fs/promises';
// In Node 17 node:fs/promises does not contain constants yet
import { constants } from 'node:fs';
import { EventEmitter } from 'node:events';
import { TestDataProvider } from '../test-data/test-data-provider';
import { TestDataVerifier } from '../test-data/test-data-verifier';
import { MandatoryBlockDeviceInfo } from './block-device-info';
import { RepeatedPatternDataVerifier } from '../test-data/repeated-pattern-data-verifier';
import { RepeatedPatternDataProvider } from '../test-data/repeated-pattern-data-provider';
import { formatSize } from '../format';
import { Jumps } from '../jumps/jumps';

export type OpenMode = 'direct' | 'dsync' | 'normal';

export interface BlockDeviceTestOptions {
    startAt?: number;
    ioChunkSize?: number;
    openMode?: OpenMode;
}

export class BlockDeviceTest extends EventEmitter {
    private ioBuffer: Buffer;
    private options: BlockDeviceTestOptions;

    readonly testSize: number;

    constructor(
        private readonly bdInfo: MandatoryBlockDeviceInfo,
        options?: BlockDeviceTestOptions,
    ) {
        super();
        this.options = options ? { ...options } : {};
        if (this.options.ioChunkSize === undefined) {
            this.options.ioChunkSize = 4 * 1024 * 1024;
        }
        if (this.options.startAt === undefined) {
            this.options.startAt = 0;
        }
        if (this.options.openMode === undefined) {
            this.options.openMode =
                process.platform === 'linux' || process.platform === 'darwin'
                    ? 'direct'
                    : process.platform === 'win32'
                      ? 'dsync'
                      : 'normal';
        }
        if (this.options.openMode === 'direct' && this.options.ioChunkSize % 512 !== 0) {
            throw new Error('Chunk size must be multiple of 512 in direct mode!');
        }
        if (this.options.openMode === 'direct' && this.options.startAt % 512 !== 0) {
            throw new Error('Start offset must be multiple of 512 in direct mode!');
        }
        this.testSize = this.bdInfo.size;
        this.testSize = this.testSize - this.options.startAt;
        if (this.options.openMode === 'direct') {
            const bytesOff = this.testSize % 512;
            if (bytesOff > 0) {
                const sizeBefore = this.testSize;
                this.testSize -= bytesOff;
                console.log('* Size of', sizeBefore, 'B is not aligned to 512 B.');
                console.log('* Only', this.testSize, 'B will be processed!');
                console.log('* Alternatively use non-direct mode.');
                console.log();
            }
        }
    }

    /**
     * Get an aligned Buffer whose start address is aligned to 512 bytes.
     * This is required when using O_DIRECT for reading/writing files.
     *
     * Since NodeJS does not provide a method for getting aligned buffers and we don't want to use
     * native dependencies, we use a trial-and-error approach here.
     */
    private async getAlignedBuffer(size: number) {
        const buf = Buffer.allocUnsafe(size + 511);
        const fh = await open(this.bdInfo.path, constants.O_RDONLY | constants.O_DIRECT);
        try {
            for (let bufOffset = 0; bufOffset < 512; bufOffset++) {
                try {
                    await fh.read(buf, bufOffset, size);
                } catch (err) {
                    if (err.code === 'EINVAL') {
                        continue;
                    }
                    throw err;
                }
                return buf.subarray(bufOffset, bufOffset + size);
            }
            throw new Error('Buffer alignment not found!');
        } finally {
            await fh.close();
        }
    }

    private async open(mode: 'read' | 'write' | 'readwrite') {
        if (!this.ioBuffer) {
            this.ioBuffer =
                this.options.openMode === 'direct'
                    ? await this.getAlignedBuffer(this.options.ioChunkSize)
                    : Buffer.allocUnsafe(this.options.ioChunkSize);
        }
        const openMode =
            this.options.openMode === 'direct' ? constants.O_DIRECT : this.options.openMode === 'dsync' ? constants.O_DSYNC : 0;
        return open(
            this.bdInfo.path,
            (mode === 'readwrite' ? constants.O_RDWR : mode === 'read' ? constants.O_RDONLY : constants.O_WRONLY) | openMode,
        );
    }

    async writeTestData(dataProvider: TestDataProvider) {
        const fh = await this.open('write');
        try {
            let pos = this.options.startAt;
            let remainingBytes = this.testSize;
            while (remainingBytes > 0) {
                const takeBytes = Math.min(remainingBytes, this.options.ioChunkSize);
                dataProvider.fillBuffer(this.ioBuffer, takeBytes);
                await fh.write(this.ioBuffer, 0, takeBytes, pos);
                this.emit('bytes-processed', takeBytes);
                remainingBytes -= takeBytes;
                pos += takeBytes;
            }
        } finally {
            await fh.close();
        }
    }

    async readTestData(dataVerifier: TestDataVerifier) {
        const fh = await this.open('read');
        try {
            let pos = this.options.startAt;
            let remainingBytes = this.testSize;
            while (remainingBytes > 0) {
                const takeBytes = Math.min(remainingBytes, this.options.ioChunkSize);
                await fh.read(this.ioBuffer, 0, takeBytes, pos);
                dataVerifier.verify(this.ioBuffer, takeBytes);
                this.emit('bytes-processed', takeBytes);
                remainingBytes -= takeBytes;
                pos += takeBytes;
            }
        } finally {
            await fh.close();
        }
    }

    async crossTestData(dataProviders: RepeatedPatternDataProvider[], jumps: Jumps[], testStripeSize: number) {
        const datas = dataProviders.map((dataProvider) => ({
            dataProvider,
            dataVerifier: RepeatedPatternDataVerifier.create(dataProvider),
        }));
        const fh = await this.open('readwrite');
        try {
            let pos = this.options.startAt;
            let remainingBytes = this.testSize;
            while (remainingBytes > 0) {
                const testBytes = Math.min(remainingBytes, testStripeSize);
                const chunksPerTest = Math.ceil(testBytes / this.options.ioChunkSize);

                const stateRange = `${pos} B - ${pos + testBytes} B  (${formatSize(pos)} - ${formatSize(pos + testBytes)})`;
                let jumpsIndex = 0;

                for (const data of datas) {
                    const curJumps = jumps[jumpsIndex];
                    this.emit('state', `Writing ${data.dataProvider.pattern} to ${stateRange} using ${curJumps.name} jumps`);
                    for (let i = 0; i < chunksPerTest; i++) {
                        const offset = curJumps.getJump(chunksPerTest, i) * this.options.ioChunkSize;
                        const takeBytes = Math.min(testBytes - offset, this.options.ioChunkSize);

                        data.dataProvider.fillBuffer(this.ioBuffer, takeBytes);
                        await fh.write(this.ioBuffer, 0, takeBytes, pos + offset);
                        this.emit('bytes-processed', takeBytes);
                    }
                    this.emit('state', `Reading ${data.dataProvider.pattern} from ${stateRange} using ${curJumps.name} jumps`);
                    for (let i = 0; i < chunksPerTest; i++) {
                        const offset = curJumps.getJump(chunksPerTest, i) * this.options.ioChunkSize;
                        const takeBytes = Math.min(testBytes - offset, this.options.ioChunkSize);

                        await fh.read(this.ioBuffer, 0, takeBytes, pos + offset);
                        data.dataVerifier.verify(this.ioBuffer, takeBytes);
                        this.emit('bytes-processed', takeBytes);
                    }
                    jumpsIndex = (jumpsIndex + 1) % jumps.length;
                }

                remainingBytes -= testBytes;
                pos += testBytes;
            }
        } finally {
            await fh.close();
        }
    }
}
