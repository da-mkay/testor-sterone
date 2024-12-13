import { describe, expect, test, jest } from '@jest/globals';
import {
    CliArgs,
    InvalidOptionArgumentError,
    InvalidPositionalArgumentError,
    InvalidPositionalArgumentsError,
    NotInModeAvailableError,
    UnknownModeError,
} from '../src/cli-args';

describe('CliArgs', () => {
    describe('normalizeArgs', () => {
        test('should interpret arguments starting with dash as option', () => {
            const cargs = new CliArgs({});
            const { options } = cargs['normalizeArgs'](['positional1', '-o1=1', '--option2=2', 'positional2']);
            expect(options).toEqual(['-o1=1', '--option2=2']);
        });

        test('should interpret arguments not starting with dash as positional argument', () => {
            const cargs = new CliArgs({});
            const { positionals } = cargs['normalizeArgs'](['positional1', '-o1=1', '--option2=2', 'positional2']);
            expect(positionals).toEqual(['positional1', 'positional2']);
        });

        test('should use next argument as option value if current option argument contains no equal sign', () => {
            const cargs = new CliArgs({});
            const { options } = cargs['normalizeArgs'](['positional1', '-o1', '1', '--option2', '2', 'positional2']);
            expect(options).toEqual(['-o1=1', '--option2=2']);
        });

        test('should use no option value if current option argument contains no equal sign and there is no additional argument', () => {
            const cargs = new CliArgs({});
            const { options } = cargs['normalizeArgs'](['positional1', '-o1']);
            expect(options).toEqual(['-o1=']);
        });
    });

    describe('parse', () => {
        test('should throw UnknownModeError if no mode is passed but config contains no empty mode', () => {
            const cargs = new CliArgs({ myMode: { options: {} } });
            expect(() => {
                cargs.parse([]);
            }).toThrow(UnknownModeError);
        });

        test('should not throw UnknownModeError if no mode is passed and config contains empty mode', () => {
            const cargs = new CliArgs({ '': { options: {} } });
            expect(() => {
                cargs.parse([]);
            }).not.toThrow(UnknownModeError);
        });

        test('should throw UnknownModeError if mode is passed but config does not contain that mode', () => {
            const cargs = new CliArgs({ myMode: { options: {} } });
            expect(() => {
                cargs.parse(['invalidMode']);
            }).toThrow(UnknownModeError);
        });

        test('should throw InvalidPositionalArgumentsError if too many positional arguments are passed for the current mode', () => {
            const cargs = new CliArgs({ myMode: { options: {} } });
            expect(() => {
                cargs.parse(['myMode', 'invalidArg']);
            }).toThrow(InvalidPositionalArgumentsError);
        });

        test('should throw InvalidPositionalArgumentsError if too few positional arguments are passed for the current mode', () => {
            const cargs = new CliArgs({ myMode: { positionals: { 0: { name: 'foo', parse: (v) => v } }, options: {} } });
            expect(() => {
                cargs.parse(['myMode']);
            }).toThrow(InvalidPositionalArgumentsError);
        });

        test("should call parse function of mode's positional argument and store returned value in positionals property", () => {
            const config = { myMode: { positionals: { 0: { name: 'foo', parse: (v) => 'VALUE:' + v } }, options: {} } };
            const parseSpy = jest.spyOn(config.myMode.positionals[0], 'parse');
            const cargs = new CliArgs(config);
            expect(cargs['positionals']?.['myMode']?.['0']).toBeUndefined();
            cargs.parse(['myMode', 'arg1']);
            expect(parseSpy).toHaveBeenCalledTimes(1);
            expect(cargs['positionals']['myMode']['0']).toEqual('VALUE:arg1');
        });

        test("should call validate function of mode's positional argument", () => {
            const config = {
                myMode: {
                    positionals: { 0: { name: 'foo', parse: (v) => Number(v), validate: (n) => (isNaN(n) ? 'not a number' : undefined) } },
                    options: {},
                },
            };
            const validateSpy = jest.spyOn(config.myMode.positionals[0], 'validate');
            const cargs = new CliArgs(config);
            cargs.parse(['myMode', '1337']);
            expect(validateSpy).toHaveBeenCalledTimes(1);
        });

        test("should throw InvalidPositionalArgumentError containing the text returned by validate function of mode's positional argument", () => {
            const config = {
                myMode: {
                    positionals: { 0: { name: 'foo', parse: (v) => Number(v), validate: (n) => (isNaN(n) ? 'not a number' : undefined) } },
                    options: {},
                },
            };
            const validateSpy = jest.spyOn(config.myMode.positionals[0], 'validate');
            const cargs = new CliArgs(config);
            try {
                cargs.parse(['myMode', 'foo']);
                throw new Error('Expected parse() to throw error');
            } catch (e) {
                expect(e).toBeInstanceOf(InvalidPositionalArgumentError);
                expect(e.message).toEqual('not a number');
            }
            expect(validateSpy).toHaveBeenCalledTimes(1);
        });

        test('should throw InvalidOptionArgumentError if argument is not a valid option for the current mode', () => {
            const config = { myMode: { options: { foo: { parse: (v) => 'VALUE:' + v } } } };
            const cargs = new CliArgs(config);

            try {
                cargs.parse(['myMode', '--bar', 'baz']);
                throw new Error('Expected parse() to throw error');
            } catch (e) {
                expect(e).toBeInstanceOf(InvalidOptionArgumentError);
                expect(e.message).toEqual('Unknown option "--bar"');
            }
        });

        test("should call parse function of mode's option argument and store value in options property", () => {
            const config = { myMode: { options: { foo: { parse: (v) => 'VALUE:' + v } } } };
            const parseSpy = jest.spyOn(config.myMode.options.foo, 'parse');
            const cargs = new CliArgs(config);
            expect(cargs['options']?.myMode?.foo).toBeUndefined();
            cargs.parse(['myMode', '--foo', 'bar']);
            expect(parseSpy).toHaveBeenCalledTimes(1);
            expect(cargs['options'].myMode.foo).toEqual('VALUE:bar');
        });

        test("should call validate function of mode's option argument", () => {
            const config = { myMode: { options: { foo: { parse: (v) => 'VALUE:' + v, validate: () => undefined } } } };
            const validateSpy = jest.spyOn(config.myMode.options.foo, 'validate');
            const cargs = new CliArgs(config);
            cargs.parse(['myMode', '--foo']);
            expect(validateSpy).toHaveBeenCalledTimes(1);
        });

        test("should throw InvalidOptionArgumentError containing the text returned by validate function of mode's option argument", () => {
            const config = { myMode: { options: { foo: { parse: (v) => 'VALUE:' + v, validate: () => 'invalid value for foo' } } } };
            const validateSpy = jest.spyOn(config.myMode.options.foo, 'validate');
            const cargs = new CliArgs(config);
            try {
                cargs.parse(['myMode', '--foo']);
                throw new Error('Expected parse() to throw error');
            } catch (e) {
                expect(e).toBeInstanceOf(InvalidOptionArgumentError);
                expect(e.message).toEqual('invalid value for foo');
            }
            expect(validateSpy).toHaveBeenCalledTimes(1);
        });

        test("should call default function of mode's option argument if it is not specified by user and store that value in options property", () => {
            const config = { myMode: { options: { foo: { parse: (v) => 'VALUE:' + v, default: () => 'SomeDefault' } } } };
            const defaultSpy = jest.spyOn(config.myMode.options.foo, 'default');
            const cargs = new CliArgs(config);
            expect(cargs['options']?.myMode?.foo).toBeUndefined();
            cargs.parse(['myMode']);
            expect(defaultSpy).toHaveBeenCalledTimes(1);
            expect(cargs['options'].myMode.foo).toEqual('SomeDefault');
        });

        test("should use default value of mode's option argument if it is not specified by user and store that value in options property", () => {
            const config = { myMode: { options: { foo: { parse: (v) => 'VALUE:' + v, default: 'SomeOtherDefault' } } } };
            const cargs = new CliArgs(config);
            expect(cargs['options']?.myMode?.foo).toBeUndefined();
            cargs.parse(['myMode']);
            expect(cargs['options'].myMode.foo).toEqual('SomeOtherDefault');
        });

        test('should call parse functions before calling validate functions', async () => {
            // Ensuring that parse functions are called before validate functions,
            // we can access parsed values from within validate functions.
            const parse = jest.fn(() => 'Foo');
            const validate = jest.fn(() => {
                expect(parse).toHaveBeenCalledTimes(3);
                expect(parse.mock.calls[0]).toEqual(['pOS']);
                expect(parse.mock.calls[1]).toEqual(['fOO']);
                expect(parse.mock.calls[2]).toEqual(['zOO']);
                return undefined;
            });
            const cargs = new CliArgs({
                myMode: {
                    positionals: {
                        0: {
                            name: 'something',
                            parse,
                            validate,
                        },
                    },
                    options: {
                        foo: {
                            parse,
                            validate,
                        },
                        zoo: { parse },
                    },
                },
            });
            cargs.parse(['myMode', 'pOS', '--foo', 'fOO', '--zoo', 'zOO']);
            expect(validate).toHaveBeenCalledTimes(2);
        });

        test('should set default values before calling validate functions', async () => {
            const parse = jest.fn(() => 'Foo');
            const validate = jest.fn(() => {
                expect(cargs.getOption('myMode', 'zoo')).toEqual('some-default');
                return undefined;
            });
            const cargs = new CliArgs({
                myMode: {
                    options: {
                        foo: {
                            parse,
                            validate,
                        },
                        zoo: { parse, default: 'some-default' },
                    },
                },
            });
            cargs.parse(['myMode', '--foo', 'fOO']);
            expect(validate).toHaveBeenCalledTimes(1);
        });
    });

    describe('getOption', () => {
        test('should throw NotInModeAvailableError if passed mode does not equal detected mode', () => {
            const config = { myMode: { options: {} }, myOtherMode: { options: { foo: { parse: (v) => v } } } };
            const cargs = new CliArgs(config);
            cargs.parse(['myMode']);
            try {
                cargs.getOption('myOtherMode', 'foo');
                throw new Error('Expected getOption() to throw error');
            } catch (e) {
                expect(e).toBeInstanceOf(NotInModeAvailableError);
                expect(e.message).toEqual(`Trying to access option foo which is not available in current mode!`);
            }
        });

        test('should return requested option from options member', () => {
            const config = { myMode: { options: { foo: { parse: (v) => 'VALUE:' + v } } } };
            const cargs = new CliArgs(config);
            cargs.parse(['myMode']);
            const opt = cargs.getOption('myMode', 'foo');
            expect(opt).toBe(cargs['options'].myMode.foo);
        });
    });

    describe('getPosition', () => {
        test('should throw NotInModeAvailableError if passed mode does not equal detected mode', () => {
            const config = {
                myMode: { options: {} },
                myOtherMode: { positionals: { 0: { name: 'foo', parse: (v) => 'POS:' + v } }, options: {} },
            };
            const cargs = new CliArgs(config);
            cargs.parse(['myMode']);
            try {
                cargs.getPosition('myOtherMode', 0);
                throw new Error('Expected getPosition() to throw error');
            } catch (e) {
                expect(e).toBeInstanceOf(NotInModeAvailableError);
                expect(e.message).toEqual(`Trying to access positional argument 0 which is not available in current mode!`);
            }
        });

        test('should return requested position from positionals member', () => {
            const config = { myMode: { positionals: { 0: { name: 'foo', parse: (v) => 'POS:' + v } }, options: {} } };
            const cargs = new CliArgs(config);
            cargs.parse(['myMode', 'foo']);
            const opt = cargs.getPosition('myMode', 0);
            expect(opt).toBe(cargs['positionals'].myMode[0]);
        });
    });

    describe('mode', () => {
        test('should be set to the detected mode if call to parse succeeded', () => {
            const config = { myMode: { options: {} }, myOtherMode: { options: {} } };
            const cargs = new CliArgs(config);
            expect(cargs.mode).toBeUndefined();
            cargs.parse(['myOtherMode']);
            expect(cargs.mode).toEqual('myOtherMode');
        });

        test('should be undefined if call to parse threw UnknownModeError', () => {
            const config = { myMode: { options: {} } };
            const cargs = new CliArgs(config);
            expect(cargs.mode).toBeUndefined();
            expect(() => {
                cargs.parse(['myOtherMode']);
            }).toThrow(UnknownModeError);
            expect(cargs.mode).toBeUndefined();
        });
    });
});
