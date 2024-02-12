import { Display } from "./display.ts";
import { Point } from "./point.ts";
import { vector_battle } from "./vector_battle_regular.typeface.ts";

const face = vector_battle;

export interface GameText {
  renderText(text: string, size: number, loc: Point): void;
}

// borrowed from typeface-0.14.js
// http://typeface.neocracy.org
export class GameTextImpl {
  constructor(private readonly display: Display) {}

  private renderGlyph(char: string) {
    const glyph = (face.glyphs as any)[char]; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (glyph.o) {
      let outline;
      if (glyph.cached_outline) {
        outline = glyph.cached_outline;
      } else {
        outline = glyph.o.split(" ");
        glyph.cached_outline = outline;
      }

      const outlineLength = outline.length;
      for (let i = 0; i < outlineLength; ) {
        const action = outline[i++];

        switch (action) {
          case "m":
            this.display.moveTo(new Point(outline[i++], outline[i++]));
            break;
          case "l":
            this.display.lineTo(new Point(outline[i++], outline[i++]));
            break;

          case "q":
            {
              const cpx = outline[i++];
              const cpy = outline[i++];
              this.display.quadraticCurveTo(
                new Point(outline[i++], outline[i++]),
                new Point(cpx, cpy),
              );
            }
            break;

          case "b":
            {
              const x = outline[i++];
              const y = outline[i++];
              this.display.bezierCurveTo(
                new Point(outline[i++], outline[i++]),
                new Point(outline[i++], outline[i++]),
                new Point(x, y),
              );
            }
            break;
        }
      }
    }
    if (glyph.ha) {
      this.display.translate(new Point(glyph.ha, 0));
    }
  }

  renderText(text: string, size: number, loc: Point) {
    this.display.save();

    this.display.translate(loc);

    const pixels = (size * 72) / (face!.resolution * 100);
    this.display.scale(new Point(pixels, -1 * pixels));
    this.display.beginPath();
    text.split("").forEach((char) => this.renderGlyph(char));
    this.display.fill();

    this.display.restore();
  }
}
