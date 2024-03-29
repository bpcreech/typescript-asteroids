import { Game } from "./game.ts";
import { DisplayImpl } from "./display.ts";
import { GameTextImpl } from "./gametext.ts";
import { KeyboardImpl } from "./keyboard.ts";
import { Point } from "./point.ts";
import { RandomImpl } from "./random.ts";
import { SFXImpl } from "./sfx.ts";

export function start(canvasId: string) {
  const keyboard = new KeyboardImpl();
  const sfx = new SFXImpl(keyboard);

  const canvas: HTMLCanvasElement = document.getElementById(
    canvasId,
  )! as HTMLCanvasElement;

  const display = new DisplayImpl(
    new Point(canvas.width, canvas.height),
    canvas.getContext("2d")!,
  );

  const text = new GameTextImpl(display);

  const random = new RandomImpl();

  const game = new Game(keyboard, sfx, display, text, random);
  game.start();
}
