import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Izinkan akses dev server dari IP jaringan lokal; tanpa ini JS/HMR diblokir (403)
  // sehingga komponen client (mis. filter select search) tidak jalan.
  allowedDevOrigins: ["192.168.231.1"],
  // tesseract.js memuat worker script & wasm lewat path runtime, jadi tidak
  // terdeteksi file tracing -> di Vercel error "Cannot find module worker-script".
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  outputFileTracingIncludes: {
    "/api/scan-form": ["./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*"],
  },
};

export default nextConfig;
