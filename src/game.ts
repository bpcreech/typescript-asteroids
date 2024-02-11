// Canvas Asteroids
//
// Copyright (c) 2010 Doug McInnes
//

import { Display } from "./display.ts";
import { GridNode, Grid, GRID_SIZE } from "./grid.ts";
import { Keyboard, KeyboardHandler } from "./keyboard.ts";
import { Point, PointRotator } from "./point.ts";
import { vector_battle } from "./vector_battle_regular.typeface.js";

const face = vector_battle;

type Children = {
  [index: string]: Sprite;
};

export class Sprite {
  readonly vel = new Point();
  rotDot: number = 0;
  readonly acc = new Point();
  loc = new Point();
  rot = 0;
  scale = 1;

  readonly children: Children = {};
  readonly collidesWith: string[] = [];

  visible = false;
  reap = false;
  bridgesH = true;
  bridgesV = true;

  currentNode: GridNode | null = null;
  nextSprite: Sprite | null = null;
  transPoints: Array<Point> | null = null;

  constructor(
    public readonly name: string,
    protected readonly game: Game,
    public readonly points?: Point[],
  ) {}

  preMove(_: number) {}
  postMove(_: number) {}

  copyState(other: Sprite) {
    this.visible = other.visible;
    this.reap = other.reap;
    this.bridgesH = other.bridgesH;
    this.bridgesV = other.bridgesV;
    this.loc.assign(other.loc);
    this.rot = other.rot;
    this.scale = other.scale;
    this.currentNode = other.currentNode;
    this.nextSprite = other.nextSprite;
    this.transPoints = other.transPoints;
  }

