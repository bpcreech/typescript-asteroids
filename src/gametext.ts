import { Display } from "./display.ts";
import { Point } from "./point.ts";
import { vector_battle } from "./vector_battle_regular.typeface.ts";

const face = vector_battle;

// borrowed from typeface-0.14.js
// http://typeface.neocracy.org
export class GameText {
  constructor(private readonly display: Display) {}

  renderGlyph(char: string) {
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
            this.display.context.moveTo(outline[i++], outline[i++]);
            break;
          case "l":
            this.display.context.lineTo(outline[i++], outline[i++]);
            break;

          case "q":
            {
              const cpx = outline[i++];
              const cpy = outline[i++];
              this.display.context.quadraticCurveTo(
                outline[i++],
                outline[i++],
                cpx,
                cpy,
              );
            }
            break;

          case "b":
            {
              const x = outline[i++];
              const y = outline[i++];
              this.display.context.bezierCurveTo(
                outline[i++],
                outline[i++],
                outline[i++],
                outline[i++],
                x,
                y,
              );
            }
            break;
        }
      }
    }
    if (glyph.ha) {
      this.display.context.translate(glyph.ha, 0);
    }
  }

  renderText(text: string, size: number, loc: Point) {
    this.display.context.save();

    this.display.context.translate(loc.x, loc.y);

    const pixels = (size * 72) / (face!.resolution * 100);
    this.display.context.scale(pixels, -1 * pixels);
    this.display.context.beginPath();
    text.split("").forEach((char) => this.renderGlyph(char));
    this.display.context.fill();

    this.display.context.restore();
  }
}
