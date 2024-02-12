export interface Random {
  /** Return a random number between 0 and 1. */
  random(): number;
}

export class RandomImpl implements Random {
  random() {
    return Math.random();
  }
}