  run(delta: number) {
    this.move(delta);
    this.updateGrid();

    this.game.display.context.save();
    this.configureTransform();
    this.draw();

    const candidates = this.findCollisioncandidates();

    this.checkCollisionsAgainst(candidates);

    this.game.display.context.restore();

    if (this.bridgesH && this.currentNode && this.currentNode.dupe.horizontal) {
      this.loc.x += this.currentNode.dupe.horizontal;
      this.game.display.context.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.context.restore();
      if (this.currentNode) {
        this.loc.x -= this.currentNode.dupe.horizontal;
      }
    }
    if (this.bridgesV && this.currentNode && this.currentNode.dupe.vertical) {
      this.loc.y += this.currentNode.dupe.vertical;
      this.game.display.context.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.context.restore();
      if (this.currentNode) {
        this.loc.y -= this.currentNode.dupe.vertical;
      }
    }
    if (
      this.bridgesH &&
      this.bridgesV &&
      this.currentNode &&
      this.currentNode.dupe.vertical &&
      this.currentNode.dupe.horizontal
    ) {
      this.loc.x += this.currentNode.dupe.horizontal;
      this.loc.y += this.currentNode.dupe.vertical;
      this.game.display.context.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.context.restore();
      if (this.currentNode) {
        this.loc.x -= this.currentNode.dupe.horizontal;
        this.loc.y -= this.currentNode.dupe.vertical;
      }
    }
  }
  move(delta: number) {
    if (!this.visible) return;
    this.transPoints = null; // clear cached points

    this.preMove(delta);

    this.vel.assign(this.vel.add(this.acc.mul(delta)));
    this.loc.assign(this.loc.add(this.vel.mul(delta)));
    this.rot += this.rotDot * delta;
    if (this.rot > 360) {
      this.rot -= 360;
    } else if (this.rot < 0) {
      this.rot += 360;
    }

    this.postMove(delta);
  }
  updateGrid() {
    if (!this.visible) {
      return;
    }

    const newNode = this.game.grid.findNode(this.loc);
    if (newNode != this.currentNode) {
      if (this.currentNode) {
        this.currentNode.leave(this);
      }
      newNode.enter(this);
      this.currentNode = newNode;
    }

    if (this.game.keyboard.keyStatus.g) {
      this.game.display.context.lineWidth = 3.0;
      this.game.display.context.strokeStyle = "green";
      this.game.display.context.strokeRect(
        this.currentNode.x * GRID_SIZE + 2,
        this.currentNode.y * GRID_SIZE + 2,
        GRID_SIZE - 4,
        GRID_SIZE - 4,
      );
      this.game.display.context.strokeStyle = "black";
      this.game.display.context.lineWidth = 1.0;
    }
  }
  configureTransform() {
    if (!this.visible) return;

    const rad = (this.rot * Math.PI) / 180;

    this.game.display.context.translate(this.loc.x, this.loc.y);
    this.game.display.context.rotate(rad);
    this.game.display.context.scale(this.scale, this.scale);
  }
  draw() {
    if (!this.visible) return;

    this.game.display.context.lineWidth = 1.0 / this.scale;

    Object.entries(this.children).forEach(([_, sprite]) => sprite.draw());

    this.game.display.context.beginPath();

    this.game.display.context.moveTo(this.points![0].x, this.points![0].y);
    this.points!.slice(1).forEach((p) =>
      this.game.display.context.lineTo(p.x, p.y),
    );

    this.game.display.context.closePath();
    this.game.display.context.stroke();
  }
  findCollisioncandidates() {
    if (!this.visible || !this.currentNode) return [];
    const cn = this.currentNode;
    const candidates: Sprite[] = [];
    function pushIfExists(sprite: Sprite | null) {
      if (sprite) {
        candidates.push(sprite);
      }
    }
    pushIfExists(cn.nextSprite);
    pushIfExists(cn.north!.nextSprite);
    pushIfExists(cn.south!.nextSprite);
    pushIfExists(cn.east!.nextSprite);
    pushIfExists(cn.west!.nextSprite);
    pushIfExists(cn.north!.east!.nextSprite);
    pushIfExists(cn.north!.west!.nextSprite);
    pushIfExists(cn.south!.east!.nextSprite);
    pushIfExists(cn.south!.west!.nextSprite);
    return candidates;
  }
  checkCollisionsAgainst(candidates: Sprite[]) {
    candidates.forEach((candidate) => {
      let ref: Sprite | null = candidate;
      do {
        this.checkCollision(ref);
        ref = ref.nextSprite;
      } while (ref);
    });
  }
  checkCollision(other: Sprite) {
    if (
      !other.visible ||
      this == other ||
      this.collidesWith.indexOf(other.name) == -1
    )
      return;

    // Find a colliding point:
    const p = other
      .transformedPoints()
      .find((p) => this.game.display.context.isPointInPath(p.x, p.y));
    if (p !== undefined) {
      other.collision(this);
      this.collision(other);
    }
  }
  collision(_: Sprite) {}
  die() {
    this.visible = false;
    this.reap = true;
    if (this.currentNode) {
      this.currentNode.leave(this);
      this.currentNode = null;
    }
  }
  transformedPoints() {
    if (this.transPoints) return this.transPoints;
    const rotator = new PointRotator(this.rot);
    // cache translated points
    this.transPoints = this.points!.map((p) =>
      rotator.apply(p).mul(this.scale).add(this.loc),
    );

    return this.transPoints;
  }
  isClear() {
    if (this.collidesWith.length == 0) return true;
    let cn = this.currentNode;
    if (cn == null) {
      cn = this.game.grid.findNode(this.loc);
    }
    const cw = this.collidesWith;
    function doesNotCollide(node: GridNode) {
      return node.isEmpty(cw);
    }
    return (
      doesNotCollide(cn) &&
      doesNotCollide(cn.north!) &&
      doesNotCollide(cn.south!) &&
      doesNotCollide(cn.east!) &&
      doesNotCollide(cn.west!) &&
      doesNotCollide(cn.north!.east!) &&
      doesNotCollide(cn.north!.west!) &&
      doesNotCollide(cn.south!.east!) &&
      doesNotCollide(cn.south!.west!)
    );
  }
  wrapPostMove() {
    if (this.loc.x > this.game.display.canvasSize.x) {
      this.loc.x = 0;
    } else if (this.loc.x < 0) {
      this.loc.x = this.game.display.canvasSize.x;
    }
    if (this.loc.y > this.game.display.canvasSize.y) {
      this.loc.y = 0;
    } else if (this.loc.y < 0) {
      this.loc.y = this.game.display.canvasSize.y;
    }
  }
}

