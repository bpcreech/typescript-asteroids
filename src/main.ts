import { Game } from "./game.ts";
import { Display } from "./display.ts";
import { GameText } from "./gametext.ts";
import { Keyboard } from "./keyboard.ts";
import { Point } from "./point.ts";
import { SFX } from "./sfx.ts";

const keyboard = new Keyboard();
const sfx = new SFX(keyboard);

const canvas: HTMLCanvasElement = document.getElementById(
  "canvas",
)! as HTMLCanvasElement;

const display = new Display(
  new Point(canvas.width, canvas.height),
  canvas.getContext("2d")!,
);

const text = new GameText(display);

const game = new Game(keyboard, sfx, display, text);
game.start();
