import { Point } from "./point.ts";

export class Display {
  constructor(
    public readonly canvasSize: Point,
    public readonly context: CanvasRenderingContext2D,
  ) {}
}
