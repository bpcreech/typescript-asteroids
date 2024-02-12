type KeyCodes = {
  [index: number]: string;
};

const KEY_CODES: KeyCodes = {
  32: "space",
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  70: "f",
  71: "g",
  72: "h",
  77: "m",
  80: "p",
};

type KeyStatus = {
  [index: string]: boolean;
};

export interface KeyboardHandler {
  onUnpause(): void;
}

export class Keyboard {
  keyboardHandler: KeyboardHandler | undefined = undefined;
  readonly keyStatus: KeyStatus = {};
  paused = false;
  showFramerate = false;
  // pre-mute audio
  muted = true;

  constructor() {
    for (const code in KEY_CODES) {
      this.keyStatus[KEY_CODES[code]] = false;
    }

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.keyCode in KEY_CODES) {
        e.preventDefault();
        this.keyStatus[KEY_CODES[e.keyCode]] = true;
      }
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      if (e.keyCode in KEY_CODES) {
        e.preventDefault();
        this.keyStatus[KEY_CODES[e.keyCode]] = false;
      }
    });

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      switch (KEY_CODES[e.keyCode]) {
        case "f": // show framerate
          this.showFramerate = !this.showFramerate;
          break;
        case "p": // pause
          this.paused = !this.paused;
          if (!this.paused) {
            // start up again
            this.keyboardHandler?.onUnpause();
          }
          break;
        case "m": // mute
          this.muted = !this.muted;
          break;
      }
    });
  }
}
