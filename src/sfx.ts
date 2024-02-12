import { Keyboard } from "./keyboard.ts";

export interface SFX {
  laser(): void

  explosion(): void;
}

export class SFXImpl implements SFX {
  private readonly laserWav: HTMLAudioElement;
  private readonly explosionWav: HTMLAudioElement;

  constructor(private readonly keyboard: Keyboard) {
    this.laserWav = SFXImpl.load("39459__THE_bizniss__laser.wav");
    this.explosionWav = SFXImpl.load("51467__smcameron__missile_explosion.wav");
  }

  private static load(fn: string): HTMLAudioElement {
    const audio = new Audio(fn);
    audio.load();
    return audio;
  }

  laser() {
    this.play(this.laserWav);
  }

  explosion() {
    this.play(this.explosionWav);
  }

  private play(audio: HTMLAudioElement) {
    if (this.keyboard.muted) {
      return;
    }

    audio.play();
  }
}
