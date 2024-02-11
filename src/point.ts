export class Point {
  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}

  assign(other: Point) {
    this.x = other.x;
    this.y = other.y;
  }

  add(other: Point) {
    return new Point(this.x + other.x, this.y + other.y);
  }

  sub(other: Point) {
    return new Point(this.x - other.x, this.y - other.y);
  }

  mul(scalar: number) {
    return new Point(this.x * scalar, this.y * scalar);
  }

  norm2() {
    return this.x * this.x + this.y * this.y;
  }

  transpose() {
    const tmp = this.x;
    this.x = this.y;
    this.y = tmp;
  }

  mod(canvasSize: Point) {
    return new Point(mod(this.x, canvasSize.x), mod(this.y, canvasSize.y));
  }

  cross(other: Point) {
    return this.x * other.y - this.y * other.x;
  }
}

/** Floored division modulo. */
function mod(x: number, n: number) {
  return ((x % n) + n) % n;
}

export class PointRotator {
  private sin: number;
  private cos: number;

  constructor(rot: number) {
    const rad = (rot * Math.PI) / 180;
    this.sin = Math.sin(rad);
    this.cos = Math.cos(rad);
  }

  apply(point: Point): Point {
    return new Point(
      this.cos * point.x + -this.sin * point.y,
      this.sin * point.x + this.cos * point.y,
    );
  }
}

export class LineSegment {
  constructor(
    public beg: Point = new Point(),
    public end: Point = new Point(),
  ) {}

  length() {
    return this.end.sub(this.beg);
  }
}
