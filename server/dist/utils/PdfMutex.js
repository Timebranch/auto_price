"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfMutex = exports.AsyncMutex = void 0;
class AsyncMutex {
    constructor() {
        this.locked = false;
        this.waiters = [];
    }
    async acquire() {
        return new Promise((resolve) => {
            const release = () => {
                const next = this.waiters.shift();
                if (next) {
                    next(release);
                }
                else {
                    this.locked = false;
                }
            };
            if (!this.locked) {
                this.locked = true;
                resolve(release);
            }
            else {
                this.waiters.push(resolve);
            }
        });
    }
    get waitingCount() {
        return this.waiters.length;
    }
}
exports.AsyncMutex = AsyncMutex;
// 单例：用于PDF生成的全局互斥锁
exports.pdfMutex = new AsyncMutex();
//# sourceMappingURL=PdfMutex.js.map