import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/comprobantes": ["./node_modules/pdf-lib/dist/pdf-lib.min.js"],
  },
  turbopack: { root: process.cwd() },
  async headers() {
    return ["/laboratorio/:path*", "/aceptar-invitacion", "/crear-contrasena", "/cuenta", "/api/acceso/:path*"].map(source => ({ source, headers: [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "strict-origin" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }));
  },
};

export default nextConfig;
