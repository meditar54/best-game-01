// input.js — keyboard and mouse state for NOVA DRIFT.
// Tracks held keys, edge-triggered presses (consumed once), and the mouse
// position in canvas coordinates plus its button state.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: 640, y: 400, down: false, clicked: false };
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** True while the key is held down. */
  isDown(code) {
    return this.keys.has(code);
  }

  /** True once for the frame after the key went down, then consumed. */
  wasPressed(code) {
    return this.pressedKeys.has(code);
  }

  /** True if any of the given codes was pressed this frame. */
  anyPressed(codes) {
    return codes.some((c) => this.pressedKeys.has(c));
  }

  /** Movement vector from WASD / arrows, normalized. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  /** True while the fire button (mouse or Space) is held. */
  firing() {
    return this.mouse.down || this.isDown('Space');
  }

  /** Clear the per-frame edge state. Call once per frame, after update. */
  endFrame() {
    this.pressedKeys.clear();
    this.mouse.clicked = false;
  }
}
