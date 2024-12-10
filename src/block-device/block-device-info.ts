import * as assert from 'node:assert';
import { exec } from 'node:child_process';

export interface MandatoryBlockDeviceInfo {
    get name(): string;
    get size(): number;
    get path(): string;
}

function pExec(cmd: string) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        exec(cmd, {}, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(stderr));
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

export class BlockDeviceInfo implements MandatoryBlockDeviceInfo {
    get name() {
        return this._name;
    }
    get size() {
        return this._size;
    }
    get path() {
        return this._path;
    }
    get sn() {
        return this._sn;
    }

    private _name: string;
    private _size: number;
    private _path: string;
    private _sn: string;

    private constructor() {}

    private static parseDiskutilList(output: string) {
        return [...output.matchAll(/^(\/.+?) .*physical.*/gm)].map((m) => m[1]);
    }

    private parseDiskutilInfo(output: string) {
        let m = output.match(/device \/ media name: +(.*?)$/im);
        if (m) {
            this._name = m[1];
        }
        m = output.match(/disk size: +(.*?)$/im);
        if (m) {
            this._size = Number(m[1].replace(/.*\((\d+) Bytes\).*/, '$1'));
        }
        m = output.match(/device node: +(.*?)$/im);
        if (m) {
            this._path = m[1];
        }
    }

    private parseLsblkInfo(output: string) {
        let m = output.match(/NAME="(.*?)"/);
        if (m) {
            this._path = m[1];
        }
        m = output.match(/SIZE="(\d+)"/);
        if (m) {
            this._size = Number(m[1]);
        }
        m = output.match(/MODEL="(.*?)"/);
        if (m) {
            this._name = m[1];
        }
        m = output.match(/SERIAL="(.*?)"/);
        if (m) {
            this._sn = m[1];
        }
    }

    private parseWinDiskDrive(output: string) {
        let m = output.match(/DeviceID +: +(.*?)$/m);
        if (m) {
            this._path = m[1];
        }
        m = output.match(/Size +: +(.*?)$/m);
        if (m) {
            this._size = Number(m[1]);
        }
        m = output.match(/Model +: +(.*?)$/m);
        if (m) {
            this._name = m[1];
        }
        m = output.match(/SerialNumber +: +(.*?)$/m);
        if (m) {
            this._sn = m[1];
        }
    }

    static async load(device: string) {
        const bdInfo = new BlockDeviceInfo();
        if (process.platform === 'linux') {
            const { stdout } = await pExec('lsblk -bdPpo NAME,SIZE,MODEL,SERIAL ' + device);
            bdInfo.parseLsblkInfo(stdout);
        } else if (process.platform === 'darwin') {
            const { stdout } = await pExec('diskutil info ' + device);
            bdInfo.parseDiskutilInfo(stdout);
        } else if (process.platform === 'win32') {
            let { stdout } = await pExec(
                'powershell.exe -Command "Get-WmiObject -Class Win32_diskdrive | Where-Object -Property DeviceID -EQ \'' +
                    device +
                    '\' | Select-Object -Property DeviceID, Model, Size, SerialNumber | fl"',
            );
            stdout = stdout.trim();
            if (!stdout) {
                throw new Error('Device not found!');
            }
            bdInfo.parseWinDiskDrive(stdout);
        } else {
            throw new Error('Unsupported platform: ' + process.platform);
        }
        const mandatoryKeys: (keyof MandatoryBlockDeviceInfo)[] = ['name', 'path', 'size'];
        const missingKey = mandatoryKeys.find((key) => bdInfo[key] === undefined);
        if (missingKey) {
            throw new Error('Failed to parse block device info: found no ' + missingKey);
        }
        return bdInfo;
    }

    static async loadAll() {
        if (process.platform === 'linux') {
            const { stdout } = await pExec('lsblk -bdPpo NAME,SIZE,MODEL,SERIAL');
            return stdout
                .split('\n')
                .filter((l) => l.trim())
                .map((l) => {
                    const bdi = new BlockDeviceInfo();
                    bdi.parseLsblkInfo(l);
                    return bdi;
                })
                .filter((bdi) => !bdi.path.startsWith('/dev/loop'));
        } else if (process.platform === 'darwin') {
            const { stdout } = await pExec('diskutil list');
            const devices = BlockDeviceInfo.parseDiskutilList(stdout);
            const result: BlockDeviceInfo[] = [];
            for (const device of devices) {
                const bdi = await BlockDeviceInfo.load(device);
                result.push(bdi);
            }
            return result;
        } else if (process.platform === 'win32') {
            const { stdout } = await pExec(
                'powershell.exe -Command "Get-WmiObject -Class Win32_diskdrive | Select-Object -Property DeviceID, Model, Size, SerialNumber | fl"',
            );
            return stdout
                .split('\r\n\r\n')
                .filter((l) => l.trim())
                .map((l) => {
                    const bdi = new BlockDeviceInfo();
                    bdi.parseWinDiskDrive(l);
                    return bdi;
                });
        } else {
            throw new Error('Unsupported platform: ' + process.platform);
        }
    }
}
