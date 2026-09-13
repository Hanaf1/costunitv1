import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Izinkan akses dev server dari IP jaringan lokal; tanpa ini JS/HMR diblokir (403)
  // sehingga komponen client (mis. filter select search) tidak jalan.
  allowedDevOrigins: ["192.168.231.1"],
};

export default nextConfig;
