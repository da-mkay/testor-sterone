import { describe, expect, test } from '@jest/globals';
import { formatSize, formatTime, padLeftDecimal, twoDecimalPlaces, zeroPaddedTwoDigit } from '../src/format';

describe('format', () => {
    describe('zeroPaddedTwoDigit', () => {
        test("should return '00' if empty string is passed", () => {
            const res = zeroPaddedTwoDigit('');
            expect(res).toEqual('00');
        });

        test('should precede passed string with a single 0 if passed string is a single character', () => {
            let res = zeroPaddedTwoDigit('0');
            expect(res).toEqual('00');
            res = zeroPaddedTwoDigit('1');
            expect(res).toEqual('01');
            res = zeroPaddedTwoDigit('9');
            expect(res).toEqual('09');
        });

        test('should return the passed string as-is if it contains at least two characters', () => {
            let res = zeroPaddedTwoDigit('12');
            expect(res).toEqual('12');
            res = zeroPaddedTwoDigit('123');
            expect(res).toEqual('123');
        });
    });

    describe('formatTime', () => {
        test('should format NaN value', () => {
            let res = formatTime(NaN);
            expect(res).toEqual('??d ??h ??m ??s');
        });

        test('should format values that fit into seconds only', () => {
            let res = formatTime(0);
            expect(res).toEqual('00d 00h 00m 00s');
            res = formatTime(1);
            expect(res).toEqual('00d 00h 00m 01s');
            res = formatTime(59);
            expect(res).toEqual('00d 00h 00m 59s');
        });

        test('should format values that fit into minutes and seconds', () => {
            let res = formatTime(60);
            expect(res).toEqual('00d 00h 01m 00s');
            res = formatTime(61);
            expect(res).toEqual('00d 00h 01m 01s');
            res = formatTime(119);
            expect(res).toEqual('00d 00h 01m 59s');
            res = formatTime(3599);
            expect(res).toEqual('00d 00h 59m 59s');
        });

        test('should format values that fit into hours to seconds', () => {
            let res = formatTime(3600);
            expect(res).toEqual('00d 01h 00m 00s');
            res = formatTime(3601);
            expect(res).toEqual('00d 01h 00m 01s');
            res = formatTime(3659);
            expect(res).toEqual('00d 01h 00m 59s');
            res = formatTime(3661);
            expect(res).toEqual('00d 01h 01m 01s');
            res = formatTime(7199);
            expect(res).toEqual('00d 01h 59m 59s');
            res = formatTime(86399);
            expect(res).toEqual('00d 23h 59m 59s');
        });

        test('should format values that fit into days to seconds', () => {
            let res = formatTime(86400);
            expect(res).toEqual('01d 00h 00m 00s');
            res = formatTime(86401);
            expect(res).toEqual('01d 00h 00m 01s');
            res = formatTime(86459);
            expect(res).toEqual('01d 00h 00m 59s');
            res = formatTime(86460);
            expect(res).toEqual('01d 00h 01m 00s');
            res = formatTime(86461);
            expect(res).toEqual('01d 00h 01m 01s');
            res = formatTime(86519);
            expect(res).toEqual('01d 00h 01m 59s');
            res = formatTime(90061);
            expect(res).toEqual('01d 01h 01m 01s');
            res = formatTime(90119);
            expect(res).toEqual('01d 01h 01m 59s');
            res = formatTime(93599);
            expect(res).toEqual('01d 01h 59m 59s');
            res = formatTime(169200);
            expect(res).toEqual('01d 23h 00m 00s');
            res = formatTime(172799);
            expect(res).toEqual('01d 23h 59m 59s');
            res = formatTime(8639999);
            expect(res).toEqual('99d 23h 59m 59s');
            res = formatTime(8640000);
            expect(res).toEqual('100d 00h 00m 00s');
        });
    });

    describe('twoDecimalPlaces', () => {
        test('should add ".00" to integers', () => {
            let res = twoDecimalPlaces(0);
            expect(res).toEqual('0.00');
            res = twoDecimalPlaces(123);
            expect(res).toEqual('123.00');
        });

        test('should add "0" to floating points numbers having only one decimal place', () => {
            let res = twoDecimalPlaces(-123.5);
            expect(res).toEqual('-123.50');
            res = twoDecimalPlaces(123.5);
            expect(res).toEqual('123.50');
        });

        test('should truncate decimal places to two decimal places', () => {
            let res = twoDecimalPlaces(-123.56789);
            expect(res).toEqual('-123.56');
            res = twoDecimalPlaces(123.56789);
            expect(res).toEqual('123.56');
        });
    });

    describe('padLeftDecimal', () => {
        test('should not add left-padding if n is zero', () => {
            let res = padLeftDecimal('1', 0);
            expect(res).toEqual('1');
            res = padLeftDecimal('1.2', 0);
            expect(res).toEqual('1.2');
            res = padLeftDecimal('12.3', 0);
            expect(res).toEqual('12.3');
        });

        test('should not add left-padding if n is smaller than integer-part-length', () => {
            let res = padLeftDecimal('12.3', 1);
            expect(res).toEqual('12.3');
            res = padLeftDecimal('123.4', 1);
            expect(res).toEqual('123.4');
            res = padLeftDecimal('123.4', 2);
            expect(res).toEqual('123.4');
        });

        test('should not add left-padding if n is equal to integer-part-length', () => {
            let res = padLeftDecimal('1', 1);
            expect(res).toEqual('1');
            res = padLeftDecimal('1.2', 1);
            expect(res).toEqual('1.2');
            res = padLeftDecimal('12.3', 2);
            expect(res).toEqual('12.3');
            res = padLeftDecimal('123.4', 3);
            expect(res).toEqual('123.4');
        });

        test('should add left-padding if n is greater than integer-part-length', () => {
            let res = padLeftDecimal('1', 2);
            expect(res).toEqual(' 1');
            res = padLeftDecimal('1.2', 2);
            expect(res).toEqual(' 1.2');
            res = padLeftDecimal('1', 3);
            expect(res).toEqual('  1');
            res = padLeftDecimal(' 1.2', 3);
            expect(res).toEqual('  1.2');
            res = padLeftDecimal('12.3', 3);
            expect(res).toEqual(' 12.3');
            res = padLeftDecimal('123.4', 4);
            expect(res).toEqual(' 123.4');
        });
    });

    describe('formatSize', () => {
        test('should output bytes if number of bytes is lower than 1000', () => {
            let res = formatSize(0);
            expect(res).toEqual('0.00 B');
            res = formatSize(1);
            expect(res).toEqual('1.00 B');
            res = formatSize(999);
            expect(res).toEqual('999.00 B');
        });

        test('should output kibibytes if number is greater than or equal to 1000 and lower than 1000000', () => {
            let res = formatSize(1000);
            expect(res).toEqual('0.97 KiB');
            res = formatSize(1024);
            expect(res).toEqual('1.00 KiB');
            res = formatSize(999999);
            expect(res).toEqual('976.56 KiB');
        });

        test('should output mebibytes if number is greater than or equal to 1000000 and lower than 1000000000', () => {
            let res = formatSize(1000000);
            expect(res).toEqual('0.95 MiB');
            res = formatSize(1024 * 1024);
            expect(res).toEqual('1.00 MiB');
            res = formatSize(999999999);
            expect(res).toEqual('953.67 MiB');
        });

        test('should output gebibytes if number is greater than or equal to 1000000000', () => {
            let res = formatSize(1000000000);
            expect(res).toEqual('0.93 GiB');
            res = formatSize(1024 * 1024 * 1024);
            expect(res).toEqual('1.00 GiB');
            res = formatSize(1024 * 1024 * 1024 * 9999.5);
            expect(res).toEqual('9999.50 GiB');
        });
    });
});
