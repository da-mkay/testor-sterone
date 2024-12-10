# testor-sterone

testor-sterone is a utility which can be used to test HDDs for failures.

## Why another test app for HDDs? / The Story

One day one of my disks got kicked out of my NAS RAID. I checked the supposedly bad sector, I checked the S.M.A.R.T. values and did some extended S.M.A.R.T. tests. Everything was ok. So I decided to use some tools to test the drive, for example the one from the drive manufacturer. These tools usually write test data to the disk sequentially, read the data and verify it. And it took hours to complete, just to see that everything was fine. So I put that disk back to the RAID and started the rebuild. But after a short time it got kicked out again. So I repeated all tests, but again everything seemed to be fine.

Then I thought maybe I need to stress the disk to provoke disk failures. This is when testor-sterone was born. Its cross-test jumps on the disk back and forth, writes different patterns, reads and validates the data. And boom! I detected write failures, read failures and sometimes even if writing and reading succeeded, the written and read data did not match.

As this tool might be useful to others, I thought I share it here.
And to provide the full package, testor-sterone can not only run the aforementioned cross-tests, it can also write test data sequentially and verify it afterwards ... the traditional way.

## Installation

You need to have NodeJS (>= v17) installed.

Then, to install testor-sterone, run:

```
$ npm i -g testor-sterone
```

Alternatively you can download the `dist/testor.js` file and run it directly using NodeJS.

## Requirements

testor-sterone builds on top of other tools to retrieve information about block devices (like HDDs). Those tools must be globally available on your system:

-   Linux: `lsblk`
-   MacOS: `diskutil`
-   Windows: `powershell.exe` (Get-WmiObject cmdlet)\
    TODO:/NOTE: Unfortunately WMI returns incorrect device sizes. Thus, a few mebibytes at the end of the device remain untested.

## Usage

Note: You must run this tool with super user privileges. Otherwise it cannot write directly to block devices like HDDs.

Note: The following examples were executed on a Linux system. On Windows and MacOS the commands are the same, but especially the pathes of block devices look different (and no `sudo` on Windows).

At first we look which devices are available:

```
$ # If testor-sterone was installed via npm:
$ sudo testor devices

$ # If you downloaded testor.js manually:
$ sudo node testor.js devices
```

The output will look like this

```
-------------------------------------------------------------------------------
Device: INTEL_SSDSC2MH120A2
Serial: LNEL12345678901ABC
Path:   /dev/sda
Size:   111.79 GiB (120034123776 B)
-------------------------------------------------------------------------------
Device: WDC_WD20EARX-00PASB0
Serial: WD-WCABCD123456
Path:   /dev/sdb
Size:   1863.01 GiB (2000398934016 B)
-------------------------------------------------------------------------------
Device: Samsung SSD 970 PRO 512GB
Serial: S123AB123456789
Path:   /dev/nvme0n1
Size:   476.93 GiB (512110190592 B)
-------------------------------------------------------------------------------
```

Let's test the device `/dev/sdb`:

In the following snippet we perform a write-test followed by a read-test.

```
$ sudo testor test /dev/sdb
-------------------------------------------------------------------------------
Device: WDC_WD20EARX-00PASB0
Serial: WD-WCABCD123456
Path:   /dev/sdb
Size:   1863.01 GiB (2000398934016 B)
-------------------------------------------------------------------------------
ATTENTION: USE AT YOUR OWN RISK!
-------------------------------------------------------------------------------
Will perform write and read test.
All data on the device will be deleted!
Do you want to proceed? (type uppercase YES) > YES
Writing test data ...
  Speed:     [CUR] 107.39 MiB/s   [AVG] 112.68 MiB/s   [MIN] 107.39 MiB/s   [MAX] 118.71 MiB/s
  Progress:  0.04 %   (884998144 B = 844.00 MiB)
  Elapsed:   00d 00h 00m 07s
  Remaining: 00d 04h 55m 56s
```

And here we perform a cross-test.

```
$ sudo testor test /dev/sdb --mode x
-------------------------------------------------------------------------------
Device: WDC_WD20EARX-00PASB0
Serial: WD-WCABCD123456
Path:   /dev/sdb
Size:   1863.01 GiB (2000398934016 B)
-------------------------------------------------------------------------------
ATTENTION: USE AT YOUR OWN RISK!
-------------------------------------------------------------------------------
Will perform cross (write and read) test.
All data on the device will be deleted!
Do you want to proceed? (type uppercase YES) > YES
Run cross-test using a chunk size of 4.00 MiB and patterns 0xAA, 0x55 ...
  Speed:     [CUR]  92.96 MiB/s   [AVG]  93.39 MiB/s   [MIN]  91.86 MiB/s   [MAX]  95.42 MiB/s
  Progress:  0.00 %   (536870912 B = 512.00 MiB)
  State:     Writing 0xAA to 0 B - 1073741824 B  (0.00 B - 1.00 GiB) using Log2 jumps
  Elapsed:   00d 00h 00m 05s
  Remaining: 00d 22h 48m 02s
```

Attention: All data on the device will be deleted. Use at your own risk!

### Available Options:

The following options are available when running tests:

| Option                                  | Possible values                                                                                               | Default                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mode MODE` or <br>`-m  MODE`         | `rw`, `w`, `r`, `x`                                                                                           | `wr`                                       | `wr`: First write test data to the device sequentially. Afterwards, read the data and verify it.<br>`w`: Only write test data to the device.<br>`r`: Read data from the device and verify it. Of course, you should have written test data to the disk before you use the read-mode.<br>`x`: Use cross-test, i.e. perform a test stripe-wise where we jump back and forth inside the stripe and alternately write, read and verify different patterns, until we move on to the next stripe. |
| `--output-mode MODE` or <br>`-o  MODE`  | `direct`, `dsync`, `normal`                                                                                   | Linux, MacOS: `direct`<br>Windows: `dsync` | Usually you want to bypass as much caches as possible. So in almost all cases you should not change the default output mode. In case you need to change it for some reason, this is the option to go.                                                                                                                                                                                                                                                                                       |
| `--chunk-size SIZE` or <br>`-c  SIZE`   | Number of bytes. Suffixes `K`, `M`, `G` may be used to specify Kibibytes, Mebibytes, Gibibytes, respectively. | `4M` (4 Mebibytes)                         | The number of bytes to write/read at once.<br>NOTE: If you use output-mode `direct`, then the chunk size must be a multiple of 512.                                                                                                                                                                                                                                                                                                                                                         |
| `--stripe-size SIZE` or <br>`-t  SIZE`  | Number of bytes. Suffixes `K`, `M`, `G` may be used to specify Kibibytes, Mebibytes, Gibibytes, respectively. | `1G` (1 Gibibyte)                          | This option is available in cross-mode only. In cross-mode the disk is tested stripe by stripe. While testing a stripe, the test jumps back and forth within the stripe and alternately writes and reads data. Using this option you can specify the size of those stripes.                                                                                                                                                                                                                 |
| `--start POSITION` or <br>`-s POSITION` | Number of bytes. Suffixes `K`, `M`, `G` may be used to specify Kibibytes, Mebibytes, Gibibytes, respectively. | `0`                                        | This option specifies the number of bytes to skip before testing anything. This can be useful in case you had to stop a test and want to resume where it left off.                                                                                                                                                                                                                                                                                                                          |

## Developer notes

To compile the typescript code during development:

```
$ npm run build
```

To create a bundle (`dist/testor.js`):

```
$ npm run bundle
```

To run the tests:

```
$ npm test
```
