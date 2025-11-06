export class AsyncMutex {
  private locked = false
  private waiters: Array<(release: () => void) => void> = []

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        const next = this.waiters.shift()
        if (next) {
          next(release)
        } else {
          this.locked = false
        }
      }

      if (!this.locked) {
        this.locked = true
        resolve(release)
      } else {
        this.waiters.push(resolve)
      }
    })
  }

  get waitingCount(): number {
    return this.waiters.length
  }
}

// 单例：用于PDF生成的全局互斥锁
export const pdfMutex = new AsyncMutex()