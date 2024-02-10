// Canvas Asteroids
//
// Copyright (c) 2010 Doug McInnes
//

import { vector_battle } from "./vector_battle_regular.typeface.js";
import { Keyboard, KeyboardHandler } from "./keyboard.ts";
import { Point, PointTransformer } from "./point.ts";
import { Display } from "./display.ts";

const face = vector_battle;

const GRID_SIZE = 60;

type Vector = {
  x: number;
  y: number;
  rot: number;
};

type Grid = Array<Array<GridNode>>;

type Children = {
  [index: string]: Sprite;
};

class Sprite {
  readonly vel: Vector = {
    x: 0,
    y: 0,
    rot: 0,
  };
  readonly acc: Vector = {
    x: 0,
    y: 0,
    rot: 0,
  };
  readonly children: Children = {};
  readonly collidesWith: string[] = [];

  visible = false;
  reap = false;
  bridgesH = true;
  bridgesV = true;

  x = 0;
  y = 0;
  rot = 0;
  scale = 1;
  currentNode: GridNode | null = null;
  nextSprite: Sprite | null = null;
  transPoints: Array<number> | null = null;

  constructor(
    public readonly name: string,
    protected readonly game: Game,
    public readonly points?: number[],
  ) {}

  preMove(_: number) {}
  postMove(_: number) {}

