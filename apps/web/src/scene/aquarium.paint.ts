import {
  type AquariumAppearance,
  type AquariumPen,
  fishBob,
  paintFish,
  paintSceneryDetails,
  sceneryPalette,
  sceneryPixel,
} from "@supacode/client-runtime/aquarium/paint";
import {
  type AquariumFish,
  type AquariumResident,
  fishSize,
} from "@supacode/client-runtime/aquarium/simulation";

export function canvasPen(context: CanvasRenderingContext2D): AquariumPen {
  return {
    fill(color, x, y, width, height) {
      context.fillStyle = color;
      context.fillRect(x, y, width, height);
    },
    alpha(value) {
      context.globalAlpha = value;
    },
  };
}

function packColor(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return (0xff << 24) | ((value & 0xff) << 16) | (value & 0xff00) | ((value >> 16) & 0xff);
}

export function paintScenery(width: number, height: number, appearance: AquariumAppearance) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return canvas;
  const image = context.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  const palette = sceneryPalette(appearance).map(packColor);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      pixels[y * width + x] = palette[sceneryPixel(appearance, width, height, x, y)]!;
  context.putImageData(image, 0, 0);
  paintSceneryDetails(canvasPen(context), width, height, appearance);
  return canvas;
}

export function paintFishSprite(
  fish: AquariumFish,
  resident: AquariumResident,
  tick: number,
  appearance: AquariumAppearance,
) {
  const { width, height } = fishSize(fish.key);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context !== null)
    paintFish(
      canvasPen(context),
      { ...fish, x: 0, y: -fishBob(fish.key, tick) },
      resident,
      tick,
      appearance,
    );
  return canvas;
}
