import { Game } from "./game.ts";
import { GridNode, GRID_SIZE } from "./grid.ts";
import { Point, PointRotator } from "./point.ts";
import { Polygon } from "./polygon.ts";

type Polygons = {
  [index: string]: Polygon;
};

export class Sprite {
  protected readonly vel = new Point();
  rotDot: number = 0;
  protected readonly acc = new Point();
  readonly loc = new Point();
  protected rot = 0;
  protected scale = 1;
  protected lineWidth = 1;

  protected readonly collidesWith: Set<string> = new Set<string>();

  visible = false;
  reap = false;

  protected currentNode: GridNode | null = null;
  protected transPolygons: Polygon[] | null = null;

  constructor(
    public readonly name: string,
    protected readonly game: Game,
    readonly polygons: Polygons,
  ) {}

  protected preMove(_: number) {}
  protected postMove() {
    this.loc.assign(this.loc.mod(this.game.display.canvasSize));
  }

  protected copyState(other: Sprite) {
    this.visible = other.visible;
    this.reap = other.reap;
    this.loc.assign(other.loc);
    this.rot = other.rot;
    this.scale = other.scale;
    this.currentNode = other.currentNode;
    this.transPolygons = other.transPolygons;
  }

  run(delta: number) {
    this.move(delta);
    this.updateGrid();

    this.game.display.save();
    this.draw();

    if (this.visible && this.currentNode) {
      const cn = this.currentNode;
      [
        ...cn.sprites,
        ...cn.north!.sprites,
        ...cn.south!.sprites,
        ...cn.east!.sprites,
        ...cn.west!.sprites,
        ...cn.north!.east!.sprites,
        ...cn.north!.west!.sprites,
        ...cn.south!.east!.sprites,
        ...cn.south!.west!.sprites,
      ].forEach((candidate) => this.checkCollision(candidate));
    }

    this.game.display.restore();
  }
  protected move(delta: number) {
    if (!this.visible) return;
    this.transPolygons = null; // clear cached transposed polygons

    this.preMove(delta);

    this.vel.assign(this.vel.add(this.acc.mul(delta)));
    this.loc.assign(this.loc.add(this.vel.mul(delta)));
    this.rot += this.rotDot * delta;
    if (this.rot > 360) {
      this.rot -= 360;
    } else if (this.rot < 0) {
      this.rot += 360;
    }

    this.postMove();
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
  draw() {
    if (!this.visible || !this.currentNode) return;

    this.game.display.lineWidth = this.lineWidth;

    this.currentNode!.wraps.forEach((wrapOffset) =>
      this.drawWithOffset(wrapOffset),
    );
  }
  drawWithOffset(offset: Point) {
    this.transformedPolygons().forEach((polygon) =>
      polygon.translate(offset).draw(this.game.display),
    );
  }
  private checkCollision(other: Sprite) {
    if (!other.visible || this == other || !this.collidesWith.has(other.name))
      return;

    // Find a colliding point:
    const p = other
      .transformedPolygons()
      .find((otherPolygon) =>
        this.transformedPolygons().find((ownPolygon) =>
          ownPolygon.collides(otherPolygon, this.game.intersector),
        ),
      );
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
  protected transformedPolygons(): Polygon[] {
    if (this.transPolygons) return this.transPolygons;

    const rotator = new PointRotator(this.rot);
    // cache transformed points
    this.transPolygons = Object.entries(this.polygons)
      .filter(([_, polygon]) => polygon.visible)
      .map(([_, polygon]) => polygon.transform(rotator, this.scale, this.loc));

    return this.transPolygons!;
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
}

class BaseShip extends Sprite {
  readonly bullets: Bullet[] = [];
  protected bulletCounter = 0;
  protected readonly collidesWith = new Set<string>([
    "asteroid",
    "bigalien",
    "alienbullet",
  ]);

  constructor(game: Game, extraPolygons: Polygons) {
    super("ship", game, {
      ship: new Polygon([new Point(-5, 4), new Point(0, -12), new Point(5, 4)]),
      ...extraPolygons,
    });
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
    super(game, {
      exhaust: new Polygon([
        new Point(-3, 6),
        new Point(0, 11),
        new Point(3, 6),
      ]),
    });

    for (let i = 0; i < 10; i++) {
      this.bullets.push(new Bullet("bullet", game));
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
      this.polygons.exhaust.visible = this.game.random() > 0.1;
    } else {
      this.acc.assign(new Point());
      this.polygons.exhaust.visible = false;
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
    super(game, {});
    this.scale = 0.6;
    this.visible = true;
  }

  stamp(point: Point) {
    this.game.display.save();
    this.loc.assign(point);
    this.transPolygons = null;
    this.drawWithOffset(new Point());
    this.game.display.restore();
  }
}

export class BigAlien extends Sprite {
  protected readonly collidesWith = new Set<string>([
    "asteroid",
    "ship",
    "bullet",
  ]);
  readonly bullets: Bullet[] = [];
  protected bulletCounter = 0;

  constructor(game: Game) {
    super("bigalien", game, {
      body: new Polygon([
        new Point(-20, 0),
        new Point(-12, -4),
        new Point(12, -4),
        new Point(20, 0),
        new Point(12, 4),
        new Point(-12, 4),
        new Point(-20, 0),
        new Point(20, 0),
      ]),
      top: new Polygon([
        new Point(-8, -4),
        new Point(-6, -6),
        new Point(6, -6),
        new Point(8, -4),
      ]),
      bottom: new Polygon([
        new Point(8, 4),
        new Point(6, 6),
        new Point(-6, 6),
        new Point(-8, 4),
      ]),
    });
  }

  protected newPosition() {
    if (this.game.random() < 0.5) {
      this.loc.x = -20;
      this.vel.x = 1.5;
    } else {
      this.loc.x = this.game.display.canvasSize.x + 20;
      this.vel.x = -1.5;
    }
    this.loc.y = this.game.random() * this.game.display.canvasSize.y;
  }

  init() {
    this.newPosition();

    for (let i = 0; i < 3; i++) {
      this.bullets.push(new Bullet("alienbullet", this.game));
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
    } else if (this.game.random() < 0.01) {
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
        new PointRotator(360 * this.game.random()).apply(new Point(6, 0)),
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
    if (
      (this.vel.x > 0 && this.loc.x > this.game.display.canvasSize.x + 20) ||
      (this.vel.x < 0 && this.loc.x < -20)
    ) {
      // why did the alien cross the road?
      this.visible = false;
      this.newPosition();
    } else {
      super.postMove();
    }
  }
}

class Bullet extends Sprite {
  private time = 0;
  // asteroid can look for bullets so doesn't have
  // to be other way around
  // protected readonly collidesWith = new Set<string>("asteroid");

  constructor(name: string, game: Game) {
    super(name, game, {
      left: new Polygon([new Point(-1, -1), new Point(1, 1)]),
      right: new Polygon([new Point(1, -1), new Point(-1, 1)]),
    });

    this.lineWidth = 2;
  }

  shoot(loc: Point, vel: Point) {
    this.loc.assign(loc);
    this.vel.assign(vel);
    this.visible = true;
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
}

export class Asteroid extends Sprite {
  visible = true;
  protected scale = 6;

  protected readonly collidesWith = new Set<string>([
    "ship",
    "bullet",
    "bigalien",
    "alienbullet",
  ]);

  constructor(game: Game) {
    super("asteroid", game, {
      body: new Polygon([
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
      ]),
    });
  }

  init() {
    let isClear = false;
    while (!isClear) {
      this.loc.assign(
        new Point(
          this.game.random() * this.game.display.canvasSize.x,
          this.game.random() * this.game.display.canvasSize.y,
        ),
      );
      isClear = this.isClear();
    }
    this.vel.assign(
      new Point(this.game.random() * 4 - 2, this.game.random() * 4 - 2),
    );
    if (this.game.random() > 0.5) {
      this.transpose();
    }
    this.rotDot = this.game.random() * 2 - 1;
  }

  protected copy(): Asteroid {
    const roid = new Asteroid(this.game);
    roid.copyState(this);
    return roid;
  }

  private transpose() {
    Object.entries(this.polygons).forEach(([_, polygon]) =>
      polygon.points.forEach((p) => p.transpose()),
    );
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
          new Point(this.game.random() * 6 - 3, this.game.random() * 6 - 3),
        );
        if (this.game.random() > 0.5) {
          this.transpose();
        }
        roid.rotDot = this.game.random() * 2 - 1;
        roid.move(roid.scale * 3); // give them a little push
        this.game.sprites.push(roid);
      }
    }
    this.game.explosionAt(other.loc);
    this.die();
  }
}

export class Explosion extends Sprite {
  private static makePolygons(game: Game) {
    const polygons: Polygons = {};
    for (let i = 0; i < 5; i++) {
      const vec = new PointRotator(360 * game.random()).apply(new Point(1, 0));
      polygons["" + i] = new Polygon([vec, vec.mul(2)]);
    }
    return polygons;
  }

  constructor(game: Game, point: Point) {
    super("explosion", game, Explosion.makePolygons(game));
    this.loc.assign(point);
    this.visible = true;
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
