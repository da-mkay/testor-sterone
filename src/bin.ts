import { CliArgsError } from './cli-args';
import {
    AbortedError,
    CrossTestError,
    Main,
    ReadTestError,
    UnsupportedNodeVersionError,
    UnsupportedPlatformError,
    WriteTestError,
} from './main';

const errorCodeMapping: [{ new (): Error }, number][] = [
    [UnsupportedNodeVersionError, 2],
    [UnsupportedPlatformError, 3],
    [CliArgsError, 4],
    [AbortedError, 5],
    [WriteTestError, 6],
    [ReadTestError, 7],
    [CrossTestError, 8],
];

(async () => {
    try {
        await new Main().run(process.argv.slice(2));
    } catch (e) {
        console.log(e.message);
        for (const [errorClass, exitCode] of errorCodeMapping) {
            if (e instanceof errorClass) {
                process.exit(exitCode);
            }
        }
        process.exit(1);
    }
})();
