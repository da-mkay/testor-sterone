export interface TestDataVerifier {
    verify(chunk: Buffer, bytes: number): void;
}
