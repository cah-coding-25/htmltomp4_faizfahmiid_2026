import { CategoryConfig } from '../types';

export const EXPENSE_CATEGORIES: CategoryConfig[] = [
  {
    name: 'Makanan & Minuman',
    color: '#F87171', // Red
    keywords: [
      'bakso', 'makan', 'kopi', 'minum', 'sate', 'nasgor', 'warteg', 'mie', 'jajan', 
      'boba', 'roti', 'cafe', 'restoran', 'kuliner', 'cimol', 'cilok', 'cilor', 'seblak', 
      'batagor', 'siomay', 'gorengan', 'martabak', 'ayam', 'bebek', 'soto', 'rawon', 
      'nasi', 'snack', 'cemilan', 'es', 'jus', 'teh', 'burger', 'pizza', 'donat', 'tahu', 'tempe'
    ],
    icon: 'Utensils',
  },
  {
    name: 'Transportasi',
    color: '#60A5FA', // Blue
    keywords: ['bensin', 'ojek', 'gojek', 'grab', 'mobil', 'motor', 'toll', 'tol', 'parkir', 'tiket', 'kereta', 'pesawat', 'bus', 'travel'],
    icon: 'Car',
  },
  {
    name: 'Belanja & Pribadi',
    color: '#FBBF24', // Yellow
    keywords: ['belanja', 'baju', 'shopee', 'tokopedia', 'celana', 'sepatu', 'skincare', 'makeup', 'salon', 'potong rambut', 'mall', 'supermarket'],
    icon: 'ShoppingBag',
  },
  {
    name: 'Tagihan & Utilitas',
    color: '#34D399', // Green
    keywords: ['kos', 'kontrakan', 'listrik', 'air', 'pdam', 'wifi', 'internet', 'pulsa', 'kuota', 'langganan', 'netflix', 'spotify', 'asuransi', 'pajak'],
    icon: 'ReceiptText',
  },
  {
    name: 'Hiburan & Liburan',
    color: '#A78BFA', // Purple
    keywords: ['nonton', 'bioskop', 'game', 'topup', 'liburan', 'hotel', 'wisata', 'konser', 'karaoke', 'healing'],
    icon: 'Gamepad2',
  },
  {
    name: 'Kesehatan',
    color: '#FB7185', // Rose
    keywords: ['obat', 'dokter', 'rs', 'rumah sakit', 'klinik', 'vitamin', 'apotek', 'sakit', 'gigi'],
    icon: 'HeartPulse',
  },
  {
    name: 'Lain-lain',
    color: '#9CA3AF', // Gray
    keywords: [],
    icon: 'Coins',
  },
];

export const INCOME_CATEGORIES: CategoryConfig[] = [
  {
    name: 'Saldo Awal & Kas',
    color: '#059669', // Emerald
    keywords: ['saldo awal', 'saldo kas', 'tabungan', 'uang saku', 'modal', 'topup', 'isi saldo', 'setor'],
    icon: 'Wallet',
  },
  {
    name: 'Gaji & Pendapatan Tetap',
    color: '#10B981', // Emerald
    keywords: ['gaji', 'salary', 'bulanan', 'upah', 'pemasukan utama'],
    icon: 'Briefcase',
  },
  {
    name: 'Freelance & Sampingan',
    color: '#3B82F6', // Blue
    keywords: ['freelance', 'sampingan', 'proyek', 'project', 'desain', 'coding', 'jasa'],
    icon: 'Laptop',
  },
  {
    name: 'Hasil Investasi & Cuan',
    color: '#8B5CF6', // Violet
    keywords: ['investasi', 'saham', 'reksadana', 'crypto', 'cuan', 'bunga', 'dividen', 'untung'],
    icon: 'TrendingUp',
  },
  {
    name: 'Penjualan & Bisnis',
    color: '#F59E0B', // Amber
    keywords: ['jualan', 'dagang', 'bisnis', 'laba', 'omset', 'olshop', 'toko'],
    icon: 'Store',
  },
  {
    name: 'Pemberian & Transfer',
    color: '#EC4899', // Pink
    keywords: ['transfer', 'kiriman', 'orang tua', 'hadiah', 'angpao', 'thr', 'gift'],
    icon: 'Gift',
  },
  {
    name: 'Pemasukan Lain',
    color: '#6B7280', // Slate
    keywords: [],
    icon: 'DollarSign',
  },
];

export function getCategoryAndIcon(description: string, type: 'pemasukan' | 'pengeluaran') {
  const descLower = description.toLowerCase();
  const categories = type === 'pemasukan' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  for (const cat of categories) {
    if (cat.keywords.some((kw) => descLower.includes(kw))) {
      return { category: cat.name, color: cat.color, icon: cat.icon };
    }
  }

  // Fallbacks
  const fallback = type === 'pemasukan' ? INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1] : EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  return { category: fallback.name, color: fallback.color, icon: fallback.icon };
}
