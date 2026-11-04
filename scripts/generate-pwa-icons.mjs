import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SOURCE = "public/images/logo-gladiama.png";
const OUT_DIR = "public/icons";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // The source is the full wordmark; only the cube on the left reads at icon
  // sizes. Crop that region then trim its white margin to get a tight mark.
  const cropped = await sharp(SOURCE)
    .extract({ left: 150, top: 150, width: 400, height: 587 })
    .toBuffer();
  const trimmed = await sharp(cropped).trim({ background: "#ffffff", threshold: 10 }).toBuffer();

  // The source PNG has no alpha channel — its "background" is just white
  // pixels. Without punching real transparency through them, compositing
  // this onto any non-white canvas (the maskable navy tile) leaves a visible
  // white rectangle around the mark instead of the mark floating free.
  const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const distanceFromWhite = 255 - Math.min(r, g, b);
    // Near-white -> transparent; near-color -> opaque, with a short ramp
    // between so the mark's anti-aliased edges don't look jagged.
    data[i + 3] = Math.max(0, Math.min(255, Math.round((distanceFromWhite - 10) * 12)));
  }
  const mark = await sharp(data, { raw: info }).png().toBuffer();
  const markMeta = await sharp(mark).metadata();

  async function squareIcon(size, { padFraction, background }) {
    const inner = Math.round(size * (1 - padFraction * 2));
    const resized = await sharp(mark)
      .resize(inner, inner, { fit: "contain", background })
      .toBuffer();
    return sharp({
      create: { width: size, height: size, channels: 4, background },
    })
      .composite([{ input: resized, gravity: "center" }])
      .png()
      .toBuffer();
  }

  // Standard icons: mark fills most of the canvas on a white tile, matching
  // how the header already shows it (white box behind the mark).
  for (const size of [192, 512]) {
    const buf = await squareIcon(size, { padFraction: 0.08, background: "#ffffff" });
    await sharp(buf).toFile(`${OUT_DIR}/icon-${size}.png`);
  }

  // Maskable: OS may crop to a circle/rounded-square, so the mark must sit
  // inside the ~80% "safe zone" — more padding than the standard icons.
  const maskable = await squareIcon(512, { padFraction: 0.18, background: "#172238" });
  await sharp(maskable).toFile(`${OUT_DIR}/icon-512-maskable.png`);

  // iOS ignores manifest icons entirely and only reads apple-touch-icon —
  // no transparency (iOS paints transparent areas black), white tile matches
  // the maskable/standard treatment.
  const appleTouch = await squareIcon(180, { padFraction: 0.1, background: "#ffffff" });
  await sharp(appleTouch).flatten({ background: "#ffffff" }).toFile(`${OUT_DIR}/apple-touch-icon.png`);

  console.log("mark bbox after trim:", markMeta.width, "x", markMeta.height);
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
