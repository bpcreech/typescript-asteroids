// Canvas Asteroids
//
// Copyright (c) 2010 Doug McInnes
//

import { vector_battle } from "./vector_battle_regular.typeface.js";

const face = vector_battle;

type KeyCodes = {
  [index: number]: string;
};

const KEY_CODES: KeyCodes = {
  32: "space",
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  70: "f",
  71: "g",
  72: "h",
  77: "m",
  80: "p",
};

type KeyStatus = {
  [index: string]: boolean;
};

var KEY_STATUS: KeyStatus = { keyDown: false };
for (const code in KEY_CODES) {
  KEY_STATUS[KEY_CODES[code]] = false;
}

window.addEventListener("keydown", (e: KeyboardEvent) => {
  KEY_STATUS.keyDown = true;
  if (KEY_CODES[e.keyCode]) {
    e.preventDefault();
    KEY_STATUS[KEY_CODES[e.keyCode]] = true;
  }
});
window.addEventListener("keyup", (e: KeyboardEvent) => {
  KEY_STATUS.keyDown = false;
  if (KEY_CODES[e.keyCode]) {
    e.preventDefault();
    KEY_STATUS[KEY_CODES[e.keyCode]] = false;
  }
});

const GRID_SIZE = 60;

class Matrix {
  rows: number;
  columns: number;
  data: Array<Array<any>>;

  constructor(rows: number, columns: number) {
    this.rows = rows;
    this.columns = columns;
    this.data = new Array(rows);
    for (let i = 0; i < rows; i++) {
      this.data[i] = new Array(columns);
    }
  }

  configure(rot: number, scale: number, transx: number, transy: number) {
    var rad = (rot * Math.PI) / 180;
    var sin = Math.sin(rad) * scale;
    var cos = Math.cos(rad) * scale;
    this.set(cos, -sin, transx, sin, cos, transy);
  }

  set(...args: number[]) {
    var k = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        this.data[i][j] = args[k];
        k++;
      }
    }
  }

  multiply(...args: number[]) {
    var vector = new Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      vector[i] = 0;
      for (let j = 0; j < this.columns; j++) {
        vector[i] += this.data[i][j] * args[j];
      }
    }
    return vector;
  }
}

type Vector = {
  x: number;
  y: number;
  rot: number;
};

class Globals {
  context?: CanvasRenderingContext2D;
  matrix: Matrix = new Matrix(2, 3);
  grid?: Array<Array<GridNode>>;
  canvasWidth = 800;
  canvasHeight = 600;
}

var globals = new Globals();

type Children = {
  [index: string]: Sprite;
};

class Sprite {
  readonly name: string;
  readonly points?: number[];
  readonly vel: Vector;
  readonly acc: Vector;
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

  constructor(name: string, points?: number[]) {
    this.name = name;
    this.points = points;

    this.vel = {
      x: 0,
      y: 0,
      rot: 0,
    };

    this.acc = {
      x: 0,
      y: 0,
      rot: 0,
    };
  }

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

    globals.context!.save();
    this.configureTransform();
    this.draw();

    var candidates = this.findCollisioncandidates();

    globals.matrix.configure(this.rot, this.scale, this.x, this.y);
    this.checkCollisionsAgainst(candidates);

    globals.context!.restore();

