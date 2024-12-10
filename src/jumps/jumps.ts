export interface Jumps {
    readonly name: string;
    getJump: (chunks: number, i: number) => number;
}
