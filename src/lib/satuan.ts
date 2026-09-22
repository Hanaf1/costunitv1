export type BarangOption = {
  id: string;
  kodeItem: string;
  namaBarang: string;
  satuanDasar: string;
  hargaReferensi: number;
  satuanList: { namaSatuan: string; isi: number; harga: number | null }[];
};

export type SatuanChoice = { nama: string; isi: number; harga: number };

// Satuan dasar + satuan alternatif barang (mis. Lembar, Rim = 500 Lembar).
export function satuanChoices(b: BarangOption): SatuanChoice[] {
  return [
    { nama: b.satuanDasar, isi: 1, harga: b.hargaReferensi },
    ...b.satuanList.map((s) => ({ nama: s.namaSatuan, isi: s.isi, harga: s.harga ?? b.hargaReferensi * s.isi })),
  ];
}
