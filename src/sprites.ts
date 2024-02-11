import { Game } from "./game.ts";
import { GridNode, GRID_SIZE } from "./grid.ts";
import { Point, PointRotator } from "./point.ts";

type Children = {
  [index: string]: Sprite;
};

export class Sprite {
  protected readonly vel = new Point();
  rotDot: number = 0;
  protected readonly acc = new Point();
  readonly loc = new Point();
  protected rot = 0;
  protected scale = 1;

  protected readonly children: Children = {};
  protected readonly collidesWith: Set<string> = new Set<string>();

  visible = false;
  reap = false;
  protected bridgesH = true;
  protected bridgesV = true;

  protected currentNode: GridNode | null = null;
  protected transPoints: Array<Point> | null = null;

  constructor(
    public readonly name: string,
    protected readonly game: Game,
    public readonly points?: Point[],
  ) {}

  protected preMove(_: number) {}
  protected postMove(_: number) {}

  protected copyState(other: Sprite) {
    this.visible = other.visible;
    this.reap = other.reap;
    this.bridgesH = other.bridgesH;
    this.bridgesV = other.bridgesV;
    this.loc.assign(other.loc);
    this.rot = other.rot;
    this.scale = other.scale;
    this.currentNode = other.currentNode;
    this.transPoints = other.transPoints;
  }

  run(delta: number) {
    this.move(delta);
    this.updateGrid();

    this.game.display.save();
    this.configureTransform();
    this.draw();

    const candidates = this.findCollisionCandidates();

    this.checkCollisionsAgainst(candidates);

    this.game.display.restore();

    if (this.bridgesH && this.currentNode && this.currentNode.dupe.horizontal) {
      this.loc.x += this.currentNode.dupe.horizontal;
      this.game.display.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.restore();
      if (this.currentNode) {
        this.loc.x -= this.currentNode.dupe.horizontal;
      }
    }
    if (this.bridgesV && this.currentNode && this.currentNode.dupe.vertical) {
      this.loc.y += this.currentNode.dupe.vertical;
      this.game.display.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.restore();
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
      this.game.display.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      this.game.display.restore();
      if (this.currentNode) {
        this.loc.x -= this.currentNode.dupe.horizontal;
        this.loc.y -= this.currentNode.dupe.vertical;
      }
    }
  }
  protected move(delta: number) {
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
  private updateGrid() {
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
      this.game.display.lineWidth = 3.0;
      this.game.display.strokeStyle = "green";
      this.game.display.strokeRect(
        new Point(this.currentNode.x, this.currentNode.y)
          .mul(GRID_SIZE)
          .add(new Point(2, 2)),
        new Point(GRID_SIZE - 4, GRID_SIZE - 4),
      );
      this.game.display.strokeStyle = "black";
      this.game.display.lineWidth = 1.0;
    }
  }
  configureTransform() {
    if (!this.visible) return;

    const rad = (this.rot * Math.PI) / 180;

    this.game.display.translate(this.loc);
    this.game.display.rotate(rad);
    this.game.display.scale(new Point(this.scale, this.scale));
  }
  draw() {
    if (!this.visible) return;

    this.game.display.lineWidth = 1.0 / this.scale;

    Object.entries(this.children).forEach(([_, sprite]) => sprite.draw());

    this.game.display.beginPath();

    this.game.display.moveTo(this.points![0]);
    this.points!.slice(1).forEach((p) => this.game.display.lineTo(p));

    this.game.display.closePath();
    this.game.display.stroke();
  }
  private findCollisionCandidates() {
    if (!this.visible || !this.currentNode) return new Set<Sprite>();
    const cn = this.currentNode;
    return new Set<Sprite>([
      ...cn.sprites,
      ...cn.north!.sprites,
      ...cn.south!.sprites,
      ...cn.east!.sprites,
      ...cn.west!.sprites,
      ...cn.north!.east!.sprites,
      ...cn.north!.west!.sprites,
      ...cn.south!.east!.sprites,
      ...cn.south!.west!.sprites,
    ]);
  }
  private checkCollisionsAgainst(candidates: Set<Sprite>) {
    candidates.forEach((candidate) => this.checkCollision(candidate));
  }
  private checkCollision(other: Sprite) {
    if (!other.visible || this == other || !this.collidesWith.has(other.name))
      return;

    // Find a colliding point:
    const p = other
      .transformedPoints()
      .find((p) => this.game.display.isPointInPath(p));
    if (p !== undefined) {
      other.collision(this);
      this.collision(other);
    }
  }
  protected collision(_: Sprite) {}
  die() {
    this.visible = false;
    this.reap = true;
    if (this.currentNode) {
      this.currentNode.leave(this);
      this.currentNode = null;
    }
  }
  protected transformedPoints() {
    if (this.transPoints) return this.transPoints;
    const rotator = new PointRotator(this.rot);
    // cache translated points
    this.transPoints = this.points!.map((p) =>
      rotator.apply(p).mul(this.scale).add(this.loc),
    );

    return this.transPoints;
  }
  isClear() {
    if (this.collidesWith.size == 0) return true;
    let cn = this.currentNode;
    if (cn == null) {
      cn = this.game.grid.findNode(this.loc);
    }
    return (
      cn.isEmpty(this.collidesWith) &&
      cn.north!.isEmpty(this.collidesWith) &&
      cn.south!.isEmpty(this.collidesWith) &&
      cn.east!.isEmpty(this.collidesWith) &&
      cn.west!.isEmpty(this.collidesWith) &&
      cn.north!.east!.isEmpty(this.collidesWith) &&
      cn.north!.west!.isEmpty(this.collidesWith) &&
      cn.south!.east!.isEmpty(this.collidesWith) &&
      cn.south!.west!.isEmpty(this.collidesWith)
    );
  }
  protected wrapPostMove() {
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
  protected bulletCounter = 0;
  protected readonly collidesWith = new Set<string>([
    "asteroid",
    "bigalien",
    "alienbullet",
  ]);

  constructor(game: Game) {
    super("ship", game, [new Point(-5, 4), new Point(0, -12), new Point(5, 4)]);
  }

  protected postMove() {
    this.wrapPostMove();
  }

  protected collision(other: Sprite) {
    this.game.sfx.explosion();
    this.game.explosionAt(other.loc);
    this.game.fsm.state = this.game.fsm.player_died;
    this.visible = false;
    this.currentNode!.leave(this);
    this.currentNode = null;
    this.game.lives--;
  }
}

export class Ship extends BaseShip {
  constructor(game: Game) {
    super(game);
    this.children.exhaust = new Sprite("exhaust", game, [
      new Point(-3, 6),
      new Point(0, 11),
      new Point(3, 6),
    ]);

    for (let i = 0; i < 10; i++) {
      this.bullets.push(new Bullet(game));
    }
  }

