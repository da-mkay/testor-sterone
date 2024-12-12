export type ValidateFunction<T> = (value: T) => string | undefined;

export interface CliOptionConfig<T> {
    short?: string;
    parse: (value: string) => T;
    default?: T | (() => T);
    validate?: ValidateFunction<T>;
}
export interface CliPositionalConfig<T> {
    name: string;
    parse: (value: string) => T;
    validate?: ValidateFunction<T>;
}

export interface CliArgsConfig {
    [mode: string]: {
        positionals?: { [i: number]: CliPositionalConfig<any> };
        options: { [longName: string]: CliOptionConfig<any> };
    };
}

type CliOptions<T extends CliArgsConfig> = {
    [mode in keyof T]?: {
        [LongName in keyof T[mode]['options']]?: T[mode]['options'][LongName] extends CliOptionConfig<infer X> ? X : never;
    };
};

type CliPositionals<T extends CliArgsConfig> = {
    [mode in keyof T]?: {
        [i in keyof T[mode]['positionals']]?: T[mode]['positionals'][i] extends CliPositionalConfig<infer X> ? X : never;
    };
};

export class CliArgsError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class UnknownModeError extends CliArgsError {
    constructor(modes: string[], mode: string) {
        super(`Unknown mode ${mode ? mode : 'N/A'}! Use one of the following modes: ${modes.join(', ')}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class NotInModeAvailableError extends CliArgsError {
    constructor(type: string, value: string) {
        super(`Trying to access ${type} ${value} which is not available in current mode!`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class InvalidPositionalArgumentsError extends CliArgsError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class InvalidPositionalArgumentError extends CliArgsError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class InvalidOptionArgumentError extends CliArgsError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class CliArgs<T extends CliArgsConfig> {
    get mode() {
        return this._mode;
    }

    private _mode: keyof T;
    private positionals: CliPositionals<T> = {};
    private options: CliOptions<T> = {};

    constructor(private readonly config: T) {}

    parse(args: string[] = process.argv.slice(2)) {
        args = args.slice();
        const modes = Object.keys(this.config);
        const { positionals, options } = this.normalizeArgs(args);
        const mode: keyof T = positionals.length ? positionals.shift() : '';
        if (!modes.includes(mode)) {
            throw new UnknownModeError(modes, mode);
        }
        this._mode = mode;
        const positions: number[] = Object.keys(this.config[mode].positionals || []).map((pos) => Number(pos));
        if (positions.length > positionals.length) {
            positions.sort();
            const missing = positions.map((pos) => this.config[mode].positionals[pos].name).slice(positionals.length);
            throw new InvalidPositionalArgumentsError(`Missing argument(s): ${missing.join(', ')}`);
        } else if (positions.length < positionals.length) {
            const tooMuch = positionals.slice(positions.length);
            throw new InvalidPositionalArgumentsError(
                `Expected ${positions.length} arguments, but got ${positionals.length}. These are too much: \n${tooMuch}`,
            );
        }
        this.positionals[mode] = {};
        this.options[mode] = {};
        const positionalValuesToValidate: [any, ValidateFunction<any>][] = [];
        for (let i = 0; i < positions.length; i++) {
            const value = this.config[mode].positionals[i].parse(positionals[i]);
            if (this.config[mode].positionals[i].validate) {
                positionalValuesToValidate.push([value, this.config[mode].positionals[i].validate]);
            }
            this.positionals[mode][i] = value;
        }
        const longOptionNames = Object.keys(this.config[mode].options) as (keyof CliOptions<T>[typeof mode] & string)[];
        const optionValuesToValidate: [any, ValidateFunction<any>][] = [];
        for (const opt of options) {
            const i = opt.indexOf('=');
            const name = opt.substring(0, i);
            let value: any = opt.substring(i + 1);
            const lon = longOptionNames.find(
                (longName) => name === '--' + longName || name === '-' + this.config[mode].options[longName].short,
            );
            if (!lon) {
                throw new InvalidOptionArgumentError('Unknown option "' + name + '"');
            }
            if (this.config[mode].options[lon].parse) {
                value = this.config[mode].options[lon].parse(value);
            }
            if (this.config[mode].options[lon].validate) {
                optionValuesToValidate.push([value, this.config[mode].options[lon].validate]);
            }
            this.options[mode][lon] = value;
        }
        for (const [value, validate] of positionalValuesToValidate) {
            const error = validate(value);
            if (error) {
                throw new InvalidPositionalArgumentError(error);
            }
        }
        for (const [value, validate] of optionValuesToValidate) {
            const error = validate(value);
            if (error) {
                throw new InvalidOptionArgumentError(error);
            }
        }
        for (const longName of longOptionNames) {
            const oc = this.config[mode].options[longName];
            if (this.options[mode][longName] === undefined && oc.default) {
                this.options[mode][longName] = typeof oc.default === 'function' ? oc.default() : oc.default;
            }
        }
    }

    private normalizeArgs(args: string[]) {
        const positionals: string[] = [];
        const options: string[] = [];
        let inOption = false;
        while (args.length) {
            let arg = args.shift();
            if (inOption) {
                options[options.length - 1] = options[options.length - 1] + arg;
                inOption = false;
                continue;
            }
            if (arg.startsWith('-')) {
                if (!arg.includes('=')) {
                    arg += '=';
                    inOption = true;
                }
                options.push(arg);
            } else {
                positionals.push(arg);
            }
        }
        return { positionals, options };
    }

    getOption<M extends keyof CliOptions<T>, N extends keyof CliOptions<T>[M]>(mode: M, longName: N): CliOptions<T>[M][N] {
        if (this._mode === undefined || this._mode !== mode) {
            throw new NotInModeAvailableError('option', longName.toString());
        }
        return this.options[mode][longName];
    }

    getPosition<M extends keyof CliPositionals<T>, N extends keyof CliPositionals<T>[M]>(mode: M, i: N): CliPositionals<T>[M][N] {
        if (this._mode === undefined || this._mode !== mode) {
            throw new NotInModeAvailableError('positional argument', i.toString());
        }
        return this.positionals[mode][i];
    }
}