class BaseShip extends Sprite {
  readonly bullets: Bullet[] = [];
  bulletCounter = 0;
  readonly collidesWith = ["asteroid", "bigalien", "alienbullet"];

  constructor(game: Game) {
    super("ship", game, [new Point(-5, 4), new Point(0, -12), new Point(5, 4)]);
  }

  postMove() {
    this.wrapPostMove();
  }

  collision(other: Sprite) {
    this.game.sfx.explosion();
    this.game.explosionAt(other.loc);
    this.game.fsm.state = this.game.fsm.player_died;
    this.visible = false;
    this.currentNode!.leave(this);
    this.currentNode = null;
    this.game.lives--;
  }
}

class Ship extends BaseShip {
  constructor(game: Game) {
    super(game);
    this.children.exhaust = new Sprite("exhaust", game, [
      new Point(-3, 6),
      new Point(0, 11),
      new Point(3, 6),
    ]);
  }

  preMove(delta: number) {
    if (this.game.keyboard.keyStatus.left) {
      this.rotDot = -6;
    } else if (this.game.keyboard.keyStatus.right) {
      this.rotDot = 6;
    } else {
      this.rotDot = 0;
    }

    if (this.game.keyboard.keyStatus.up) {
      this.acc.assign(new PointRotator(this.rot).apply(new Point(0, -1)));
      this.children.exhaust.visible = Math.random() > 0.1;
    } else {
      this.acc.assign(new Point());
      this.children.exhaust.visible = false;
    }

    if (this.bulletCounter > 0) {
      this.bulletCounter -= delta;
    }
    if (this.game.keyboard.keyStatus.space) {
      if (this.bulletCounter <= 0) {
        // Find the first unused bullet:
        const bullet = this.bullets.find((bullet) => !bullet.visible);

        if (bullet === undefined) {
          // No bullets to shoot:
          return;
        }

        this.bulletCounter = 10;

        this.game.sfx.laser();
        // move to the nose of the ship
        const vector = new PointRotator(this.rot).apply(new Point(0, -4));
        bullet.loc.assign(this.loc.add(vector));
        bullet.vel.assign(this.vel.add(vector.mul(1.5)));
        bullet.visible = true;
      }
    }

    // limit the ship's speed
    if (this.vel.norm2() > 64) {
      this.vel.assign(this.vel.mul(0.95));
    }
  }
}

class ExtraShip extends BaseShip {
  constructor(game: Game) {
    super(game);
    this.scale = 0.6;
    this.visible = true;
  }
}

class BigAlien extends Sprite {
  readonly collidesWith = ["asteroid", "ship", "bullet"];
  bridgesH = false;
  readonly bullets: Bullet[] = [];
  bulletCounter = 0;

  constructor(game: Game) {
    super("bigalien", game, [
      new Point(-20, 0),
      new Point(-12, -4),
      new Point(12, -4),
      new Point(20, 0),
      new Point(12, 4),
      new Point(-12, 4),
      new Point(-20, 0),
      new Point(20, 0),
    ]);

    this.children.top = new Sprite("bigalien_top", game, [
      new Point(-8, -4),
      new Point(-6, -6),
      new Point(6, -6),
      new Point(8, -4),
    ]);
    this.children.top.visible = true;

    this.children.bottom = new Sprite("bigalien_top", game, [
      new Point(8, 4),
      new Point(6, 6),
      new Point(-6, 6),
      new Point(-8, 4),
    ]);
    this.children.bottom.visible = true;
  }

  newPosition() {
    if (Math.random() < 0.5) {
      this.loc.x = -20;
      this.vel.x = 1.5;
    } else {
      this.loc.x = this.game.display.canvasSize.x + 20;
      this.vel.x = -1.5;
    }
    this.loc.y = Math.random() * this.game.display.canvasSize.y;
  }

  setup() {
    this.newPosition();

    for (let i = 0; i < 3; i++) {
      this.bullets.push(new AlienBullet(this.game));
    }
  }