  init() {
    this.loc.assign(this.game.display.canvasSize.mul(0.5));
    this.rot = 0;
    this.vel.assign(new Point());
  }

  protected preMove(delta: number) {
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

        // Shoot from the nose of the ship:
        const vector = new PointRotator(this.rot).apply(new Point(0, -4));
        bullet.shoot(this.loc.add(vector), this.vel.add(vector.mul(1.5)));
      }
    }

    // limit the ship's speed
    if (this.vel.norm2() > 64) {
      this.vel.assign(this.vel.mul(0.95));
    }
  }
}

export class ExtraShip extends BaseShip {
  constructor(game: Game) {
    super(game);
    this.scale = 0.6;
    this.visible = true;
  }

  stamp(point: Point) {
    this.game.display.save();
    this.loc.assign(point);
    this.configureTransform();
    this.draw();
    this.game.display.restore();
  }
}

export class BigAlien extends Sprite {
  protected readonly collidesWith = new Set<string>([
    "asteroid",
    "ship",
    "bullet",
  ]);
  protected bridgesH = false;
  readonly bullets: Bullet[] = [];
  protected bulletCounter = 0;

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

  protected newPosition() {
    if (Math.random() < 0.5) {
      this.loc.x = -20;
      this.vel.x = 1.5;
    } else {
      this.loc.x = this.game.display.canvasSize.x + 20;
      this.vel.x = -1.5;
    }
    this.loc.y = Math.random() * this.game.display.canvasSize.y;
  }

  init() {
    this.newPosition();

    for (let i = 0; i < 3; i++) {
      this.bullets.push(new AlienBullet(this.game));
    }
  }

