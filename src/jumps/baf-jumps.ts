import { Jumps } from './jumps';

/**
 * Back-and-forth
 * TODO: not optimal because data written to disk-cache may consist of 2 large blocks which can be written sequentially
 */
export class BafJumps implements Jumps {
    readonly name = 'BAF';

    getJump(chunks: number, i: number): number {
        if (i >= chunks || i < 0) {
            return undefined;
        }
        return i % 2 === 0 ? Math.floor(i / 2) : Math.ceil(chunks / 2) + Math.floor(i / 2);
    }
}