  preMove(delta: number) {
    const cn = this.currentNode;
    if (cn == null) return;

    function oneIfNextSprite(node: GridNode) {
      return node.nextSprite ? 1 : 0;
    }

    const topCount =
      oneIfNextSprite(cn.north!) +
      oneIfNextSprite(cn.north!.east!) +
      oneIfNextSprite(cn.north!.west!);

    const bottomCount =
      oneIfNextSprite(cn.south!) +
      oneIfNextSprite(cn.south!.east!) +
      oneIfNextSprite(cn.south!.west!);

    if (topCount > bottomCount) {
      this.vel.y = 1;
    } else if (topCount < bottomCount) {
      this.vel.y = -1;
    } else if (Math.random() < 0.01) {
      this.vel.y = -this.vel.y;
    }

    this.bulletCounter -= delta;
    if (this.bulletCounter <= 0) {
      // Find the first unused bullet:
      const bullet = this.bullets.find((bullet) => !bullet.visible);
      if (bullet === undefined) {
        // No bullets to shoot
        return;
      }

      this.bulletCounter = 22;

      bullet.loc.assign(this.loc);
      bullet.vel.assign(
        new PointRotator(360 * Math.random()).apply(new Point(6, 0)),
      );
      bullet.visible = true;
      this.game.sfx.laser();
    }
  }

  collision(other: Sprite) {
    if (other.name == "bullet") this.game.score += 200;
    this.game.sfx.explosion();
    this.game.explosionAt(other.loc);
    this.visible = false;
    this.newPosition();
  }

  postMove() {
    if (this.loc.y > this.game.display.canvasSize.y) {
      this.loc.y = 0;
    } else if (this.loc.y < 0) {
      this.loc.y = this.game.display.canvasSize.y;
    }

    if (
      (this.vel.x > 0 && this.loc.x > this.game.display.canvasSize.x + 20) ||
      (this.vel.x < 0 && this.loc.x < -20)
    ) {
      // why did the alien cross the road?
      this.visible = false;
      this.newPosition();
    }
  }
}

class BaseBullet extends Sprite {
  time = 0;
  bridgesH = false;
  bridgesV = false;
  postMove = this.wrapPostMove;
  // asteroid can look for bullets so doesn't have
  // to be other way around
  //this.collidesWith = ["asteroid"];

  constructor(name: string, game: Game, points?: Point[]) {
    super(name, game, points);
  }

  configureTransform() {}
  draw() {
    if (!this.visible) {
      return;
    }

    this.game.display.context.save();
    this.game.display.context.lineWidth = 2;
    this.game.display.context.beginPath();
    this.game.display.context.moveTo(this.loc.x - 1, this.loc.y - 1);
    this.game.display.context.lineTo(this.loc.x + 1, this.loc.y + 1);
    this.game.display.context.moveTo(this.loc.x + 1, this.loc.y - 1);
    this.game.display.context.lineTo(this.loc.x - 1, this.loc.y + 1);
    this.game.display.context.stroke();
    this.game.display.context.restore();
  }
  preMove(delta: number) {
    if (this.visible) {
      this.time += delta;
    }
    if (this.time > 50) {
      this.visible = false;
      this.time = 0;
    }
  }
  collision(_: Sprite) {
    this.time = 0;
    this.visible = false;
    this.currentNode!.leave(this);
    this.currentNode = null;
  }
  transformedPoints() {
    return [this.loc];
  }
}

class Bullet extends BaseBullet {
  constructor(game: Game) {
    super("bullet", game, [new Point(0, 0)]);
  }
}

class AlienBullet extends BaseBullet {
  constructor(game: Game) {
    super("alienbullet", game);
  }

  draw() {
    if (!this.visible) {
      return;
    }

    this.game.display.context.save();
    this.game.display.context.lineWidth = 2;
    this.game.display.context.beginPath();
    this.game.display.context.moveTo(this.loc.x, this.loc.y);
    this.game.display.context.lineTo(
      this.loc.x - this.vel.x,
      this.loc.y - this.vel.y,
    );
    this.game.display.context.stroke();
    this.game.display.context.restore();
  }
}

class Asteroid extends Sprite {
  visible = true;
  scale = 6;
  postMove = this.wrapPostMove;

  readonly collidesWith = ["ship", "bullet", "bigalien", "alienbullet"];

