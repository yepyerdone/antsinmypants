export class ScoreManager {
  private score: number = 0;
  private highScore: number = 0;
  private round: number = 1;
  private birdsHit: number = 0;
  private totalBirds: number = 10;
  private shots: number = 3;
  private birdsMissed: number = 0;
  private totalShotsTaken: number = 0;
  private totalHitsInGame: number = 0;

  constructor() {
    const saved = localStorage.getItem('good_boy_highscore') ?? localStorage.getItem('sky_hunter_highscore');
    if (saved) {
      this.highScore = parseInt(saved, 10);
    }
  }

  getScore() { return this.score; }
  getHighScore() { return this.highScore; }
  getRound() { return this.round; }
  getBirdsHit() { return this.birdsHit; }
  getBirdsMissed() { return this.birdsMissed; }
  getShots() { return this.shots; }

  addPoints(points: number) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('good_boy_highscore', this.highScore.toString());
    }
  }

  recordHit() {
    this.birdsHit++;
    this.totalHitsInGame++;
    this.addPoints(100 * this.round);
  }

  recordMiss() {
    this.birdsMissed++;
  }

  useShot() {
    if (this.shots > 0) {
      this.shots--;
      this.totalShotsTaken++;
    }
  }

  resetShots() {
    this.shots = 3;
  }

  nextRound() {
    this.round++;
    this.birdsHit = 0;
    this.birdsMissed = 0;
    this.resetShots();
  }

  resetGame() {
    this.score = 0;
    this.round = 1;
    this.birdsHit = 0;
    this.birdsMissed = 0;
    this.totalShotsTaken = 0;
    this.totalHitsInGame = 0;
    this.resetShots();
  }

  getShotAccuracy() {
    if (this.totalShotsTaken === 0) return 0;
    return Math.round((this.totalHitsInGame / this.totalShotsTaken) * 100);
  }

  getAccuracy() {
    const total = this.birdsHit + this.birdsMissed;
    if (total === 0) return 0;
    return Math.round((this.birdsHit / total) * 100);
  }

  getMinHitsRequired() {
    // 6 birds for first 3 rounds, then increase
    if (this.round <= 3) return 6;
    return Math.min(10, 6 + Math.floor((this.round - 1) / 2));
  }
}
