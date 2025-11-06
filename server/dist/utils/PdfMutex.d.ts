export declare class AsyncMutex {
    private locked;
    private waiters;
    acquire(): Promise<() => void>;
    get waitingCount(): number;
}
export declare const pdfMutex: AsyncMutex;
//# sourceMappingURL=PdfMutex.d.ts.map