  protected preMove(delta: number) {
    const cn = this.currentNode;
    if (cn == null) return;

    const topCount =
      Math.min(cn.north!.sprites.size, 1) +
      Math.min(cn.north!.east!.sprites.size, 1) +
      Math.min(cn.north!.west!.sprites.size, 1);

    const bottomCount =
      Math.min(cn.south!.sprites.size, 1) +
      Math.min(cn.south!.east!.sprites.size, 1) +
      Math.min(cn.south!.west!.sprites.size, 1);

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

      bullet.shoot(
        this.loc,
        new PointRotator(360 * Math.random()).apply(new Point(6, 0)),
      );
      this.game.sfx.laser();
    }
  }

  protected collision(other: Sprite) {
    if (other.name == "bullet") this.game.score += 200;
    this.game.sfx.explosion();
    this.game.explosionAt(other.loc);
    this.visible = false;
    this.newPosition();
  }

  protected postMove() {
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
  private time = 0;
  protected bridgesH = false;
  protected bridgesV = false;
  protected postMove = this.wrapPostMove;
  // asteroid can look for bullets so doesn't have
  // to be other way around
  //this.collidesWith = new Set<string>("asteroid");

  constructor(name: string, game: Game, points?: Point[]) {
    super(name, game, points);
  }

  shoot(loc: Point, vel: Point) {
    this.loc.assign(loc);
    this.vel.assign(vel);
    this.visible = true;
  }

  configureTransform() {}
  draw() {
    if (!this.visible) {
      return;
    }

    this.game.display.save();
    this.game.display.lineWidth = 2;
    this.game.display.beginPath();
    this.game.display.moveTo(this.loc.add(new Point(-1, -1)));
    this.game.display.lineTo(this.loc.add(new Point(1, 1)));
    this.game.display.moveTo(this.loc.add(new Point(1, -1)));
    this.game.display.lineTo(this.loc.add(new Point(-1, 1)));
    this.game.display.stroke();
    this.game.display.restore();
  }
  protected preMove(delta: number) {
    if (this.visible) {
      this.time += delta;
    }
    if (this.time > 50) {
      this.visible = false;
      this.time = 0;
    }
  }
  protected collision(_: Sprite) {
    this.time = 0;
    this.visible = false;
    this.currentNode!.leave(this);
    this.currentNode = null;
  }
  protected transformedPoints() {
    return [this.loc];
  }
}

export class Bullet extends BaseBullet {
  constructor(game: Game) {
    super("bullet", game, [new Point(0, 0)]);
  }
}

export class AlienBullet extends BaseBullet {
  constructor(game: Game) {
    super("alienbullet", game);
  }

  draw() {
    if (!this.visible) {
      return;
    }

    this.game.display.save();
    this.game.display.lineWidth = 2;
    this.game.display.beginPath();
    this.game.display.moveTo(this.loc);
    this.game.display.lineTo(this.loc.sub(this.vel));
    this.game.display.stroke();
    this.game.display.restore();
  }
}

export class Asteroid extends Sprite {
  visible = true;
  protected scale = 6;
  protected postMove = this.wrapPostMove;

  protected readonly collidesWith = new Set<string>([
    "ship",
    "bullet",
    "bigalien",
    "alienbullet",
  ]);

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

  init() {
    let isClear = false;
    while (!isClear) {
      this.loc.assign(
        new Point(
          Math.random() * this.game.display.canvasSize.x,
          Math.random() * this.game.display.canvasSize.y,
        ),
      );
      isClear = this.isClear();
    }
    this.vel.assign(new Point(Math.random() * 4 - 2, Math.random() * 4 - 2));
    if (Math.random() > 0.5) {
      this.points!.forEach((p) => p.transpose());
    }
    this.rotDot = Math.random() * 2 - 1;
  }

  protected copy(): Asteroid {
    const roid = new Asteroid(this.game);
    roid.copyState(this);
    return roid;
  }

  protected collision(other: Sprite) {
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

export class Explosion extends Sprite {
  protected bridgesH = false;
  protected bridgesV = false;
  private lines: Point[][] = [];

  constructor(game: Game, point: Point) {
    super("explosion", game);
    this.loc.assign(point);
    this.visible = true;

    for (let i = 0; i < 5; i++) {
      const vec = new PointRotator(360 * Math.random()).apply(new Point(1, 0));
      this.lines.push([vec, vec.mul(2)]);
    }
  }

  draw() {
    if (!this.visible) {
      return;
    }

    this.game.display.save();
    this.game.display.lineWidth = 1.0 / this.scale;
    this.game.display.beginPath();
    for (let i = 0; i < 5; i++) {
      const line = this.lines[i];
      this.game.display.moveTo(line[0]);
      this.game.display.lineTo(line[1]);
    }
    this.game.display.stroke();
    this.game.display.restore();
  }

  protected preMove(delta: number) {
    if (this.visible) {
      this.scale += delta;
    }
    if (this.scale > 8) {
      this.die();
    }
  }
}