  copyState(other: Sprite) {
    this.visible = other.visible;
    this.reap = other.reap;
    this.bridgesH = other.bridgesH;
    this.bridgesV = other.bridgesV;
    this.x = other.x;
    this.y = other.y;
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
      this.x += this.currentNode.dupe.horizontal;
      this.game.display.context.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.context.restore();
      if (this.currentNode) {
        this.x -= this.currentNode.dupe.horizontal;
      }
    }
    if (this.bridgesV && this.currentNode && this.currentNode.dupe.vertical) {
      this.y += this.currentNode.dupe.vertical;
      this.game.display.context.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.context.restore();
      if (this.currentNode) {
        this.y -= this.currentNode.dupe.vertical;
      }
    }
    if (
      this.bridgesH &&
      this.bridgesV &&
      this.currentNode &&
      this.currentNode.dupe.vertical &&
      this.currentNode.dupe.horizontal
    ) {
      this.x += this.currentNode.dupe.horizontal;
      this.y += this.currentNode.dupe.vertical;
      this.game.display.context.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.context.restore();
      if (this.currentNode) {
        this.x -= this.currentNode.dupe.horizontal;
        this.y -= this.currentNode.dupe.vertical;
      }
    }
  }
  move(delta: number) {
    if (!this.visible) return;
    this.transPoints = null; // clear cached points

    this.preMove(delta);

    this.vel.x += this.acc.x * delta;
    this.vel.y += this.acc.y * delta;
    this.x += this.vel.x * delta;
    this.y += this.vel.y * delta;
    this.rot += this.vel.rot * delta;
    if (this.rot > 360) {
      this.rot -= 360;
    } else if (this.rot < 0) {
      this.rot += 360;
    }

    this.postMove(delta);
  }
  updateGrid() {
    if (!this.visible) return;
    let gridx = Math.floor(this.x / GRID_SIZE);
    let gridy = Math.floor(this.y / GRID_SIZE);
    gridx = gridx >= this.game.grid.length ? 0 : gridx;
    gridy = gridy >= this.game.grid[0].length ? 0 : gridy;
    gridx = gridx < 0 ? this.game.grid.length - 1 : gridx;
    gridy = gridy < 0 ? this.game.grid[0].length - 1 : gridy;
    const newNode = this.game.grid[gridx][gridy];
    if (newNode != this.currentNode) {
      if (this.currentNode) {
        this.currentNode.leave(this);
      }
      newNode.enter(this);
      this.currentNode = newNode;
    }

    if (this.game.keyboard.keyStatus.g && this.currentNode) {
      this.game.display.context.lineWidth = 3.0;
      this.game.display.context.strokeStyle = "green";
      this.game.display.context.strokeRect(
        gridx * GRID_SIZE + 2,
        gridy * GRID_SIZE + 2,
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

    this.game.display.context.translate(this.x, this.y);
    this.game.display.context.rotate(rad);
    this.game.display.context.scale(this.scale, this.scale);
  }
  draw() {
    if (!this.visible) return;

    this.game.display.context.lineWidth = 1.0 / this.scale;

    for (const child in this.children) {
      this.children[child].draw();
    }

    this.game.display.context.beginPath();

    this.game.display.context.moveTo(this.points![0], this.points![1]);
    for (let i = 1; i < this.points!.length / 2; i++) {
      const xi = i * 2;
      const yi = xi + 1;
      this.game.display.context.lineTo(this.points![xi], this.points![yi]);
    }

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
    for (let i = 0; i < candidates.length; i++) {
      let ref: Sprite | null = candidates[i];
      do {
        this.checkCollision(ref);
        ref = ref.nextSprite;
      } while (ref);
    }
  }
  checkCollision(other: Sprite) {
    if (
      !other.visible ||
      this == other ||
      this.collidesWith.indexOf(other.name) == -1
    )
      return;
    const trans = other.transformedPoints();
    let px, py;
    const count = trans.length / 2;
    for (let i = 0; i < count; i++) {
      px = trans[i * 2];
      py = trans[i * 2 + 1];
      if (this.game.display.context.isPointInPath(px, py)) {
        other.collision(this);
        this.collision(other);
        return;
      }
    }
  }
  pointInPolygon(x: number, y: number) {
    const points = this.transformedPoints();
    let j = 2;
    let y0, y1;
    let oddNodes = false;
    for (let i = 0; i < points.length; i += 2) {
      y0 = points[i + 1];
      y1 = points[j + 1];
      if ((y0 < y && y1 >= y) || (y1 < y && y0 >= y)) {
        if (points[i] + ((y - y0) / (y1 - y0)) * (points[j] - points[i]) < x) {
          oddNodes = !oddNodes;
        }
      }
      j += 2;
      if (j == points.length) j = 0;
    }
    return oddNodes;
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
    const trans = new Array(this.points!.length);
    const transformer = new PointTransformer(
      this.rot,
      this.scale,
      new Point(this.x, this.y),
    );
    for (let i = 0; i < this.points!.length / 2; i++) {
      const xi = i * 2;
      const yi = xi + 1;
      const pts = transformer.apply(
        new Point(this.points![xi], this.points![yi]),
      );
      trans[xi] = pts.x;
      trans[yi] = pts.y;
    }
    this.transPoints = trans; // cache translated points
    return trans;
  }
  isClear() {
    if (this.collidesWith.length == 0) return true;
    let cn = this.currentNode;
    if (cn == null) {
      let gridx = Math.floor(this.x / GRID_SIZE);
      let gridy = Math.floor(this.y / GRID_SIZE);
      gridx = gridx >= this.game.grid.length ? 0 : gridx;
      gridy = gridy >= this.game.grid[0].length ? 0 : gridy;
      cn = this.game.grid[gridx][gridy];
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
    if (this.x > this.game.display.canvasWidth) {
      this.x = 0;
    } else if (this.x < 0) {
      this.x = this.game.display.canvasWidth;
    }
    if (this.y > this.game.display.canvasHeight) {
      this.y = 0;
    } else if (this.y < 0) {
      this.y = this.game.display.canvasHeight;
    }
  }
}

class BaseShip extends Sprite {
  readonly bullets: Bullet[] = [];
  bulletCounter = 0;
  readonly collidesWith = ["asteroid", "bigalien", "alienbullet"];

  constructor(game: Game) {
    super("ship", game, [-5, 4, 0, -12, 5, 4]);
  }

  postMove() {
    this.wrapPostMove();
  }

  collision(other: Sprite) {
    this.game.sfx.explosion();
    this.game.explosionAt(other.x, other.y);
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
    this.children.exhaust = new Sprite("exhaust", game, [-3, 6, 0, 11, 3, 6]);
  }

  preMove(delta: number) {
    if (this.game.keyboard.keyStatus.left) {
      this.vel.rot = -6;
    } else if (this.game.keyboard.keyStatus.right) {
      this.vel.rot = 6;
    } else {
      this.vel.rot = 0;
    }

    if (this.game.keyboard.keyStatus.up) {
      const rad = ((this.rot - 90) * Math.PI) / 180;
      this.acc.x = 0.5 * Math.cos(rad);
      this.acc.y = 0.5 * Math.sin(rad);
      this.children.exhaust.visible = Math.random() > 0.1;
    } else {
      this.acc.x = 0;
      this.acc.y = 0;
      this.children.exhaust.visible = false;
    }

    if (this.bulletCounter > 0) {
      this.bulletCounter -= delta;
    }
    if (this.game.keyboard.keyStatus.space) {
      if (this.bulletCounter <= 0) {
        this.bulletCounter = 10;
        for (let i = 0; i < this.bullets.length; i++) {
          if (!this.bullets[i].visible) {
            this.game.sfx.laser();
            const bullet = this.bullets[i];
            const rad = ((this.rot - 90) * Math.PI) / 180;
            const vectorx = Math.cos(rad);
            const vectory = Math.sin(rad);
            // move to the nose of the ship
            bullet.x = this.x + vectorx * 4;
            bullet.y = this.y + vectory * 4;
            bullet.vel.x = 6 * vectorx + this.vel.x;
            bullet.vel.y = 6 * vectory + this.vel.y;
            bullet.visible = true;
            break;
          }
        }
      }
    }

    // limit the ship's speed
    if (Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y) > 8) {
      this.vel.x *= 0.95;
      this.vel.y *= 0.95;
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
    super(
      "bigalien",
      game,
      [-20, 0, -12, -4, 12, -4, 20, 0, 12, 4, -12, 4, -20, 0, 20, 0],
    );

    this.children.top = new Sprite(
      "bigalien_top",
      game,
      [-8, -4, -6, -6, 6, -6, 8, -4],
    );
    this.children.top.visible = true;

    this.children.bottom = new Sprite(
      "bigalien_top",
      game,
      [8, 4, 6, 6, -6, 6, -8, 4],
    );
    this.children.bottom.visible = true;
  }

  newPosition() {
    if (Math.random() < 0.5) {
      this.x = -20;
      this.vel.x = 1.5;
    } else {
      this.x = this.game.display.canvasWidth + 20;
      this.vel.x = -1.5;
    }
    this.y = Math.random() * this.game.display.canvasHeight;
  }

  setup() {
    this.newPosition();

    for (let i = 0; i < 3; i++) {
      const bull = new AlienBullet(this.game);
      this.bullets.push(bull);
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
      this.bulletCounter = 22;
      for (let i = 0; i < this.bullets.length; i++) {
        if (!this.bullets[i].visible) {
          const bullet = this.bullets[i];
          const rad = 2 * Math.PI * Math.random();
          const vectorx = Math.cos(rad);
          const vectory = Math.sin(rad);
          bullet.x = this.x;
          bullet.y = this.y;
          bullet.vel.x = 6 * vectorx;
          bullet.vel.y = 6 * vectory;
          bullet.visible = true;
          this.game.sfx.laser();
          break;
        }
      }
    }
  }

  collision(other: Sprite) {
    if (other.name == "bullet") this.game.score += 200;
    this.game.sfx.explosion();
    this.game.explosionAt(other.x, other.y);
    this.visible = false;
    this.newPosition();
  }

  postMove() {
    if (this.y > this.game.display.canvasHeight) {
      this.y = 0;
    } else if (this.y < 0) {
      this.y = this.game.display.canvasHeight;
    }

    if (
      (this.vel.x > 0 && this.x > this.game.display.canvasWidth + 20) ||
      (this.vel.x < 0 && this.x < -20)
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

  constructor(name: string, game: Game, points?: number[]) {
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
    this.game.display.context.moveTo(this.x - 1, this.y - 1);
    this.game.display.context.lineTo(this.x + 1, this.y + 1);
    this.game.display.context.moveTo(this.x + 1, this.y - 1);
    this.game.display.context.lineTo(this.x - 1, this.y + 1);
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
    return [this.x, this.y];
  }
}

class Bullet extends BaseBullet {
  constructor(game: Game) {
    super("bullet", game, [0, 0]);
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
    this.game.display.context.moveTo(this.x, this.y);
    this.game.display.context.lineTo(this.x - this.vel.x, this.y - this.vel.y);
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
    super(
      "asteroid",
      game,
      [
        -10, 0, -5, 7, -3, 4, 1, 10, 5, 4, 10, 0, 5, -6, 2, -10, -4, -10, -4,
        -5,
      ],
    );
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
        roid.vel.x = Math.random() * 6 - 3;
        roid.vel.y = Math.random() * 6 - 3;
        if (Math.random() > 0.5) {
          roid.points!.reverse();
        }
        roid.vel.rot = Math.random() * 2 - 1;
        roid.move(roid.scale * 3); // give them a little push
        this.game.sprites.push(roid);
      }
    }
    this.game.explosionAt(other.x, other.y);
    this.die();
  }
}

class Explosion extends Sprite {
  bridgesH = false;
  bridgesV = false;
  lines: number[][] = [];

  constructor(game: Game) {
    super("explosion", game);

    for (let i = 0; i < 5; i++) {
      const rad = 2 * Math.PI * Math.random();
      const x = Math.cos(rad);
      const y = Math.sin(rad);
      this.lines.push([x, y, x * 2, y * 2]);
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
      this.game.display.context.moveTo(line[0], line[1]);
      this.game.display.context.lineTo(line[2], line[3]);
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

class GridNode {
  north: GridNode | null = null;
  south: GridNode | null = null;
  east: GridNode | null = null;
  west: GridNode | null = null;

  nextSprite: Sprite | null = null;

  dupe = {
    horizontal: 0,
    vertical: 0,
  };

  enter(sprite: Sprite) {
    sprite.nextSprite = this.nextSprite;
    this.nextSprite = sprite;
  }

  leave(sprite: Sprite) {
    let ref: GridNode | Sprite = this; // eslint-disable-line @typescript-eslint/no-this-alias
    while (ref && ref.nextSprite != sprite) {
      ref = ref.nextSprite!;
    }
    if (ref) {
      ref.nextSprite = sprite.nextSprite;
      sprite.nextSprite = null;
    }
  }

  isEmpty(collidables: string[]) {
    let ref: GridNode | Sprite = this; // eslint-disable-line @typescript-eslint/no-this-alias
    while (ref.nextSprite) {
      ref = ref.nextSprite;
      if (ref.visible && collidables.indexOf(ref.name) != -1) {
        return false;
      }
    }
    return true;
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

  renderText(text: string, size: number, x: number, y: number) {
    this.display.context.save();

    this.display.context.translate(x, y);

    const pixels = (size * 72) / (face!.resolution * 100);
    this.display.context.scale(pixels, -1 * pixels);
    this.display.context.beginPath();
    const chars = text.split("");
    const charsLength = chars.length;
    for (let i = 0; i < charsLength; i++) {
      this.renderGlyph(chars[i]);
    }
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
  readonly gridWidth: number;
  readonly gridHeight: number;
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

    this.gridWidth = Math.round(canvas.width / GRID_SIZE);
    this.gridHeight = Math.round(canvas.height / GRID_SIZE);
    this.grid = new Array(this.gridWidth);

    this.display = new Display(
      canvas.width,
      canvas.height,
      canvas.getContext("2d")!,
    );

    this.text = new GameText(this.display);
    this.fsm = new FSM(this.text, this.keyboard, this.display, this);
    this.ship = new Ship(this);

    this.ship.x = this.display.canvasWidth / 2;
    this.ship.y = this.display.canvasHeight / 2;

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

    for (let i = 0; i < this.gridWidth; i++) {
      this.grid[i] = new Array(this.gridHeight);
      for (let j = 0; j < this.gridHeight; j++) {
        this.grid[i][j] = new GridNode();
      }
    }

    // set up the positional references
    for (let i = 0; i < this.gridWidth; i++) {
      for (let j = 0; j < this.gridHeight; j++) {
        const node = this.grid[i][j];
        node.north = this.grid[i][j == 0 ? this.gridHeight - 1 : j - 1];
        node.south = this.grid[i][j == this.gridHeight - 1 ? 0 : j + 1];
        node.west = this.grid[i == 0 ? this.gridWidth - 1 : i - 1][j];
        node.east = this.grid[i == this.gridWidth - 1 ? 0 : i + 1][j];
      }
    }

    // set up borders
    for (let i = 0; i < this.gridWidth; i++) {
      this.grid[i][0].dupe.vertical = this.display.canvasHeight;
      this.grid[i][this.gridHeight - 1].dupe.vertical =
        -this.display.canvasHeight;
    }

    for (let j = 0; j < this.gridHeight; j++) {
      this.grid[0][j].dupe.horizontal = this.display.canvasWidth;
      this.grid[this.gridWidth - 1][j].dupe.horizontal =
        -this.display.canvasWidth;
    }

    this.extraDude = new ExtraShip(this);
  }

  spawnAsteroids(count?: number) {
    if (!count) count = this.totalAsteroids;
    for (let i = 0; i < count; i++) {
      const roid = new Asteroid(this);
      roid.x = Math.random() * this.display.canvasWidth;
      roid.y = Math.random() * this.display.canvasHeight;
      while (!roid.isClear()) {
        roid.x = Math.random() * this.display.canvasWidth;
        roid.y = Math.random() * this.display.canvasHeight;
      }
      roid.vel.x = Math.random() * 4 - 2;
      roid.vel.y = Math.random() * 4 - 2;
      if (Math.random() > 0.5) {
        roid.points!.reverse();
      }
      roid.vel.rot = Math.random() * 2 - 1;
      this.sprites.push(roid);
    }
  }

  explosionAt(x: number, y: number) {
    const splosion = new Explosion(this);
    splosion.x = x;
    splosion.y = y;
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
      this.display.canvasWidth,
      this.display.canvasHeight,
    );

    this.fsm.execute();

    if (this.keyboard.keyStatus.g) {
      this.display.context.beginPath();
      for (let i = 0; i < this.gridWidth; i++) {
        this.display.context.moveTo(i * GRID_SIZE, 0);
        this.display.context.lineTo(i * GRID_SIZE, this.display.canvasHeight);
      }
      for (let j = 0; j < this.gridHeight; j++) {
        this.display.context.moveTo(0, j * GRID_SIZE);
        this.display.context.lineTo(this.display.canvasWidth, j * GRID_SIZE);
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
      this.display.canvasWidth - 14 * score_text.length,
      20,
    );

    // extra dudes
    for (let i = 0; i < this.lives; i++) {
      this.display.context.save();
      this.extraDude.x = this.display.canvasWidth - 8 * (i + 1);
      this.extraDude.y = 32;
      this.extraDude.configureTransform();
      this.extraDude.draw();
      this.display.context.restore();
    }

    if (this.keyboard.showFramerate) {
      this.text.renderText(
        "" + this.avgFramerate,
        24,
        this.display.canvasWidth - 38,
        this.display.canvasHeight - 2,
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
        this.display.canvasWidth / 2 - 160,
        120,
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
      this.display.canvasWidth / 2 - 270,
      this.display.canvasHeight / 2,
    );
    if (this.keyboard.keyStatus.space) {
      this.keyboard.keyStatus.space = false; // hack so we don't shoot right away
      this.state = this.start;
    }
  }
  start() {
    for (let i = 0; i < this.game.sprites.length; i++) {
      if (this.game.sprites[i].name == "asteroid") {
        this.game.sprites[i].die();
      } else if (
        this.game.sprites[i].name == "bullet" ||
        this.game.sprites[i].name == "bigalien"
      ) {
        this.game.sprites[i].visible = false;
      }
    }

    this.game.score = 0;
    this.game.lives = 2;
    this.game.totalAsteroids = 2;
    this.game.spawnAsteroids();

    this.game.nextBigAlienTime = Date.now() + 30000 + 30000 * Math.random();

    this.state = this.spawn_ship;
  }
  spawn_ship() {
    this.game.ship.x = this.display.canvasWidth / 2;
    this.game.ship.y = this.display.canvasHeight / 2;
    if (this.game.ship!.isClear()) {
      this.game.ship.rot = 0;
      this.game.ship.vel.x = 0;
      this.game.ship.vel.y = 0;
      this.game.ship.visible = true;
      this.state = this.run;
    }
  }
  run() {
    let i;
    for (i = 0; i < this.game.sprites.length; i++) {
      if (this.game.sprites[i].name == "asteroid") {
        break;
      }
    }
    if (i == this.game.sprites.length) {
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
      this.display.canvasWidth / 2 - 160,
      this.display.canvasHeight / 2 + 10,
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
