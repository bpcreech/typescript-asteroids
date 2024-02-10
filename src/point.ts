export class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}

  assign(point: Point) {
    this.x = point.x;
    this.y = point.y;
  }
}

export class PointTransformer {
  private rad: number;
  private sin: number;
  private cos: number;

  constructor(
    rot: number,
    scale: number,
    private trans: Point,
  ) {
    this.rad = (rot * Math.PI) / 180;
    this.sin = Math.sin(this.rad) * scale;
    this.cos = Math.cos(this.rad) * scale;
  }

  apply(point: Point): Point {
    return new Point(
      this.cos * point.x + -this.sin * point.y + this.trans.x,
      this.sin * point.x + this.cos * point.y + this.trans.y,
    );
  }
}
