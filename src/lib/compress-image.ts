// Kecilkan foto HP (sering 3–12 MB) sebelum diunggah: upload lebih cepat, muat
// batas body request Vercel (4,5 MB), dan Gemini memproses gambar lebih ringan.
// Sisi terpanjang 1600 px masih cukup tajam untuk tulisan tangan.
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    // Latar putih agar PNG transparan tidak jadi hitam saat diubah ke JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "form.jpg", { type: "image/jpeg" });
  } catch {
    // Format yang tidak bisa dibaca browser (mis. HEIC di sebagian perangkat): kirim apa adanya.
    return file;
  }
}
