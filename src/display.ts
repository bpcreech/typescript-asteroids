import { Point } from "./point.ts";

export interface Display {
  readonly canvasSize: Point;

  clear(): void;

  stroke(): void;

  beginPath(): void;

  moveTo(point: Point): void;

  lineTo(point: Point): void;

  set lineWidth(width: number);

  set strokeStyle(style: string);
}

export class DisplayImpl implements Display {
  constructor(
    public readonly canvasSize: Point,
    private readonly context: CanvasRenderingContext2D,
  ) {}

  clear() {
    this.context.clearRect(0, 0, this.canvasSize.x, this.canvasSize.y);
  }

  strokeRect(corner: Point, size: Point) {
    this.context.strokeRect(corner.x, corner.y, size.x, size.y);
  }

  translate(dist: Point) {
    this.context.translate(dist.x, dist.y);
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
