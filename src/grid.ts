import { Point } from "./point.ts";
import { Sprite } from "./game.ts";

export const GRID_SIZE = 60;

export class GridNode {
  north: GridNode | null = null;
  south: GridNode | null = null;
  east: GridNode | null = null;
  west: GridNode | null = null;

  nextSprite: Sprite | null = null;

  dupe = {
    horizontal: 0,
    vertical: 0,
  };

  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  enter(sprite: Sprite) {
    sprite.nextSprite = this.nextSprite;
    this.nextSprite = sprite;
  }

  leave(sprite: Sprite) {
    let ref: GridNode | Sprite = this; // eslint-disable-line @typescript-eslint/no-this-alias
    while (ref && ref.nextSprite != sprite) {
      ref = ref.nextSprite!;
    }
    if (ref) {
      ref.nextSprite = sprite.nextSprite;
      sprite.nextSprite = null;
    }
  }

  isEmpty(collidables: string[]) {
    let ref: GridNode | Sprite = this; // eslint-disable-line @typescript-eslint/no-this-alias
    while (ref.nextSprite) {
      ref = ref.nextSprite;
      if (ref.visible && collidables.indexOf(ref.name) != -1) {
        return false;
      }
    }
    return true;
  }
}

export class Grid {
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly nodes: Array<Array<GridNode>>;

  constructor(canvasSize: Point) {
    this.gridWidth = Math.round(canvasSize.x / GRID_SIZE);
    this.gridHeight = Math.round(canvasSize.y / GRID_SIZE);
    this.nodes = new Array(this.gridWidth);

    for (let i = 0; i < this.gridWidth; i++) {
      this.nodes[i] = new Array(this.gridHeight);
      for (let j = 0; j < this.gridHeight; j++) {
        this.nodes[i][j] = new GridNode(i, j);
      }
    }

    // set up the positional references
    for (let i = 0; i < this.gridWidth; i++) {
      for (let j = 0; j < this.gridHeight; j++) {
        const node = this.nodes[i][j];
        node.north = this.nodes[i][j == 0 ? this.gridHeight - 1 : j - 1];
        node.south = this.nodes[i][j == this.gridHeight - 1 ? 0 : j + 1];
        node.west = this.nodes[i == 0 ? this.gridWidth - 1 : i - 1][j];
        node.east = this.nodes[i == this.gridWidth - 1 ? 0 : i + 1][j];
      }
    }

    // set up borders
    for (let i = 0; i < this.gridWidth; i++) {
      this.nodes[i][0].dupe.vertical = canvasSize.y;
      this.nodes[i][this.gridHeight - 1].dupe.vertical = -canvasSize.y;
    }

    for (let j = 0; j < this.gridHeight; j++) {
      this.nodes[0][j].dupe.horizontal = canvasSize.x;
      this.nodes[this.gridWidth - 1][j].dupe.horizontal = -canvasSize.x;
    }
  }

  findNode(point: Point): GridNode {
    let gridx = Math.floor(point.x / GRID_SIZE);
    let gridy = Math.floor(point.y / GRID_SIZE);
    gridx = gridx >= this.nodes.length ? 0 : gridx;
    gridy = gridy >= this.nodes[0].length ? 0 : gridy;
    gridx = gridx < 0 ? this.nodes.length - 1 : gridx;
    gridy = gridy < 0 ? this.nodes[0].length - 1 : gridy;
    return this.nodes[gridx][gridy];
  }
}