    if (this.bridgesH && this.currentNode && this.currentNode.dupe.horizontal) {
      this.x += this.currentNode.dupe.horizontal;
      globals.context!.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      globals.context!.restore();
      if (this.currentNode) {
        this.x -= this.currentNode.dupe.horizontal;
      }
    }
    if (this.bridgesV && this.currentNode && this.currentNode.dupe.vertical) {
      this.y += this.currentNode.dupe.vertical;
      globals.context!.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      globals.context!.restore();
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
      globals.context!.save();
      this.configureTransform();
      this.draw();
      this.checkCollisionsAgainst(candidates);
      globals.context!.restore();
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
    var gridx = Math.floor(this.x / GRID_SIZE);
    var gridy = Math.floor(this.y / GRID_SIZE);
    gridx = gridx >= globals.grid!.length ? 0 : gridx;
    gridy = gridy >= globals.grid![0].length ? 0 : gridy;
    gridx = gridx < 0 ? globals.grid!.length - 1 : gridx;
    gridy = gridy < 0 ? globals.grid![0].length - 1 : gridy;
    var newNode = globals.grid![gridx][gridy];
    if (newNode != this.currentNode) {
      if (this.currentNode) {
        this.currentNode.leave(this);
      }
      newNode.enter(this);
      this.currentNode = newNode;
    }

    if (KEY_STATUS.g && this.currentNode) {
      globals.context!.lineWidth = 3.0;
      globals.context!.strokeStyle = "green";
      globals.context!.strokeRect(
        gridx * GRID_SIZE + 2,
        gridy * GRID_SIZE + 2,
        GRID_SIZE - 4,
        GRID_SIZE - 4,
      );
      globals.context!.strokeStyle = "black";
      globals.context!.lineWidth = 1.0;
    }
  }
  configureTransform() {
    if (!this.visible) return;

    var rad = (this.rot * Math.PI) / 180;

    globals.context!.translate(this.x, this.y);
    globals.context!.rotate(rad);
    globals.context!.scale(this.scale, this.scale);
  }
  draw() {
    if (!this.visible) return;

    globals.context!.lineWidth = 1.0 / this.scale;

    for (let child in this.children) {
      this.children[child].draw();
    }

    globals.context!.beginPath();

    globals.context!.moveTo(this.points![0], this.points![1]);
    for (let i = 1; i < this.points!.length / 2; i++) {
      var xi = i * 2;
      var yi = xi + 1;
      globals.context!.lineTo(this.points![xi], this.points![yi]);
    }

    globals.context!.closePath();
    globals.context!.stroke();
  }
  findCollisioncandidates() {
    if (!this.visible || !this.currentNode) return [];
    var cn = this.currentNode;
    var candidates: Sprite[] = [];
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
    var trans = other.transformedPoints();
    var px, py;
    var count = trans.length / 2;
    for (let i = 0; i < count; i++) {
      px = trans[i * 2];
      py = trans[i * 2 + 1];
      // mozilla doesn't take into account transforms with isPointInPath >:-P
      // if (($.browser.mozilla) ? this.pointInPolygon(px, py) : globals.context!.isPointInPath(px, py)) {
      if (globals.context!.isPointInPath(px, py)) {
        other.collision(this);
        this.collision(other);
        return;
      }
    }
  }
  pointInPolygon(x: number, y: number) {
    var points = this.transformedPoints();
    var j = 2;
    var y0, y1;
    var oddNodes = false;
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
    var trans = new Array(this.points!.length);
    globals.matrix.configure(this.rot, this.scale, this.x, this.y);
    for (let i = 0; i < this.points!.length / 2; i++) {
      var xi = i * 2;
      var yi = xi + 1;
      var pts = globals.matrix.multiply(this.points![xi], this.points![yi], 1);
      trans[xi] = pts[0];
      trans[yi] = pts[1];
    }
    this.transPoints = trans; // cache translated points
    return trans;
  }
  isClear() {
    if (this.collidesWith.length == 0) return true;
    var cn = this.currentNode;
    if (cn == null) {
      var gridx = Math.floor(this.x / GRID_SIZE);
      var gridy = Math.floor(this.y / GRID_SIZE);
      gridx = gridx >= globals.grid!.length ? 0 : gridx;
      gridy = gridy >= globals.grid![0].length ? 0 : gridy;
      cn = globals.grid![gridx][gridy];
    }
    let cw = this.collidesWith;
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
    if (this.x > globals.canvasWidth) {
      this.x = 0;
    } else if (this.x < 0) {
      this.x = globals.canvasWidth;
    }
    if (this.y > globals.canvasHeight) {
      this.y = 0;
    } else if (this.y < 0) {
      this.y = globals.canvasHeight;
    }
  }
}

class Ship extends Sprite {
  bullets: Bullet[] = [];
  bulletCounter = 0;
  collidesWith = ["asteroid", "bigalien", "alienbullet"];

  constructor() {
    super("ship", [-5, 4, 0, -12, 5, 4]);

    this.children.exhaust = new Sprite("exhaust", [-3, 6, 0, 11, 3, 6]);
  }

  postMove() {
    this.wrapPostMove();
  }

