// Canvas Asteroids
//
// Copyright (c) 2010 Doug McInnes
// Copyright (c) 2024 Ben Creech
//

import { Display } from "./display.ts";
import { GameText } from "./gametext.ts";
import { Grid, GRID_SIZE } from "./grid.ts";
import { Keyboard, KeyboardHandler } from "./keyboard.ts";
import { Point } from "./point.ts";
import { SFX } from "./sfx.ts";
import {
  Asteroid,
  BigAlien,
  Bullet,
  Explosion,
  ExtraShip,
  Ship,
  Sprite,
} from "./sprites.ts";

export class Game {
  readonly grid: Grid;
  readonly extraDude: ExtraShip;
  readonly keyboard: Keyboard;
  readonly sfx: SFX;
  readonly display: Display;
  readonly text: GameText;

  avgFramerate = 0;
  frameCount = 0;
  elapsedCounter = 0;
  lastFrame: number = Date.now();

  score = 0;
  totalAsteroids = 5;
  lives = 0;

  readonly sprites: Sprite[] = [];
  readonly ship: Ship;
  readonly bigAlien: BigAlien;

  nextBigAlienTime: number | null = null;
  readonly fsm: FSM;

  constructor() {
    this.keyboard = new Keyboard(new KeyboardHandlerImpl(this));
    this.sfx = new SFX(this.keyboard);

    const canvas: HTMLCanvasElement = document.getElementById(
      "canvas",
    )! as HTMLCanvasElement;

    this.display = new Display(
      new Point(canvas.width, canvas.height),
      canvas.getContext("2d")!,
    );

    this.grid = new Grid(this.display.canvasSize);

    this.text = new GameText(this.display);
    this.fsm = new FSM(this.text, this.keyboard, this.display, this);
    this.ship = new Ship(this);

    this.ship.loc.assign(this.display.canvasSize.mul(0.5));

    this.sprites.push(this.ship);

    for (let i = 0; i < 10; i++) {
      const bull = new Bullet(this);
      this.ship.bullets.push(bull);
      this.sprites.push(bull);
    }

    this.bigAlien = new BigAlien(this);
    this.bigAlien.setup();
    this.bigAlien.bullets.forEach((bull) => this.sprites.push(bull));
    this.sprites.push(this.bigAlien);

    this.extraDude = new ExtraShip(this);
  }

  spawnAsteroids(count?: number) {
    if (!count) count = this.totalAsteroids;
    for (let i = 0; i < count; i++) {
      const roid = new Asteroid(this);
      let isClear = false;
      while (!isClear) {
        roid.loc.assign(
          new Point(
            Math.random() * this.display.canvasSize.x,
            Math.random() * this.display.canvasSize.y,
          ),
        );
        isClear = roid.isClear();
      }
      roid.vel.assign(new Point(Math.random() * 4 - 2, Math.random() * 4 - 2));
      if (Math.random() > 0.5) {
        roid.points!.forEach((p) => p.transpose());
      }
      roid.rotDot = Math.random() * 2 - 1;
      this.sprites.push(roid);
    }
  }

  explosionAt(point: Point) {
    const splosion = new Explosion(this);
    splosion.loc.assign(point);
    splosion.visible = true;
    this.sprites.push(splosion);
  }

  unpause() {
    // start up again
    this.lastFrame = Date.now();
    this.mainLoop();
  }

  start() {
    this.lastFrame = Date.now();

    this.mainLoop();
  }

  private mainLoop() {
    this.display.context.clearRect(
      0,
      0,
      this.display.canvasSize.x,
      this.display.canvasSize.y,
    );

    this.fsm.execute();

    if (this.keyboard.keyStatus.g) {
      this.display.context.beginPath();
      for (let i = 0; i < this.grid.gridWidth; i++) {
        this.display.context.moveTo(i * GRID_SIZE, 0);
        this.display.context.lineTo(i * GRID_SIZE, this.display.canvasSize.y);
      }
      for (let j = 0; j < this.grid.gridHeight; j++) {
        this.display.context.moveTo(0, j * GRID_SIZE);
        this.display.context.lineTo(this.display.canvasSize.x, j * GRID_SIZE);
      }
      this.display.context.closePath();
      this.display.context.stroke();
    }

    const thisFrame = Date.now();
    const elapsed = thisFrame - this.lastFrame;
    this.lastFrame = thisFrame;
    const delta = elapsed / 30;

    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].run(delta);