  constructor(game: Game) {
    super("asteroid", game, [
      new Point(-10, 0),
      new Point(-5, 7),
      new Point(-3, 4),
      new Point(1, 10),
      new Point(5, 4),
      new Point(10, 0),
      new Point(5, -6),
      new Point(2, -10),
      new Point(-4, -10),
      new Point(-4, -5),
    ]);
  }

  copy(): Asteroid {
    const roid = new Asteroid(this.game);
    roid.copyState(this);
    return roid;
  }

  collision(other: Sprite) {
    this.game.sfx.explosion();
    if (other.name == "bullet") this.game.score += 120 / this.scale;
    this.scale /= 3;
    if (this.scale > 0.5) {
      // break into fragments
      for (let i = 0; i < 3; i++) {
        const roid = this.copy();
        roid.vel.assign(
          new Point(Math.random() * 6 - 3, Math.random() * 6 - 3),
        );
        if (Math.random() > 0.5) {
          roid.points!.forEach((p) => p.transpose());
        }
        roid.rotDot = Math.random() * 2 - 1;
        roid.move(roid.scale * 3); // give them a little push
        this.game.sprites.push(roid);
      }
    }
    this.game.explosionAt(other.loc);
    this.die();
  }
}

class Explosion extends Sprite {
  bridgesH = false;
  bridgesV = false;
  lines: Point[][] = [];

  constructor(game: Game) {
    super("explosion", game);

    for (let i = 0; i < 5; i++) {
      const vec = new PointRotator(360 * Math.random()).apply(new Point(1, 0));
      this.lines.push([vec, vec.mul(2)]);
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

    this.game.display.context.save();
    this.game.display.context.lineWidth = 1.0 / this.scale;
    this.game.display.context.beginPath();
    for (let i = 0; i < 5; i++) {
      const line = this.lines[i];
      this.game.display.context.moveTo(line[0].x, line[0].y);
      this.game.display.context.lineTo(line[1].x, line[1].y);
    }
    this.game.display.context.stroke();
    this.game.display.context.restore();
  }

  preMove(delta: number) {
    if (this.visible) {
      this.scale += delta;
    }
    if (this.scale > 8) {
      this.die();
    }
  }
}

// borrowed from typeface-0.14.js
// http://typeface.neocracy.org
class GameText {
  constructor(private readonly display: Display) {}

  renderGlyph(char: string) {
    const glyph = (face.glyphs as any)[char]; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (glyph.o) {
      let outline;
      if (glyph.cached_outline) {
        outline = glyph.cached_outline;
      } else {
        outline = glyph.o.split(" ");
        glyph.cached_outline = outline;
      }

      const outlineLength = outline.length;
      for (let i = 0; i < outlineLength; ) {
        const action = outline[i++];

        switch (action) {
          case "m":
            this.display.context.moveTo(outline[i++], outline[i++]);
            break;
          case "l":
            this.display.context.lineTo(outline[i++], outline[i++]);
            break;

          case "q":
            {
              const cpx = outline[i++];
              const cpy = outline[i++];
              this.display.context.quadraticCurveTo(
                outline[i++],
                outline[i++],
                cpx,
                cpy,
              );
            }
            break;

          case "b":
            {
              const x = outline[i++];
              const y = outline[i++];
              this.display.context.bezierCurveTo(
                outline[i++],
                outline[i++],
                outline[i++],
                outline[i++],
                x,
                y,
              );
            }
            break;
        }
      }
    }
    if (glyph.ha) {
      this.display.context.translate(glyph.ha, 0);
    }
  }

  renderText(text: string, size: number, loc: Point) {
    this.display.context.save();

    this.display.context.translate(loc.x, loc.y);

    const pixels = (size * 72) / (face!.resolution * 100);
    this.display.context.scale(pixels, -1 * pixels);
    this.display.context.beginPath();
    text.split("").forEach((char) => this.renderGlyph(char));
    this.display.context.fill();

    this.display.context.restore();
  }
}

class SFX {
  readonly laserWav: HTMLAudioElement;
  readonly explosionWav: HTMLAudioElement;

  constructor(private readonly keyboard: Keyboard) {
    this.laserWav = SFX.load("39459__THE_bizniss__laser.wav");
    this.explosionWav = SFX.load("51467__smcameron__missile_explosion.wav");
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