  preMove(delta: number) {
    if (KEY_STATUS.left) {
      this.vel.rot = -6;
    } else if (KEY_STATUS.right) {
      this.vel.rot = 6;
    } else {
      this.vel.rot = 0;
    }

    if (KEY_STATUS.up) {
      var rad = ((this.rot - 90) * Math.PI) / 180;
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
    if (KEY_STATUS.space) {
      if (this.bulletCounter <= 0) {
        this.bulletCounter = 10;
        for (let i = 0; i < this.bullets.length; i++) {
          if (!this.bullets[i].visible) {
            sfx.laser();
            var bullet = this.bullets[i];
            var rad = ((this.rot - 90) * Math.PI) / 180;
            var vectorx = Math.cos(rad);
            var vectory = Math.sin(rad);
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

  collision(other: Sprite) {
    sfx.explosion();
    game.explosionAt(other.x, other.y);
    game.fsm.state = game.fsm.player_died;
    this.visible = false;
    this.currentNode!.leave(this);
    this.currentNode = null;
    game.lives--;
  }
}

class ExtraShip extends Ship {
  constructor() {
    super();
    this.scale = 0.6;
    this.visible = true;
    delete this.children.exhaust;
  }

  preMove(_: number) {}
}

class BigAlien extends Sprite {
  collidesWith = ["asteroid", "ship", "bullet"];
  bridgesH = false;
  bullets: Bullet[] = [];
  bulletCounter = 0;

  constructor() {
    super(
      "bigalien",
      [-20, 0, -12, -4, 12, -4, 20, 0, 12, 4, -12, 4, -20, 0, 20, 0],
    );

    this.children.top = new Sprite(
      "bigalien_top",
      [-8, -4, -6, -6, 6, -6, 8, -4],
    );
    this.children.top.visible = true;

    this.children.bottom = new Sprite(
      "bigalien_top",
      [8, 4, 6, 6, -6, 6, -8, 4],
    );
    this.children.bottom.visible = true;
  }

  newPosition() {
    if (Math.random() < 0.5) {
      this.x = -20;
      this.vel.x = 1.5;
    } else {
      this.x = globals.canvasWidth + 20;
      this.vel.x = -1.5;
    }
    this.y = Math.random() * globals.canvasHeight;
  }

  setup() {
    this.newPosition();

    for (let i = 0; i < 3; i++) {
      var bull = new AlienBullet();
      this.bullets.push(bull);
    }
  }

  preMove(delta: number) {
    var cn = this.currentNode;
    if (cn == null) return;

    function oneIfNextSprite(node: GridNode) {
      return node.nextSprite ? 1 : 0;
    }

    var topCount =
      oneIfNextSprite(cn.north!) +
      oneIfNextSprite(cn.north!.east!) +
      oneIfNextSprite(cn.north!.west!);

    var bottomCount =
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
          var rad = 2 * Math.PI * Math.random();
          var vectorx = Math.cos(rad);
          var vectory = Math.sin(rad);
          bullet.x = this.x;
          bullet.y = this.y;
          bullet.vel.x = 6 * vectorx;
          bullet.vel.y = 6 * vectory;
          bullet.visible = true;
          sfx.laser();
          break;
        }
      }
    }
  }

  collision(other: Sprite) {
    if (other.name == "bullet") game.score += 200;
    sfx.explosion();
    game.explosionAt(other.x, other.y);
    this.visible = false;
    this.newPosition();
  }

  postMove() {
    if (this.y > globals.canvasHeight) {
      this.y = 0;
    } else if (this.y < 0) {
      this.y = globals.canvasHeight;
    }

    if (
      (this.vel.x > 0 && this.x > globals.canvasWidth + 20) ||
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

  constructor(name: string, points?: number[]) {
    super(name, points);
  }

  configureTransform() {}
  draw() {
    if (this.visible) {
      globals.context!.save();
      globals.context!.lineWidth = 2;
      globals.context!.beginPath();
      globals.context!.moveTo(this.x - 1, this.y - 1);
      globals.context!.lineTo(this.x + 1, this.y + 1);
      globals.context!.moveTo(this.x + 1, this.y - 1);
      globals.context!.lineTo(this.x - 1, this.y + 1);
      globals.context!.stroke();
      globals.context!.restore();
    }
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
  constructor() {
    super("bullet", [0, 0]);
  }
}

class AlienBullet extends BaseBullet {
  constructor() {
    super("alienbullet");
  }

  draw() {
    if (this.visible) {
      globals.context!.save();
      globals.context!.lineWidth = 2;
      globals.context!.beginPath();
      globals.context!.moveTo(this.x, this.y);
      globals.context!.lineTo(this.x - this.vel.x, this.y - this.vel.y);
      globals.context!.stroke();
      globals.context!.restore();
    }
  }
}

class Asteroid extends Sprite {
  visible = true;
  scale = 6;
  postMove = this.wrapPostMove;

  collidesWith = ["ship", "bullet", "bigalien", "alienbullet"];

  constructor() {
    super(
      "asteroid",
      [
        -10, 0, -5, 7, -3, 4, 1, 10, 5, 4, 10, 0, 5, -6, 2, -10, -4, -10, -4,
        -5,
      ],
    );
  }

  copy(): Asteroid {
    const roid = new Asteroid();
    roid.copyState(this);
    return roid;
  }

  collision(other: Sprite) {
    sfx.explosion();
    if (other.name == "bullet") game.score += 120 / this.scale;
    this.scale /= 3;
    if (this.scale > 0.5) {
      // break into fragments
      for (let i = 0; i < 3; i++) {
        var roid = this.copy();
        roid.vel.x = Math.random() * 6 - 3;
        roid.vel.y = Math.random() * 6 - 3;
        if (Math.random() > 0.5) {
          roid.points!.reverse();
        }
        roid.vel.rot = Math.random() * 2 - 1;
        roid.move(roid.scale * 3); // give them a little push
        game.sprites.push(roid);
      }
    }
    game.explosionAt(other.x, other.y);
    this.die();
  }
}

class Explosion extends Sprite {
  bridgesH = false;
  bridgesV = false;
  lines: number[][] = [];

  constructor() {
    super("explosion");

    for (let i = 0; i < 5; i++) {
      const rad = 2 * Math.PI * Math.random();
      const x = Math.cos(rad);
      const y = Math.sin(rad);
      this.lines.push([x, y, x * 2, y * 2]);
    }
  }

  draw() {
    if (this.visible) {
      globals.context!.save();
      globals.context!.lineWidth = 1.0 / this.scale;
      globals.context!.beginPath();
      for (let i = 0; i < 5; i++) {
        var line = this.lines[i];
        globals.context!.moveTo(line[0], line[1]);
        globals.context!.lineTo(line[2], line[3]);
      }
      globals.context!.stroke();
      globals.context!.restore();
    }
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
    horizontal: null,
    vertical: null,
  };

  enter(sprite: Sprite) {
    sprite.nextSprite = this.nextSprite;
    this.nextSprite = sprite;
  }

  leave(sprite: Sprite) {
    let ref: GridNode | Sprite = this;
    while (ref && ref.nextSprite != sprite) {
      ref = ref.nextSprite!;
    }
    if (ref) {
      ref.nextSprite = sprite.nextSprite;
      sprite.nextSprite = null;
    }
  }

  isEmpty(collidables: string[]) {
    var empty = true;
    let ref: GridNode | Sprite = this;
    while (ref.nextSprite) {
      ref = ref.nextSprite;
      empty = !ref.visible || collidables.indexOf(ref.name) == -1;
      if (!empty) break;
    }
    return empty;
  }
}

// borrowed from typeface-0.14.js
// http://typeface.neocracy.org
class GameText {
  renderGlyph(char: string) {
    var glyph = (face.glyphs as any)[char];

    if (glyph.o) {
      var outline;
      if (glyph.cached_outline) {
        outline = glyph.cached_outline;
      } else {
        outline = glyph.o.split(" ");
        glyph.cached_outline = outline;
      }

      var outlineLength = outline.length;
      for (let i = 0; i < outlineLength; ) {
        var action = outline[i++];

        switch (action) {
          case "m":
            globals.context!.moveTo(outline[i++], outline[i++]);
            break;
          case "l":
            globals.context!.lineTo(outline[i++], outline[i++]);
            break;

          case "q":
            var cpx = outline[i++];
            var cpy = outline[i++];
            globals.context!.quadraticCurveTo(
              outline[i++],
              outline[i++],
              cpx,
              cpy,
            );
            break;

          case "b":
            var x = outline[i++];
            var y = outline[i++];
            globals.context!.bezierCurveTo(
              outline[i++],
              outline[i++],
              outline[i++],
              outline[i++],
              x,
              y,
            );
            break;
        }
      }
    }
    if (glyph.ha) {
      globals.context!.translate(glyph.ha, 0);
    }
  }

  renderText(text: string, size: number, x: number, y: number) {
    globals.context!.save();

    globals.context!.translate(x, y);

    var pixels = (size * 72) / (face!.resolution * 100);
    globals.context!.scale(pixels, -1 * pixels);
    globals.context!.beginPath();
    var chars = text.split("");
    var charsLength = chars.length;
    for (let i = 0; i < charsLength; i++) {
      this.renderGlyph(chars[i]);
    }
    globals.context!.fill();

    globals.context!.restore();
  }
}
const text = new GameText();

class SFX {
  laserWav: HTMLAudioElement;
  explosionWav: HTMLAudioElement;

  // pre-mute audio
  muted = true;

  constructor() {
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
    if (this.muted) {
      return;
    }

    audio.play();
  }
}

const sfx = new SFX();

class Game {
  score = 0;
  totalAsteroids = 5;
  lives = 0;

  sprites: Sprite[] = [];
  ship: Ship;
  bigAlien: BigAlien;

  nextBigAlienTime: number | null = null;
  fsm = new FSM();

  constructor() {
    this.ship = new Ship();

    this.ship.x = globals.canvasWidth / 2;
    this.ship.y = globals.canvasHeight / 2;

    this.sprites.push(this.ship);

    for (let i = 0; i < 10; i++) {
      const bull = new Bullet();
      this.ship.bullets.push(bull);
      this.sprites.push(bull);
    }

    this.bigAlien = new BigAlien();
    this.bigAlien.setup();
    this.bigAlien.bullets.forEach((bull) => this.sprites.push(bull));
    this.sprites.push(this.bigAlien);
  }

  spawnAsteroids(count?: number) {
    if (!count) count = this.totalAsteroids;
    for (let i = 0; i < count; i++) {
      var roid = new Asteroid();
      roid.x = Math.random() * globals.canvasWidth;
      roid.y = Math.random() * globals.canvasHeight;
      while (!roid.isClear()) {
        roid.x = Math.random() * globals.canvasWidth;
        roid.y = Math.random() * globals.canvasHeight;
      }
      roid.vel.x = Math.random() * 4 - 2;
      roid.vel.y = Math.random() * 4 - 2;
      if (Math.random() > 0.5) {
        roid.points!.reverse();
      }
      roid.vel.rot = Math.random() * 2 - 1;
      game.sprites.push(roid);
    }
  }

  explosionAt(x: number, y: number) {
    var splosion = new Explosion();
    splosion.x = x;
    splosion.y = y;
    splosion.visible = true;
    this.sprites.push(splosion);
  }
}

class FSM {
  state: () => void = this.boot;
  timer: number | null = null;

  boot() {
    game.spawnAsteroids(5);
    this.state = this.waiting;
  }
  waiting() {
    text.renderText(
      "Press Space to Start",
      36,
      globals.canvasWidth / 2 - 270,
      globals.canvasHeight / 2,
    );
    if (KEY_STATUS.space) {
      KEY_STATUS.space = false; // hack so we don't shoot right away
      this.state = this.start;
    }
  }
  start() {
    for (let i = 0; i < game.sprites.length; i++) {
      if (game.sprites[i].name == "asteroid") {
        game.sprites[i].die();
      } else if (
        game.sprites[i].name == "bullet" ||
        game.sprites[i].name == "bigalien"
      ) {
        game.sprites[i].visible = false;
      }
    }

    game.score = 0;
    game.lives = 2;
    game.totalAsteroids = 2;
    game.spawnAsteroids();

    game.nextBigAlienTime = Date.now() + 30000 + 30000 * Math.random();

    this.state = this.spawn_ship;
  }
  spawn_ship() {
    game.ship.x = globals.canvasWidth / 2;
    game.ship.y = globals.canvasHeight / 2;
    if (game.ship!.isClear()) {
      game.ship.rot = 0;
      game.ship.vel.x = 0;
      game.ship.vel.y = 0;
      game.ship.visible = true;
      this.state = this.run;
    }
  }
  run() {
    for (var i = 0; i < game.sprites.length; i++) {
      if (game.sprites[i].name == "asteroid") {
        break;
      }
    }
    if (i == game.sprites.length) {
      this.state = this.new_level;
    }
    if (!game.bigAlien!.visible && Date.now() > game.nextBigAlienTime!) {
      game.bigAlien!.visible = true;
      game.nextBigAlienTime = Date.now() + 30000 * Math.random();
    }
  }
  new_level() {
    if (this.timer == null) {
      this.timer = Date.now();
    }
    // wait a second before spawning more asteroids
    if (Date.now() - this.timer > 1000) {
      this.timer = null;
      game.totalAsteroids++;
      if (game.totalAsteroids > 12) game.totalAsteroids = 12;
      game.spawnAsteroids();
      this.state = this.run;
    }
  }
  player_died() {
    if (game.lives < 0) {
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
    text.renderText(
      "GAME OVER",
      50,
      globals.canvasWidth / 2 - 160,
      globals.canvasHeight / 2 + 10,
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

const game = new Game();

export function start() {
  const canvas: HTMLCanvasElement = document.getElementById(
    "canvas",
  )! as HTMLCanvasElement;
  globals.canvasWidth = canvas.width;
  globals.canvasHeight = canvas.height;

  const context = canvas.getContext("2d")!;

  globals.context = context;

  const gridWidth = Math.round(globals.canvasWidth / GRID_SIZE);
  const gridHeight = Math.round(globals.canvasHeight / GRID_SIZE);
  const grid = new Array(gridWidth);
  globals.grid = grid;
  for (let i = 0; i < gridWidth; i++) {
    grid[i] = new Array(gridHeight);
    for (let j = 0; j < gridHeight; j++) {
      grid[i][j] = new GridNode();
    }
  }

  // set up the positional references
  for (let i = 0; i < gridWidth; i++) {
    for (let j = 0; j < gridHeight; j++) {
      const node = grid[i][j];
      node.north = grid[i][j == 0 ? gridHeight - 1 : j - 1];
      node.south = grid[i][j == gridHeight - 1 ? 0 : j + 1];
      node.west = grid[i == 0 ? gridWidth - 1 : i - 1][j];
      node.east = grid[i == gridWidth - 1 ? 0 : i + 1][j];
    }
  }

  // set up borders
  for (let i = 0; i < gridWidth; i++) {
    grid[i][0].dupe.vertical = globals.canvasHeight;
    grid[i][gridHeight - 1].dupe.vertical = -globals.canvasHeight;
  }

  for (let j = 0; j < gridHeight; j++) {
    grid[0][j].dupe.horizontal = globals.canvasWidth;
    grid[gridWidth - 1][j].dupe.horizontal = -globals.canvasWidth;
  }

  const extraDude = new ExtraShip();

  let paused = false;
  let showFramerate = false;
  let avgFramerate = 0;
  let frameCount = 0;
  let elapsedCounter = 0;

  let lastFrame = Date.now();
  let thisFrame: number;
  let elapsed: number;
  let delta: number;

  function mainLoop() {
    context.clearRect(0, 0, globals.canvasWidth, globals.canvasHeight);

    game.fsm.execute();

    if (KEY_STATUS.g) {
      context.beginPath();
      for (let i = 0; i < gridWidth; i++) {
        context.moveTo(i * GRID_SIZE, 0);
        context.lineTo(i * GRID_SIZE, globals.canvasHeight);
      }
      for (let j = 0; j < gridHeight; j++) {
        context.moveTo(0, j * GRID_SIZE);
        context.lineTo(globals.canvasWidth, j * GRID_SIZE);
      }
      context.closePath();
      context.stroke();
    }

    thisFrame = Date.now();
    elapsed = thisFrame - lastFrame;
    lastFrame = thisFrame;
    delta = elapsed / 30;

    for (let i = 0; i < game.sprites.length; i++) {
      game.sprites[i].run(delta);

      if (game.sprites[i].reap) {
        game.sprites[i].reap = false;
        game.sprites.splice(i, 1);
        i--;
      }
    }

    // score
    var score_text = "" + game.score;
    text.renderText(
      score_text,
      18,
      globals.canvasWidth - 14 * score_text.length,
      20,
    );

    // extra dudes
    for (let i = 0; i < game.lives; i++) {
      context.save();
      extraDude.x = globals.canvasWidth - 8 * (i + 1);
      extraDude.y = 32;
      extraDude.configureTransform();
      extraDude.draw();
      context.restore();
    }

    if (showFramerate) {
      text.renderText(
        "" + avgFramerate,
        24,
        globals.canvasWidth - 38,
        globals.canvasHeight - 2,
      );
    }

    frameCount++;
    elapsedCounter += elapsed;
    if (elapsedCounter > 1000) {
      elapsedCounter -= 1000;
      avgFramerate = frameCount;
      frameCount = 0;
    }

    if (paused) {
      text.renderText("PAUSED", 72, globals.canvasWidth / 2 - 160, 120);
    } else {
      requestAnimationFrame(mainLoop);
    }
  }

  mainLoop();

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    switch (KEY_CODES[e.keyCode]) {
      case "f": // show framerate
        showFramerate = !showFramerate;
        break;
      case "p": // pause
        paused = !paused;
        if (!paused) {
          // start up again
          lastFrame = Date.now();
          mainLoop();
        }
        break;
      case "m": // mute
        sfx.muted = !sfx.muted;
        break;
    }
  });
}
