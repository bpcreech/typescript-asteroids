import { LineSegment, Point } from "./point.ts";
import { Polygon } from "./polygon.ts";

export class Intersector {
  constructor(private canvasSize: Point) {}

  /**
   * See if the given point is in the given polygon. We assume the polygon
   * points are not wrapped; i.e., may be off the screen but are oriented
   * ordinarily relative to each other.
   */
  isPointInPolygon(p: Point, polygon: Polygon) {
    // Create a test line segment from p to an arbitrary point halfway across
    // the screen (implicitly assuming no polygons are bigger than half the
    // screen):
    const testSegment = new LineSegment(
      p,
      p.add(this.canvasSize.mul(0.5)).mod(this.canvasSize),
    );

    let inside = false;

    // Count how many times that test line segment crosses a line in the
    // polygon. If the test line segment crosses an odd number of times, we can
    // conclude that point p is in the polygon.
    for (let i = 0; i < polygon.points.length; i++) {
      const j = (i + 1) % polygon.points.length;
      if (
        this.doLinesIntersect(
          testSegment,
          new LineSegment(polygon.points[i], polygon.points[j]),
        )
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  private doLinesIntersect(i: LineSegment, j: LineSegment) {
    // From https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect
    const iLen = i.length();
    const jLen = j.length();
    const jBegMinusIBeg = j.beg.sub(i.beg);
    const iLenCrossJLen = iLen.cross(jLen);
    if (iLenCrossJLen == 0) {
      return false;
    }
    const t = jBegMinusIBeg.cross(jLen) / iLenCrossJLen;
    const u = jBegMinusIBeg.cross(iLen) / iLenCrossJLen;
    return t > 0 && t < 1 && u > 0 && u < 1;
  }
}
