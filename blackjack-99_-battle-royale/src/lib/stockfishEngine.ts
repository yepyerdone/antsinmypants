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
  label: string;
};

const STOCKFISH_WORKER_PATH = '/stockfish/stockfish.worker.js';
const STOCKFISH_TIMEOUT_MS = 5000;

export class StockfishEngine {
  private worker: Worker | null = null;
  private waiters: PendingWaiter[] = [];
  private initialized = false;
  private searchId = 0;

  async initialize() {
    if (this.initialized && this.worker) return;

    this.worker = new Worker(new URL(STOCKFISH_WORKER_PATH, window.location.origin));
    console.log('[Stockfish] worker created', STOCKFISH_WORKER_PATH);
    this.worker.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(String(event.data));
    };
    this.worker.onerror = (event) => {
      console.error('[Stockfish] worker error', event);
      this.rejectAll(new Error(event.message || 'Stockfish worker failed.'));
    };

    this.send('uci');
    await this.waitFor((line) => line === 'uciok', 'uciok');
    this.send('isready');
    await this.waitFor((line) => line === 'readyok', 'readyok');
    this.initialized = true;
  }

  send(command: string) {
    if (!this.worker) {
      throw new Error('Stockfish is not initialized.');
    }
    console.log('[Stockfish] >>', command);
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
    await this.waitFor((line) => line === 'readyok', 'readyok after reset');
  }

  async getBestMove(fen: string, options: StockfishSearchOptions): Promise<string> {
    await this.initialize();
    await this.reset();
    const currentSearch = ++this.searchId;

    this.send('setoption name Skill Level value ' + options.skill);
    this.send('setoption name UCI_LimitStrength value true');
    this.send('setoption name UCI_Elo value ' + options.elo);
    this.send('isready');
    await this.waitFor((line) => line === 'readyok', 'readyok after options');

    console.log('[Stockfish] FEN', fen);
    this.send('position fen ' + fen);
    const goCommand = options.movetime > 0 ? `go movetime ${options.movetime}` : `go depth ${options.depth}`;
    this.send(goCommand);

    const bestMoveLine = await this.waitFor((line) => line.startsWith('bestmove '), 'bestmove');
    if (currentSearch !== this.searchId) {
      throw new Error('Stockfish search was superseded.');
    }

    const bestMove = bestMoveLine.split(/\s+/)[1];
    if (!bestMove || bestMove === '(none)') {
      throw new Error('Stockfish did not return a legal move.');
    }
    console.log('[Stockfish] bestmove', bestMove);
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

  private waitFor(matcher: (line: string) => boolean, label: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const waiter: PendingWaiter = {
        matcher,
        resolve,
        reject,
        label,
        timeoutId: window.setTimeout(() => {
          this.waiters = this.waiters.filter((item) => item !== waiter);
          const error = new Error(`Timed out waiting for Stockfish ${label}.`);
          console.error('[Stockfish]', error.message);
          reject(error);
        }, STOCKFISH_TIMEOUT_MS),
      };
      this.waiters.push(waiter);
    });
  }

  private handleMessage(line: string) {
    console.log('[Stockfish] <<', line);
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
