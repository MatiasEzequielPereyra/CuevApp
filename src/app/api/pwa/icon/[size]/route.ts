import sharp from "sharp";

export const runtime = "nodejs";

// PNGs generados desde los mismos trazos del logo vectorial de public/brand/cueva-symbol.svg.
// Usamos el SVG inline para que el ícono no dependa de acceso al filesystem del serverless.
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" fill="none">
<circle cx="240" cy="240" r="240" fill="#000"/>
<g fill="#fff" transform="translate(44 192)">
<path d="M0 0H72V19H22V53H72V72H0Z"/>
<path d="M81 0H101V53H136V0H153V72H81Z"/>
<path d="M162 0H228V19H183V53H228V72H162Z M192 28H224V45H192Z"/>
<path d="M239 0H268L289 31L310 0H339L290 74Z"/>
<path d="M353 0L404 74H375L354 43L333 74H305Z"/>
</g></svg>`;

const allowed = new Set(["180", "192", "512"]);

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!allowed.has(size)) return new Response("No encontrado", { status: 404 });
  const pixels = Number(size);
  const png = await sharp(Buffer.from(logo)).resize(pixels, pixels).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
