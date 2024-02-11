import { Display } from "./display.ts";
import { Intersector } from "./intersector.ts";
import { Point, PointRotator } from "./point.ts";

export class Polygon {
  visible = true;

  constructor(readonly points: Point[]) {}

  collides(other: Polygon, intersector: Intersector) {
    const p = other.points.find((p) => intersector.isPointInPolygon(p, this));
    return p !== undefined;
  }

  transform(rotator: PointRotator, scale: number, loc: Point) {
    return new Polygon(
      this.points.map((p) => rotator.apply(p).mul(scale)),
    ).translate(loc);
  }

  translate(loc: Point) {
    return new Polygon(this.points.map((p) => p.add(loc)));
  }

  draw(display: Display) {
    display.beginPath();
    display.moveTo(this.points[0]);
    this.points.slice(1).forEach((p) => display.lineTo(p));
    display.closePath();
    display.stroke();
  }
}
