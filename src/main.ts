import { createInterface } from 'node:readline/promises';
import { BlockDeviceInfo } from './block-device/block-device-info';
import { BlockDeviceTest } from './block-device/block-device-test';
import { CliArgs } from './cli-args';
import { formatSize } from './format';
import { Log2Jumps } from './jumps/log2-jumps';
import { BafJumps } from './jumps/baf-jumps';
import { ConsoleSpeedMeter } from './speed-meter/console-speed-meter';
import { RepeatedPatternDataProvider } from './test-data/repeated-pattern-data-provider';
import { RepeatedRandomDataProvider } from './test-data/repeated-random-data-provider';
import { RepeatedRandomDataVerifier } from './test-data/repeated-random-data-verifier';

export class UnsupportedPlatformError extends Error {
    constructor() {
        super('Only the following platforms are supported: Linux, MacOS, Windows');
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class UnsupportedNodeVersionError extends Error {
    constructor() {
        super(`At least NodeJS v17 is required! You are using ${process.version}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class WriteTestError extends Error {
    constructor(message: string) {
        super(`Write test failed: ${message}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class ReadTestError extends Error {
    constructor(message: string) {
        super(`Read test failed: ${message}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class CrossTestError extends Error {
    constructor(message: string) {
        super(`Cross test failed: ${message}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class AbortedError extends Error {
    constructor() {
        super(`Aborted`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class Main {
    private args = new CliArgs({
        test: {
            positionals: {
                0: {
                    name: 'device',
                    parse: (v) => v,
                },
            },
            options: {
                mode: {
                    short: 'm',
                    parse: (v) => v as 'r' | 'w' | 'wr' | 'x',
                    default: 'wr' as const,
                    validate: (value) => {
                        if (['r', 'w', 'wr', 'x'].indexOf(value) < 0) {
                            return 'Invalid mode:' + value + '. Supported modes: wr, w, r, x';
                        }
                    },
                },
                'output-mode': {
                    short: 'o',
                    parse: (v) => v as 'direct' | 'normal' | 'dsync',
                    default: () =>
                        process.platform === 'linux' || process.platform === 'darwin'
                            ? 'direct'
                            : process.platform === 'win32'
                              ? 'dsync'
                              : 'normal',
                    validate: (value) => {
                        if (['direct', 'dsync', 'normal'].indexOf(value) < 0) {
                            return 'Invalid output-mode:' + value;
                        }
                        if (process.platform === 'win32' && value === 'direct') {
                            return 'Direct mode not supported on Windows!';
                        }
                    },
                },
                'chunk-size': {
                    short: 'c',
                    default: 4 * 1024 * 1024,
                    parse: this.parseSize,
                    validate: (value) => {
                        if (isNaN(value)) {
                            return 'Specified chunk size is not a number!';
                        }
                        if (this.args.getOption('test', 'output-mode') === 'direct' && value % 512 !== 0) {
                            return 'In direct mode chunk size must be a multiple of 512!';
                        }
                    },
                },
                'stripe-size': {
                    short: 't',
                    default: 1024 * 1024 * 1024,
                    parse: this.parseSize,
                    validate: (value) => {
                        if (isNaN(value)) {
                            return 'Specified stripe size is not a number!';
                        }
                        if (this.args.getOption('test', 'mode') !== 'x') {
                            return 'Stripe size can only be set for cross tests!';
                        }
                    },
                },
                start: {
                    short: 's',
                    parse: this.parseSize,
                    validate: (value) => {
                        if (isNaN(value)) {
                            return 'Specified start offset is not a number!';
                        }
                        if (this.args.getOption('test', 'output-mode') === 'direct' && value % 512 !== 0) {
                            return "In direct mode 'start' must be a multiple of 512!";
                        }
                    },
                },
            },
        },
        devices: {
            positionals: {},
            options: {},
        },
    });

    private parseSize(value: string) {
        let multiplier = 1;
        if (value.match(/[KMG]$/)) {
            multiplier = value.endsWith('K') ? 1024 : value.endsWith('M') ? 1024 * 1024 : 1024 * 1024 * 1024;
            value = value.slice(0, -1);
        }
        return multiplier * Number(value);
    }

    private async runModeDevices() {
        const devices = await BlockDeviceInfo.loadAll();
        for (const bdInfo of devices) {
            console.log('-------------------------------------------------------------------------------');
            console.log('Device:', bdInfo.name);
            if (bdInfo.sn) {
                console.log('Serial:', bdInfo.sn);
            }
            console.log('Path:  ', bdInfo.path);
            console.log('Size:  ', formatSize(bdInfo.size), '(' + bdInfo.size + ' B)');
        }
        console.log('-------------------------------------------------------------------------------');
    }

    private async runModeTest() {
        const bdInfo = await BlockDeviceInfo.load(this.args.getPosition('test', 0));
        console.log('-------------------------------------------------------------------------------');
        console.log('Device:', bdInfo.name);
        if (bdInfo.sn) {
            console.log('Serial:', bdInfo.sn);
        }
        console.log('Path:  ', bdInfo.path);
        console.log('Size:  ', formatSize(bdInfo.size), '(' + bdInfo.size + ' B)');
        console.log('-------------------------------------------------------------------------------');
        console.log('ATTENTION: USE AT YOUR OWN RISK!');
        console.log('-------------------------------------------------------------------------------');
        console.log(
            'Will perform',
            { w: 'write', r: 'read', wr: 'write and read', x: 'cross (write and read)' }[this.args.getOption('test', 'mode')],
            'test.',
        );
        if (
            this.args.getOption('test', 'mode') === 'w' ||
            this.args.getOption('test', 'mode') === 'wr' ||
            this.args.getOption('test', 'mode') === 'x'
        ) {
            console.log('All data on the device will be deleted!');
        }
        const rl = createInterface(process.stdin, process.stdout);
        const answer = await rl.question('Do you want to proceed? (type uppercase YES) > ');
        rl.close();
        if (answer !== 'YES') {
            throw new AbortedError();
        }
        const bdTest = new BlockDeviceTest(bdInfo, {
            startAt: this.args.getOption('test', 'start'),
            openMode: this.args.getOption('test', 'output-mode'),
            ioChunkSize: this.args.getOption('test', 'chunk-size'),
        });
        const speedMeter = new ConsoleSpeedMeter('  ', this.args.getOption('test', 'mode') === 'x');
        bdTest.on('bytes-processed', (bytes) => {
            speedMeter.addBytes(bytes);
        });
        bdTest.on('state', (state) => {
            speedMeter.setState(state);
        });
        if (
            this.args.getOption('test', 'mode') === 'w' ||
            this.args.getOption('test', 'mode') === 'r' ||
            this.args.getOption('test', 'mode') === 'wr'
        ) {
            const randomPoolSize = Math.min(Math.floor(bdInfo.size / 2), 1024 * 1024 * 100);
            const provider = RepeatedRandomDataProvider.create(randomPoolSize);
            const verifier = RepeatedRandomDataVerifier.create(randomPoolSize);

            if (this.args.getOption('test', 'mode') === 'w' || this.args.getOption('test', 'mode') === 'wr') {
                console.log('Writing test data ...');
                speedMeter.start(bdTest.testSize);
                try {
                    await bdTest.writeTestData(provider);
                    speedMeter.stop();
                } catch (error) {
                    speedMeter.stop();
                    throw new WriteTestError(error.message);
                }
            }
            if (this.args.getOption('test', 'mode') === 'r' || this.args.getOption('test', 'mode') === 'wr') {
                console.log('Verifying test data ...');
                speedMeter.start(bdTest.testSize);
                try {
                    await bdTest.readTestData(verifier);
                    speedMeter.stop();
                } catch (error) {
                    speedMeter.stop();
                    throw new ReadTestError(error.message);
                }
            }
        }
        if (this.args.getOption('test', 'mode') === 'x') {
            // TODO: make configurable? note: currently only single-byte patterns are supported
            const patterns = [0xaa, 0x55];
            const jumps1 = new Log2Jumps();
            const jumps2 = new BafJumps();
            const patternObjs = patterns.map((pattern) =>
                RepeatedPatternDataProvider.create(this.args.getOption('test', 'chunk-size'), pattern),
            );
            console.log(
                'Run cross-test using a chunk size of ' +
                    formatSize(this.args.getOption('test', 'chunk-size')) +
                    ' and patterns ' +
                    patternObjs.map((p) => p.pattern).join(', ') +
                    ' ...',
            );
            speedMeter.start(bdTest.testSize * patterns.length * 2);
            try {
                await bdTest.crossTestData(patternObjs, [jumps1, jumps2], this.args.getOption('test', 'stripe-size'));
                speedMeter.stop();
            } catch (error) {
                speedMeter.stop();
                throw new CrossTestError(error.message);
            }
        }
        console.log('Done');
    }

    async run(inArgs: string[]) {
        if (['darwin', 'linux', 'win32'].indexOf(process.platform) < 0) {
            throw new UnsupportedPlatformError();
        }

        const m = process.versions.node.match(/^(\d+)\..*/);
        if (!m || Number(m[1]) < 17) {
            throw new UnsupportedNodeVersionError();
        }

        this.args.parse(inArgs);

        if (this.args.mode === 'devices') {
            await this.runModeDevices();
        } else {
            await this.runModeTest();
        }
    }
}
