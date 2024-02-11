import { Point } from "./point.ts";

export class Display {
  constructor(
    public readonly canvasSize: Point,
    private readonly context: CanvasRenderingContext2D,
  ) {}

  clearRect(corner: Point, size: Point) {
    this.context.clearRect(corner.x, corner.y, size.x, size.y);
  }

  strokeRect(corner: Point, size: Point) {
    this.context.strokeRect(corner.x, corner.y, size.x, size.y);
  }

  translate(dist: Point) {
    this.context.translate(dist.x, dist.y);
  }

  rotate(rads: number) {
    this.context.rotate(rads);
  }

  scale(amount: Point) {
    this.context.scale(amount.x, amount.y);
  }

  restore() {
    this.context.restore();
  }

  save() {
    this.context.save();
  }

  stroke() {
    this.context.stroke();
  }

  beginPath() {
    this.context.beginPath();
  }

  closePath() {
    this.context.closePath();
  }

  moveTo(point: Point) {
    this.context.moveTo(point.x, point.y);
  }

  lineTo(point: Point) {
    this.context.lineTo(point.x, point.y);
  }

  isPointInPath(point: Point) {
    return this.context.isPointInPath(point.x, point.y);
  }

  fill() {
    this.context.fill();
  }

  bezierCurveTo(cp1: Point, cp2: Point, ep: Point) {
    this.context.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, ep.x, ep.y);
  }

  quadraticCurveTo(cp: Point, ep: Point) {
    this.context.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
  }

  set lineWidth(width: number) {
    this.context.lineWidth = width;
  }

  set strokeStyle(style: string) {
    this.context.strokeStyle = style;
  }
}
