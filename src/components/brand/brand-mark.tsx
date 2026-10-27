import Image from "next/image";

export function BrandMark({ size = 64, decorative = false }: { size?: number; decorative?: boolean }) {
  return (
    <Image
      src="/brand/cueva-symbol.svg"
      alt={decorative ? "" : "CUEVA"}
      width={size}
      height={size}
      className="brand-mark"
      priority
    />
  );
}
