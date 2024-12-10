jest.mock('node:child_process');

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { BlockDeviceInfo } from '../../src/block-device/block-device-info';
import { exec, ChildProcess } from 'node:child_process';
import { registerPlatformMock } from '../mock-platform';

// Use own type of exec because node's exec type contains some __promisify__ which causes problems when used with jest.Mock.
type execClb = (error: any, stdout: string, stderr: string) => void;
type execType = (command: string, options: any, callback: execClb) => ChildProcess;

const mockExec = (mockFn: (clb: execClb, params: { command: string; options: any }) => void) => {
    (exec as unknown as jest.Mock<execType>).mockImplementation((command: string, options: any, clb: execClb) => {
        mockFn(clb, { command, options });
        return {} as any; // unused in BlockDeviceInfo
    });
};

const validListStdoutLsblk = `NAME="/dev/loop0" SIZE="4096" MODEL="" SERIAL=""
NAME="/dev/loop1" SIZE="58363904" MODEL="" SERIAL=""
NAME="/dev/loop2" SIZE="167428096" MODEL="" SERIAL=""
NAME="/dev/loop3" SIZE="58363904" MODEL="" SERIAL=""
NAME="/dev/loop4" SIZE="167456768" MODEL="" SERIAL=""
NAME="/dev/loop5" SIZE="77819904" MODEL="" SERIAL=""
NAME="/dev/loop6" SIZE="66547712" MODEL="" SERIAL=""
NAME="/dev/loop7" SIZE="521121792" MODEL="" SERIAL=""
NAME="/dev/loop8" SIZE="77713408" MODEL="" SERIAL=""
NAME="/dev/loop9" SIZE="366678016" MODEL="" SERIAL=""
NAME="/dev/loop10" SIZE="172830720" MODEL="" SERIAL=""
NAME="/dev/loop11" SIZE="69771264" MODEL="" SERIAL=""
NAME="/dev/loop12" SIZE="366682112" MODEL="" SERIAL=""
NAME="/dev/loop13" SIZE="69795840" MODEL="" SERIAL=""
NAME="/dev/loop14" SIZE="172761088" MODEL="" SERIAL=""
NAME="/dev/loop15" SIZE="42840064" MODEL="" SERIAL=""
NAME="/dev/loop16" SIZE="42393600" MODEL="" SERIAL=""
NAME="/dev/loop17" SIZE="85209088" MODEL="" SERIAL=""
NAME="/dev/loop18" SIZE="521015296" MODEL="" SERIAL=""
NAME="/dev/loop19" SIZE="67014656" MODEL="" SERIAL=""
NAME="/dev/loop20" SIZE="96141312" MODEL="" SERIAL=""
NAME="/dev/sda" SIZE="120034123776" MODEL="INTEL_SSDSC2MH120A2" SERIAL="LNEL12345678900CCC"
NAME="/dev/sdb" SIZE="4000787030016" MODEL="WDC_WD40EZRX-00SPEB0" SERIAL="WD-WCC12345678E"
NAME="/dev/nvme0n1" SIZE="512110190592" MODEL="Samsung SSD 970 PRO 512GB" SERIAL="S123456789"`;

const validListStdoutDiskutil = `/dev/disk0 (internal, physical):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:      GUID_partition_scheme                        *1.0 TB     disk0
   1:             Apple_APFS_ISC Container disk1         524.3 MB   disk0s1
   2:                 Apple_APFS Container disk3         994.7 GB   disk0s2
   3:        Apple_APFS_Recovery Container disk2         5.4 GB     disk0s3

/dev/disk3 (synthesized):
   #:                       TYPE NAME                    SIZE       IDENTIFIER
   0:      APFS Container Scheme -                      +994.7 GB   disk3
                                 Physical Store disk0s2
   1:                APFS Volume Macintosh HD            10.7 GB    disk3s1
   2:              APFS Snapshot com.apple.os.update-... 10.7 GB    disk3s1s1
   3:                APFS Volume Preboot                 6.6 GB     disk3s2
   4:                APFS Volume Recovery                972.5 MB   disk3s3
   5:                APFS Volume Data                    212.7 GB   disk3s5
   6:                APFS Volume VM                      20.5 KB    disk3s6`;

const validListStdoutWinDiskDrive = `

DeviceID     : \\\\.\\PHYSICALDRIVE2
Model        : Samsung SSD 970 PRO 512GB
Size         : 512105932800
SerialNumber : 0012_3456_789B_CDEF.

DeviceID     : \\\\.\\PHYSICALDRIVE0
Model        : INTEL SSDSC2MH120A2
Size         : 120031511040
SerialNumber : LNEL12345678900CCC

DeviceID     : \\\\.\\PHYSICALDRIVE1
Model        : WDC WD40EZRX-00SPEB0
Size         : 4000784417280
SerialNumber :      WD-WCC12345678E



`.replace(/\n/g, '\r\n'); // This file uses \n only, but Win returns \r\n instead

const validStdoutLsblk = `NAME="/dev/sda" SIZE="1050214588416" MODEL="Crucial_CT1050MX" SERIAL="123456A12345"`;

