export type StockfishSearchOptions = {
  depth: number;
  movetime: number;
  skill: number;
  elo: number;
};

type PendingWaiter = {
  matcher: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

const STOCKFISH_WORKER_PATH = '/stockfish/stockfish.worker.js';

export class StockfishEngine {
  private worker: Worker | null = null;
  private waiters: PendingWaiter[] = [];
  private initialized = false;
  private searchId = 0;

  async initialize() {
    if (this.initialized && this.worker) return;

    this.worker = new Worker(new URL(STOCKFISH_WORKER_PATH, window.location.origin));
    this.worker.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(String(event.data));
    };
    this.worker.onerror = (event) => {
      this.rejectAll(new Error(event.message || 'Stockfish worker failed.'));
    };

    this.send('uci');
    await this.waitFor((line) => line === 'uciok', 10000);
    this.send('isready');
    await this.waitFor((line) => line === 'readyok', 10000);
    this.initialized = true;
  }

  send(command: string) {
    if (!this.worker) {
      throw new Error('Stockfish is not initialized.');
    }
    this.worker.postMessage(command);
  }

  async reset() {
    this.searchId += 1;
    if (!this.worker) {
      this.initialized = false;
      return;
    }
    this.send('stop');
    this.send('ucinewgame');
    this.send('isready');
    await this.waitFor((line) => line === 'readyok', 10000);
  }

  async getBestMove(fen: string, options: StockfishSearchOptions): Promise<string> {
    await this.initialize();
    await this.reset();
    const currentSearch = ++this.searchId;

    this.send('setoption name Skill Level value ' + options.skill);
    this.send('setoption name UCI_LimitStrength value true');
    this.send('setoption name UCI_Elo value ' + options.elo);
    this.send('isready');
    await this.waitFor((line) => line === 'readyok', 10000);

    this.send('position fen ' + fen);
    this.send(`go depth ${options.depth} movetime ${options.movetime}`);

    const bestMoveLine = await this.waitFor((line) => line.startsWith('bestmove '), options.movetime + 15000);
    if (currentSearch !== this.searchId) {
      throw new Error('Stockfish search was superseded.');
    }

    const bestMove = bestMoveLine.split(/\s+/)[1];
    if (!bestMove || bestMove === '(none)') {
      throw new Error('Stockfish did not return a legal move.');
    }
    return bestMove;
  }

  terminate() {
    this.searchId += 1;
    this.rejectAll(new Error('Stockfish engine terminated.'));
    if (this.worker) {
      try {
        this.worker.postMessage('quit');
      } catch {
        // Ignore shutdown races.
      }
      this.worker.terminate();
    }
    this.worker = null;
    this.initialized = false;
  }

  private waitFor(matcher: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const waiter: PendingWaiter = {
        matcher,
        resolve,
        reject,
        timeoutId: window.setTimeout(() => {
          this.waiters = this.waiters.filter((item) => item !== waiter);
          reject(new Error('Timed out waiting for Stockfish.'));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  private handleMessage(line: string) {
    const waiter = this.waiters.find((item) => item.matcher(line));
    if (!waiter) return;

    window.clearTimeout(waiter.timeoutId);
    this.waiters = this.waiters.filter((item) => item !== waiter);
    waiter.resolve(line);
  }

  private rejectAll(error: Error) {
    for (const waiter of this.waiters) {
      window.clearTimeout(waiter.timeoutId);
      waiter.reject(error);
    }
    this.waiters = [];
  }
}
