export interface TestDataProvider {
    fillBuffer(buf: Buffer, count: number): void;
}
