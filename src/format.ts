export function zeroPaddedTwoDigit(s: string) {
    if (s.length < 2) {
        return ('00' + s).slice(-2);
    }
    return s;
}

export function formatTime(seconds: number) {
    if (isNaN(seconds)) {
        return '??d ??h ??m ??s';
    }
    let res = '';
    if (seconds >= 86400) {
        const days = Math.floor(seconds / 86400);
        res += zeroPaddedTwoDigit(days + '');
        seconds -= days * 86400;
    } else {
        res += '00';
    }
    res += 'd ';
    if (seconds >= 3600) {
        const hours = Math.floor(seconds / 3600);
        res += zeroPaddedTwoDigit(hours + '');
        seconds -= hours * 3600;
    } else {
        res += '00';
    }
    res += 'h ';
    if (seconds >= 60) {
        const minutes = Math.floor(seconds / 60);
        res += zeroPaddedTwoDigit(minutes + '');
        seconds -= minutes * 60;
    } else {
        res += '00';
    }
    res += 'm ';
    res += zeroPaddedTwoDigit(seconds + '');
    res += 's';
    return res;
}

export function twoDecimalPlaces(x: number) {
    let s = x + '';
    let i = s.indexOf('.');
    if (i < 0) {
        i = s.length;
        s += '.';
    }
    s += '00';
    return s.substring(0, i + 3);
}

export function padLeftDecimal(s: string, n: number) {
    let i = s.indexOf('.');
    if (i < 0) {
        i = 1;
    }
    if (i < n) {
        s = ' '.repeat(n - i) + s;
    }
    return s;
}

export function formatSize(bytes: number) {
    let div = 1;
    let unit = 'B';
    if (bytes >= 1000000000) {
        div = 1073741824;
        unit = 'GiB';
    } else if (bytes >= 1000000) {
        div = 1048576;
        unit = 'MiB';
    } else if (bytes >= 1000) {
        div = 1024;
        unit = 'KiB';
    }
    return twoDecimalPlaces(bytes / div) + ' ' + unit;
}
