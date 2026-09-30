import { getCategoryAndIcon } from './categories';

export interface ParsedReceipt {
  amount: number;
  description: string;
  category: string;
  rawText: string;
  items?: string[];
  storeName?: string;
  tax?: number;
  subtotal?: number;
  tender?: number;
  change?: number;
}

export function parseReceiptText(text: string): ParsedReceipt {
  if (!text || !text.trim()) {
    return {
      amount: 0,
      description: 'Nota Belanja',
      category: 'Belanja & Pribadi',
      rawText: text || ''
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // 1. Bersihkan OCR typo umum pada baris teks
  const cleanLineForKeywords = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/tot4l|totai|t0tal/g, 'total')
      .replace(/subtot4l|subt0tal/g, 'subtotal')
      .replace(/tun4i|tunall/g, 'tunai')
      .replace(/kemb4li|kembalian/g, 'kembali')
      .replace(/p4jak/g, 'pajak')
      .replace(/d1skon/g, 'diskon');
  };

  // Helper untuk mengekstrak angka rupiah dari satu baris
  const extractNumbersFromLine = (lineStr: string): number[] => {
    // Hilangkan prefix mata uang dan karakter non-angka kecuali pemisah
    let s = lineStr.replace(/rp\.?/gi, ' ').trim();
    
    // Perbaiki OCR typo angka (misal huruf O besar/kecil di antara digit)
    s = s.replace(/(\d)[oO](\d)/g, '$10$2');
    s = s.replace(/(\d)[oO]$/g, '$10');

    // Cari pola angka (misal: 191.475, 172,500, 191475, 2.500.000, 18.975,00)
    const matches = s.match(/\d+[\d.,]*/g) || [];
    const results: number[] = [];

    for (const m of matches) {
      // Abaikan jika hanya berupa tahun/jam (contoh: 2023, 16:45)
      let cleaned = m.replace(/[^\d.,]/g, '');
      if (!cleaned || cleaned.length < 2) continue;

      const dotCount = (cleaned.match(/\./g) || []).length;
      const commaCount = (cleaned.match(/,/g) || []).length;

      let val = 0;
      if (dotCount > 1) {
        // Ribuan ganda: 2.500.000
        val = parseFloat(cleaned.replace(/\./g, ''));
      } else if (commaCount > 1) {
        // Ribuan ganda: 2,500,000
        val = parseFloat(cleaned.replace(/,/g, ''));
      } else if (dotCount === 1 && commaCount === 1) {
        // Format campuran: 1.250,00 atau 1,250.00
        const lastSepIdx = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
        const decimalPart = cleaned.slice(lastSepIdx + 1);
        const integerPart = cleaned.slice(0, lastSepIdx).replace(/[.,]/g, '');
        if (decimalPart.length === 2) {
          // Desimal sen (Rp ... ,00)
          val = parseFloat(integerPart);
        } else {
          val = parseFloat(integerPart + decimalPart);
        }
      } else if (dotCount === 1) {
        // 191.475 atau 12.50
        const parts = cleaned.split('.');
        if (parts[1].length === 3) {
          // Ribuan: 191.475 -> 191475
          val = parseFloat(cleaned.replace(/\./g, ''));
        } else if (parts[1].length === 2 && parts[0].length >= 3) {
          // 15000.00 -> 15000
          val = parseFloat(parts[0]);
        } else {
          val = parseFloat(cleaned.replace(/\./g, ''));
        }
      } else if (commaCount === 1) {
        // 191,475 atau 191,00
        const parts = cleaned.split(',');
        if (parts[1].length === 3) {
          // Ribuan gaya POS: 191,475 -> 191475
          val = parseFloat(cleaned.replace(/,/g, ''));
        } else if (parts[1].length === 2) {
          // Desimal sen
          val = parseFloat(parts[0].replace(/\./g, ''));
        } else {
          val = parseFloat(cleaned.replace(/,/g, ''));
        }
      } else {
        val = parseFloat(cleaned);
      }

      // Filter nilai yang masuk akal untuk transaksi kasir (Rp 500 s/d Rp 50.000.000)
      if (!isNaN(val) && val >= 500 && val <= 50000000) {
        results.push(Math.round(val));
      }
    }

    return results;
  };

  // Keyword klasifikasi
  const subtotalKeywords = ['subtotal', 'sub total', 'sub-total', 'jumlah item', 'jumlah harga'];
  const grandTotalKeywords = [
    'grand total', 'total bayar', 'total tagihan', 'total akhir', 
    'total belanja', 'total amount', 'total', 'jumlah total', 'tagihan', 'tot.'
  ];
  const tenderKeywords = ['tunai', 'cash', 'bayar tunai', 'uang muka', 'dibayar', 'payment', 'qris', 'debit', 'kredit'];
  const changeKeywords = ['kembali', 'kembalian', 'change'];
  const taxKeywords = ['pajak', 'tax', 'ppn', 'pb1', 'service'];
  const discountKeywords = ['diskon', 'discount', 'potongan', 'promo', 'voucher'];

  // Penampung data terdeteksi
  const grandTotalCandidates: { val: number; line: string }[] = [];
  const subtotalCandidates: { val: number; line: string }[] = [];
  let tenderAmount = 0;
  let changeAmount = 0;
  let taxAmount = 0;
  let discountAmount = 0;
  const allDetectedAmounts: { val: number; line: string }[] = [];

  // Pindai setiap baris
  for (const rawLine of lines) {
    const cleaned = cleanLineForKeywords(rawLine);
    const nums = extractNumbersFromLine(rawLine);
    if (nums.length === 0) continue;

    nums.forEach(n => allDetectedAmounts.push({ val: n, line: rawLine }));

    const isChange = changeKeywords.some(k => cleaned.includes(k));
    const isTender = tenderKeywords.some(k => cleaned.includes(k)) && !isChange;
    const isTax = taxKeywords.some(k => cleaned.includes(k));
    const isDiscount = discountKeywords.some(k => cleaned.includes(k));
    const isSubtotal = subtotalKeywords.some(k => cleaned.includes(k)) && !isTax && !isDiscount;
    const isGrandTotal = grandTotalKeywords.some(k => cleaned.includes(k)) && !isSubtotal && !isTender && !isChange && !isTax && !isDiscount;

    if (isChange) {
      changeAmount = Math.max(changeAmount, ...nums);
    } else if (isTender) {
      tenderAmount = Math.max(tenderAmount, ...nums);
    } else if (isTax) {
      taxAmount = Math.max(taxAmount, ...nums);
    } else if (isDiscount) {
      discountAmount = Math.max(discountAmount, ...nums);
    } else if (isSubtotal) {
      nums.forEach(n => subtotalCandidates.push({ val: n, line: rawLine }));
    } else if (isGrandTotal) {
      nums.forEach(n => grandTotalCandidates.push({ val: n, line: rawLine }));
    }
  }

  // 2. Tentukan Total Belanja (Amount) dengan Hirarki Cerdas & Silang Matematika
  let detectedAmount = 0;

  // Uji Silang Matematika: Tunai - Kembalian = Total Belanja
  let mathDiff = 0;
  if (tenderAmount > 0 && changeAmount > 0 && tenderAmount > changeAmount) {
    mathDiff = tenderAmount - changeAmount;
  }

  // Prioritas 1: Jika kandidat Grand Total cocok persis dengan (Tunai - Kembalian)
  if (mathDiff > 0 && grandTotalCandidates.some(c => c.val === mathDiff)) {
    detectedAmount = mathDiff;
  }
  // Prioritas 2: Kandidat Grand Total eksplisit
  else if (grandTotalCandidates.length > 0) {
    // Ambil nilai terbesar dari baris grand total
    detectedAmount = Math.max(...grandTotalCandidates.map(c => c.val));
  }
  // Prioritas 3: Gunakan hasil (Tunai - Kembalian) jika ditemukan
  else if (mathDiff > 0) {
    detectedAmount = mathDiff;
  }
  // Prioritas 4: Subtotal + Pajak (- Diskon)
  else if (subtotalCandidates.length > 0) {
    const sub = Math.max(...subtotalCandidates.map(c => c.val));
    let calculated = sub;
    if (taxAmount > 0) calculated += taxAmount;
    if (discountAmount > 0 && discountAmount < sub) calculated -= discountAmount;
    detectedAmount = calculated;
  }
  // Prioritas 5: Cari nilai terbesar di antara baris angka (abaikan uang tunai bayar jika ada kembalian)
  else if (allDetectedAmounts.length > 0) {
    const sorted = allDetectedAmounts
      .filter(a => a.val !== tenderAmount)
      .sort((a, b) => b.val - a.val);
    if (sorted.length > 0) {
      detectedAmount = sorted[0].val;
    } else {
      detectedAmount = allDetectedAmounts[0].val;
    }
  }

  // 3. Ekstraksi Nama Toko / Merchant dari Header Struk
  const storeKeywords = [
    'cafe bee', 'cafe', 'coffee', 'restoran', 'resto', 'pertamina', 'apotek', 
    'laundry', 'supermarket', 'indomaret', 'alfamart', 'kopi', 'bakso', 
    'kuliner', 'hotel', 'mall', 'toko', 'warung', 'dapur', 'depot',
    'starbucks', 'breadtalk', 'jco', 'mart', 'mie'
  ];

  const metaKeywordsToSkip = [
    'tanggal', 'date', 'kasir', 'cashier', 'struk', 'nota', 'bon',
    'meja', 'table', 'no:', 'telp', 'phone', 'jalan', 'jl.', 'npwp', 'waktu',
    'order', 'antrian', 'invoice', 'customer', 'pelanggan', 'bill', 'receipt',
    'welcome', 'selamat datang', 'terima kasih', 'thank you',
    'beepos', 'bee.id', 'moka', 'pawoon', 'majoo', 'kasir pintar', 'qasir', 'supported by'
  ];

  let detectedStoreName = '';

  // Cari di 8 baris pertama
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Lewati baris metadata (tanggal, kasir, no telp, dsb)
    if (metaKeywordsToSkip.some(kw => lower.includes(kw))) continue;
    // Lewati baris yang memuat harga/angka banyak (karena itu baris item belanja)
    if (/\d+[\d.,]{3,}/.test(line)) continue;
    // Lewati jika terlalu pendek atau terlalu panjang
    if (line.length < 3 || line.length > 45) continue;
    if (/^\d+$/.test(line.replace(/[\s-]/g, ''))) continue;

    // Jika mengandung kata kunci toko, jadikan prioritas utama
    if (storeKeywords.some(kw => lower.includes(kw))) {
      detectedStoreName = line;
      break;
    }

    // Simpan baris pertama yang bersih sebagai kandidat nama toko
    if (!detectedStoreName && /[a-zA-Z]{3,}/.test(line)) {
      detectedStoreName = line;
    }
  }

  let detectedDescription = 'Nota Belanja';
  if (detectedStoreName) {
    const cleanStore = detectedStoreName.replace(/[^a-zA-Z0-9\s&.-]/g, '').trim();
    detectedDescription = `Nota ${cleanStore}`;
  }

  // 4. Deteksi Kategori Transaksi Berdasarkan Konten Teks
  const fullLower = text.toLowerCase();
  let detectedCategory = 'Belanja & Pribadi';

  if (
    fullLower.includes('kopi') || fullLower.includes('coffee') || fullLower.includes('cafe') ||
    fullLower.includes('bakso') || fullLower.includes('nasi') || fullLower.includes('ayam') ||
    fullLower.includes('mie') || fullLower.includes('resto') || fullLower.includes('kuliner') ||
    fullLower.includes('teh') || fullLower.includes('drink') || fullLower.includes('makan') ||
    fullLower.includes('burger') || fullLower.includes('pizza') || fullLower.includes('snack')
  ) {
    detectedCategory = 'Makanan & Minuman';
  } else if (
    fullLower.includes('pertamina') || fullLower.includes('spbu') || fullLower.includes('bensin') ||
    fullLower.includes('shell') || fullLower.includes('gojek') || fullLower.includes('grab') ||
    fullLower.includes('parkir') || fullLower.includes('tol')
  ) {
    detectedCategory = 'Transportasi';
  } else if (
    fullLower.includes('pln') || fullLower.includes('listrik') || fullLower.includes('pdam') ||
    fullLower.includes('pulsa') || fullLower.includes('kuota') || fullLower.includes('indihome') ||
    fullLower.includes('wifi') || fullLower.includes('token')
  ) {
    detectedCategory = 'Tagihan & Utilitas';
  } else if (
    fullLower.includes('apotek') || fullLower.includes('obat') || fullLower.includes('klinik') ||
    fullLower.includes('dokter') || fullLower.includes('sehat') || fullLower.includes('kimia farma')
  ) {
    detectedCategory = 'Kesehatan';
  } else if (
    fullLower.includes('bioskop') || fullLower.includes('cinema') || fullLower.includes('xxi') ||
    fullLower.includes('tiket') || fullLower.includes('game') || fullLower.includes('netflix') ||
    fullLower.includes('spotify')
  ) {
    detectedCategory = 'Hiburan & Liburan';
  } else if (
    fullLower.includes('indomaret') || fullLower.includes('alfamart') || fullLower.includes('supermarket') ||
    fullLower.includes('hypermart') || fullLower.includes('transmart') || fullLower.includes('grosir') ||
    fullLower.includes('toko')
  ) {
    detectedCategory = 'Belanja & Pribadi';
  } else {
    const { category } = getCategoryAndIcon(detectedDescription, 'pengeluaran');
    detectedCategory = category;
  }

  // 5. Ekstraksi Item Terdeteksi
  const detectedItems: string[] = [];
  lines.forEach(l => {
    const cl = cleanLineForKeywords(l);
    if (
      !grandTotalKeywords.some(k => cl.includes(k)) &&
      !tenderKeywords.some(k => cl.includes(k)) &&
      !changeKeywords.some(k => cl.includes(k)) &&
      !taxKeywords.some(k => cl.includes(k)) &&
      !metaKeywordsToSkip.some(k => cl.includes(k))
    ) {
      if (/\d+/.test(l) && /[a-zA-Z]{3,}/.test(l) && l.length < 50) {
        detectedItems.push(l);
      }
    }
  });

  return {
    amount: detectedAmount || 0,
    description: detectedDescription,
    category: detectedCategory,
    rawText: text,
    items: detectedItems.slice(0, 10),
    storeName: detectedStoreName,
    tax: taxAmount > 0 ? taxAmount : undefined,
    subtotal: subtotalCandidates.length > 0 ? Math.max(...subtotalCandidates.map(c => c.val)) : undefined,
    tender: tenderAmount > 0 ? tenderAmount : undefined,
    change: changeAmount > 0 ? changeAmount : undefined
  };
}