const validStdoutDiskutil = `Device Identifier:         disk0
Device Node:               /dev/disk0
Whole:                     Yes
Part of Whole:             disk0
Device / Media Name:       APPLE SSD AP1234Z

Volume Name:               Not applicable (no file system)
Mounted:                   Not applicable (no file system)
File System:               None

Content (IOContent):       GUID_partition_scheme
OS Can Be Installed:       No
Media Type:                Allgemein
Protocol:                  Apple Fabric
SMART Status:              Verified

Disk Size:                 1.0 TB (1000555581440 Bytes) (exactly 1954210120 512-Byte-Units)
Device Block Size:         4096 Bytes

Media OS Use Only:         No
Media Read-Only:           No
Volume Read-Only:          Not applicable (no file system)

Device Location:           Internal
Removable Media:           Fixed

Solid State:               Yes
Hardware AES Support:      Yes`;

const validStdoutWinDiskDrive = `DeviceID     : \\.\PHYSICALDRIVE1
Model        : WDC WD40EZRX-00SPEB0
Size         : 4000784417280
SerialNumber :      WD-WCC12345678E`;

describe('BlockDeviceInfo', () => {
    describe('load', () => {
        const mockPlatform = registerPlatformMock();

        describe('on unsupported platform', () => {
            beforeEach(() => {
                mockPlatform('android');
            });

            test('should fail', async () => {
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Unsupported platform: android');
            });
        });

        describe('on MacOS', () => {
            beforeEach(() => {
                mockPlatform('darwin');
            });

            test('should parse valid diskutil output', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutDiskutil, '');
                });
                const info = await BlockDeviceInfo.load('some-device');
                expect(exec).toHaveBeenCalledWith('diskutil info some-device', expect.anything(), expect.anything());
                expect(exec).toHaveBeenCalledTimes(1);
                expect(info.name).toEqual('APPLE SSD AP1234Z');
                expect(info.path).toEqual('/dev/disk0');
                expect(info.size).toEqual(1000555581440);
            });

            test('should fail if executing diskutil fails', async () => {
                mockExec((clb) => {
                    clb(new Error('oh no'), '', 'some error');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('some error');
            });

            test('should fail if diskutil output contains no name information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutDiskutil.replace(/device \/ media name:.*\n/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no name');
            });

            test('should fail if diskutil output contains no size information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutDiskutil.replace(/disk size:.*\n/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no size');
            });

            test('should fail if diskutil output contains no path information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutDiskutil.replace(/device node:.*\n/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no path');
            });
        });

        describe('on Linux', () => {
            beforeEach(() => {
                mockPlatform('linux');
            });

            test('should parse valid lsblk output', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutLsblk, '');
                });
                const info = await BlockDeviceInfo.load('some-device');
                expect(exec).toHaveBeenCalledWith('lsblk -bdPpo NAME,SIZE,MODEL,SERIAL some-device', expect.anything(), expect.anything());
                expect(exec).toHaveBeenCalledTimes(1);
                expect(info.name).toEqual('Crucial_CT1050MX');
                expect(info.path).toEqual('/dev/sda');
                expect(info.size).toEqual(1050214588416);
                expect(info.sn).toEqual('123456A12345');
            });

            test('should fail if executing lsblk fails', async () => {
                mockExec((clb) => {
                    clb(new Error('oh no'), '', 'some error');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('some error');
            });

            test('should fail if lsblk output contains no name information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutLsblk.replace(/MODEL="(.+?)"/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no name');
            });

            test('should fail if lsblk output contains no size information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutLsblk.replace(/SIZE="(\d+)"/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no size');
            });

            test('should fail if lsblk output contains no path information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutLsblk.replace(/NAME="(.+?)"/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no path');
            });
        });

        describe('on Windows', () => {
            beforeEach(() => {
                mockPlatform('win32');
            });

            test('should parse valid Win32_diskdrive output', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutWinDiskDrive, '');
                });
                const info = await BlockDeviceInfo.load('some-device');
                expect(exec).toHaveBeenCalledWith(
                    'powershell.exe -Command "Get-WmiObject -Class Win32_diskdrive | Where-Object -Property DeviceID -EQ \'some-device\' | Select-Object -Property DeviceID, Model, Size, SerialNumber | fl"',
                    expect.anything(),
                    expect.anything(),
                );
                expect(exec).toHaveBeenCalledTimes(1);
                expect(info.name).toEqual('WDC WD40EZRX-00SPEB0');
                expect(info.path).toEqual('\\.PHYSICALDRIVE1');
                expect(info.size).toEqual(4000784417280);
                expect(info.sn).toEqual('WD-WCC12345678E');
            });

            test('should fail if Win32_diskdrive output is empty', async () => {
                mockExec((clb) => {
                    clb(null, '', '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Device not found!');
            });

            test('should fail if executing Win32_diskdrive fails', async () => {
                mockExec((clb) => {
                    clb(new Error('oh no'), '', 'some error');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('some error');
            });

            test('should fail if Win32_diskdrive output contains no name information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutWinDiskDrive.replace(/Model +: +(.+?)/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no name');
            });

            test('should fail if Win32_diskdrive output contains no size information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutWinDiskDrive.replace(/Size +: +(.+?)/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no size');
            });

            test('should fail if Win32_diskdrive output contains no path information', async () => {
                mockExec((clb) => {
                    clb(null, validStdoutWinDiskDrive.replace(/DeviceID +: +(.+?)/gi, ''), '');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('Failed to parse block device info: found no path');
            });
        });
    });

    describe('loadAll', () => {
        const mockPlatform = registerPlatformMock();

        describe('on unsupported platform', () => {
            beforeEach(() => {
                mockPlatform('android');
            });

            test('should fail', async () => {
                await expect(BlockDeviceInfo.loadAll()).rejects.toThrow('Unsupported platform: android');
            });
        });

        describe('on MacOS', () => {
            beforeEach(() => {
                mockPlatform('darwin');
            });

            test('should parse valid diskutil output', async () => {
                mockExec((clb, params) => {
                    if (params.command === 'diskutil list') {
                        clb(null, validListStdoutDiskutil, '');
                    } else {
                        clb(null, validStdoutDiskutil, '');
                    }
                });

                const infoa = await BlockDeviceInfo.loadAll();

                expect(exec).toHaveBeenCalledWith('diskutil list', expect.anything(), expect.anything());
                expect(infoa[0].name).toEqual('APPLE SSD AP1234Z');
                expect(infoa[0].path).toEqual('/dev/disk0');
                expect(infoa[0].size).toEqual(1000555581440);
                expect(infoa[0].sn).toBeUndefined();
            });

            test('should fail if executing diskutil fails', async () => {
                mockExec((clb) => {
                    clb(new Error('oh no'), '', 'some error');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('some error');
            });
        });

        describe('on Linux', () => {
            beforeEach(() => {
                mockPlatform('linux');
            });

            test('should parse valid lsblk output', async () => {
                mockExec((clb) => {
                    clb(null, validListStdoutLsblk, '');
                });
                const info = await BlockDeviceInfo.loadAll();
                expect(exec).toHaveBeenCalledWith('lsblk -bdPpo NAME,SIZE,MODEL,SERIAL', expect.anything(), expect.anything());
                expect(exec).toHaveBeenCalledTimes(1);
                expect(info[0].name).toEqual('INTEL_SSDSC2MH120A2');
                expect(info[0].path).toEqual('/dev/sda');
                expect(info[0].size).toEqual(120034123776);
                expect(info[0].sn).toEqual('LNEL12345678900CCC');

                expect(info[1].name).toEqual('WDC_WD40EZRX-00SPEB0');
                expect(info[1].path).toEqual('/dev/sdb');
                expect(info[1].size).toEqual(4000787030016);
                expect(info[1].sn).toEqual('WD-WCC12345678E');

                expect(info[2].name).toEqual('Samsung SSD 970 PRO 512GB');
                expect(info[2].path).toEqual('/dev/nvme0n1');
                expect(info[2].size).toEqual(512110190592);
                expect(info[2].sn).toEqual('S123456789');
            });

            test('should fail if executing lsblk fails', async () => {
                mockExec((clb) => {
                    clb(new Error('oh no'), '', 'some error');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('some error');
            });
        });

        describe('on Windows', () => {
            beforeEach(() => {
                mockPlatform('win32');
            });

            test('should parse valid Win32_diskdrive output', async () => {
                mockExec((clb) => {
                    clb(null, validListStdoutWinDiskDrive, '');
                });
                const infoa = await BlockDeviceInfo.loadAll();
                expect(exec).toHaveBeenCalledWith(
                    'powershell.exe -Command "Get-WmiObject -Class Win32_diskdrive | Select-Object -Property DeviceID, Model, Size, SerialNumber | fl"',
                    expect.anything(),
                    expect.anything(),
                );
                expect(exec).toHaveBeenCalledTimes(1);
                expect(infoa[0].name).toEqual('Samsung SSD 970 PRO 512GB');
                expect(infoa[0].path).toEqual('\\\\.\\PHYSICALDRIVE2');
                expect(infoa[0].size).toEqual(512105932800);
                expect(infoa[0].sn).toEqual('0012_3456_789B_CDEF.');

                expect(infoa[1].name).toEqual('INTEL SSDSC2MH120A2');
                expect(infoa[1].path).toEqual('\\\\.\\PHYSICALDRIVE0');
                expect(infoa[1].size).toEqual(120031511040);
                expect(infoa[1].sn).toEqual('LNEL12345678900CCC');

                expect(infoa[2].name).toEqual('WDC WD40EZRX-00SPEB0');
                expect(infoa[2].path).toEqual('\\\\.\\PHYSICALDRIVE1');
                expect(infoa[2].size).toEqual(4000784417280);
                expect(infoa[2].sn).toEqual('WD-WCC12345678E');
            });

            test('should fail if executing Win32_diskdrive fails', async () => {
                mockExec((clb) => {
                    clb(new Error('oh no'), '', 'some error');
                });
                await expect(BlockDeviceInfo.load('some-device')).rejects.toThrow('some error');
            });
        });
    });
});