      if (this.sprites[i].reap) {
        this.sprites[i].reap = false;
        this.sprites.splice(i, 1);
        i--;
      }
    }

    // score
    const score_text = "" + this.score;
    this.text.renderText(
      score_text,
      18,
      new Point(this.display.canvasSize.x - 14 * score_text.length, 20),
    );

    // extra dudes
    for (let i = 0; i < this.lives; i++) {
      this.display.context.save();
      this.extraDude.loc.assign(
        new Point(this.display.canvasSize.x - 8 * (i + 1), 32),
      );
      this.extraDude.configureTransform();
      this.extraDude.draw();
      this.display.context.restore();
    }

    if (this.keyboard.showFramerate) {
      this.text.renderText(
        "" + this.avgFramerate,
        24,
        this.display.canvasSize.add(new Point(-38, -2)),
      );
    }

    this.frameCount++;
    this.elapsedCounter += elapsed;
    if (this.elapsedCounter > 1000) {
      this.elapsedCounter -= 1000;
      this.avgFramerate = this.frameCount;
      this.frameCount = 0;
    }

    if (this.keyboard.paused) {
      this.text.renderText(
        "PAUSED",
        72,
        new Point(this.display.canvasSize.x / 2 - 160, 120),
      );
    } else {
      requestAnimationFrame(() => this.mainLoop());
    }
  }
}

class FSM {
  state: () => void = this.boot;
  timer: number | null = null;

  constructor(
    private readonly text: GameText,
    private readonly keyboard: Keyboard,
    private readonly display: Display,
    private readonly game: Game,
  ) {}

  boot() {
    this.game.spawnAsteroids(5);
    this.state = this.waiting;
  }
  waiting() {
    this.text.renderText(
      "Press Space to Start",
      36,
      this.display.canvasSize.mul(0.5).add(new Point(-270, 0)),
    );
    if (this.keyboard.keyStatus.space) {
      this.keyboard.keyStatus.space = false; // hack so we don't shoot right away
      this.state = this.start;
    }
  }
  start() {
    this.game.sprites.forEach((sprite) => {
      if (sprite.name == "asteroid") {
        sprite.die();
      } else if (sprite.name == "bullet" || sprite.name == "bigalien") {
        sprite.visible = false;
      }
    });

    this.game.score = 0;
    this.game.lives = 2;
    this.game.totalAsteroids = 2;
    this.game.spawnAsteroids();

    this.game.nextBigAlienTime = Date.now() + 30000 + 30000 * Math.random();

    this.state = this.spawn_ship;
  }
  spawn_ship() {
    this.game.ship.loc = this.display.canvasSize.mul(0.5);
    if (this.game.ship!.isClear()) {
      this.game.ship.rot = 0;
      this.game.ship.vel.assign(new Point());
      this.game.ship.visible = true;
      this.state = this.run;
    }
  }
  run() {
    const firstAsteroid = this.game.sprites.find(
      (sprite) => sprite.name == "asteroid",
    );
    if (!firstAsteroid) {
      this.state = this.new_level;
    }
    if (
      !this.game.bigAlien.visible &&
      Date.now() > this.game.nextBigAlienTime!
    ) {
      this.game.bigAlien.visible = true;
      this.game.nextBigAlienTime = Date.now() + 30000 * Math.random();
    }
  }
  new_level() {
    if (this.timer == null) {
      this.timer = Date.now();
    }
    // wait a second before spawning more asteroids
    if (Date.now() - this.timer > 1000) {
      this.timer = null;
      this.game.totalAsteroids++;
      if (this.game.totalAsteroids > 12) this.game.totalAsteroids = 12;
      this.game.spawnAsteroids();
      this.state = this.run;
    }
  }
  player_died() {
    if (this.game.lives < 0) {
      this.state = this.end_game;
    } else {
      if (this.timer == null) {
        this.timer = Date.now();
      }
      // wait a second before spawning
      if (Date.now() - this.timer > 1000) {
        this.timer = null;
        this.state = this.spawn_ship;
      }
    }
  }
  end_game() {
    this.text.renderText(
      "GAME OVER",
      50,
      this.display.canvasSize.mul(0.5).add(new Point(-160, 10)),
    );
    if (this.timer == null) {
      this.timer = Date.now();
    }
    // wait 5 seconds then go back to waiting state
    if (Date.now() - this.timer > 5000) {
      this.timer = null;
      this.state = this.waiting;
    }
  }

  execute() {
    this.state();
  }
}

class KeyboardHandlerImpl implements KeyboardHandler {
  constructor(private readonly game: Game) {}

  onUnpause() {
    this.game.unpause();
  }
}
