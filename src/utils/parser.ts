import { getCategoryAndIcon } from './categories';

interface ParsedResult {
  success: boolean;
  type: 'pemasukan' | 'pengeluaran';
  amount: number;
  description: string;
  category: string;
}

export function parseTransactionText(text: string): ParsedResult {
  const cleanText = text.trim().toLowerCase();

  // 1. Determine Transaction Type
  let type: 'pemasukan' | 'pengeluaran' = 'pengeluaran'; // Default to expense
  
  const incomeKeywords = [
    'gaji', 'masuk', 'terima', 'pemasukan', 'transfer', 'freelance', 
    'sampingan', 'bonus', 'untung', 'dapat', 'cuan', 'laba', 'plus', '+',
    'saldo awal', 'saldo kas', 'tabungan', 'uang saku', 'modal', 'topup', 'isi saldo', 'setor'
  ];
  const expenseKeywords = [
    'pengeluaran', 'beli', 'bayar', 'untuk', 'makan', 'bakso', 'kopi', 
    'bensin', 'pulsa', 'listrik', 'belanja', 'jajan', 'ongkir', 'kos', 
    'tiket', 'nonton', 'keluar', 'minum', 'gojek', 'grab', 'shopee', 'tokopedia', 
    'pribadi', 'bayar', 'minus', '-'
  ];

  // Check prefix sign
  if (cleanText.startsWith('+')) {
    type = 'pemasukan';
  } else if (cleanText.startsWith('-')) {
    type = 'pengeluaran';
  } else {
    // Check keyword frequency/presence
    const hasIncomeKeyword = incomeKeywords.some(kw => {
      if (kw === '+') return false;
      return cleanText.includes(kw);
    });
    const hasExpenseKeyword = expenseKeywords.some(kw => {
      if (kw === '-') return false;
      return cleanText.includes(kw);
    });

    if (hasIncomeKeyword && !hasExpenseKeyword) {
      type = 'pemasukan';
    } else if (hasExpenseKeyword && !hasIncomeKeyword) {
      type = 'pengeluaran';
    } else if (hasIncomeKeyword && hasExpenseKeyword) {
      // If both exist, check which comes first or priority
      const firstIncomeIndex = Math.min(...incomeKeywords.map(kw => cleanText.indexOf(kw)).filter(i => i >= 0));
      const firstExpenseIndex = Math.min(...expenseKeywords.map(kw => cleanText.indexOf(kw)).filter(i => i >= 0));
      if (firstIncomeIndex < firstExpenseIndex) {
        type = 'pemasukan';
      } else {
        type = 'pengeluaran';
      }
    }
  }

  // 2. Extract Amount and Suffix
  // Regex to find a number (integer or decimal like 1.5, 1,5, or thousands separated 1.500.000)
  // followed by optional suffix: jt, juta, k, rb, ribu, r, m, miliar
  const amountRegex = /(?:rp\.?\s*)?(\d+[\d.,]*)\s*(juta|miliar|jt|ribu|rb|k|m|r)?\b/gi;
  let match;
  let parsedAmount = 0;
  let originalAmountText = '';
  let highestVal = 0;

  // We loop to find the largest or most prominent match, usually the first valid money figure
  while ((match = amountRegex.exec(cleanText)) !== null) {
    const rawNumber = match[1];
    const suffix = match[2] ? match[2].toLowerCase() : '';
    
    // Normalize number string:
    // If it has a comma/dot followed by a suffix (like 2,5jt or 2.5jt), treat it as decimal
    let numVal = 0;
    if (suffix) {
      const normalizedNum = rawNumber.replace(/,/g, '.');
      numVal = parseFloat(normalizedNum);
    } else {
      // Without suffix, decide if dots are thousands separators or decimal points
      // In Indonesian, dots in "150.000" are thousands separators.
      // If there are multiple dots (e.g. 1.000.000), they are thousands separators.
      // If there is one dot and exactly three digits after it (e.g. 4.000), it's a thousands separator.
      // If there's one dot and 1 or 2 digits (e.g. 12.5), it's a decimal point.
      const hasMultipleDots = (rawNumber.match(/\./g) || []).length > 1;
      const hasCommas = rawNumber.includes(',');
      
      if (hasMultipleDots) {
        // Clear all dots, it's thousands separator
        numVal = parseFloat(rawNumber.replace(/\./g, ''));
      } else if (hasCommas) {
        // e.g., 2.500,50 (european/indonesian style) or 2500,50
        // Replace all dots (thousands) then replace comma with dot (decimal)
        const noDots = rawNumber.replace(/\./g, '');
        const decimalStandard = noDots.replace(/,/g, '.');
        numVal = parseFloat(decimalStandard);
      } else {
        // Single dot or no dots
        const dotIndex = rawNumber.indexOf('.');
        if (dotIndex !== -1) {
          const digitsAfterDot = rawNumber.length - 1 - dotIndex;
          if (digitsAfterDot === 3) {
            // Thousands separator (e.g., 4.000 -> 4000)
            numVal = parseFloat(rawNumber.replace(/\./g, ''));
          } else {
            // Decimal point (e.g., 12.5 -> 12.5, which is rare for raw IDR without suffix, but possible)
            numVal = parseFloat(rawNumber);
          }
        } else {
          // Plain integer
          numVal = parseFloat(rawNumber);
        }
      }
    }

    if (isNaN(numVal)) continue;

    // Apply suffix multiplier
    let multiplier = 1;
    if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu' || suffix === 'r') {
      multiplier = 1000;
    } else if (suffix === 'jt' || suffix === 'juta') {
      multiplier = 1000000;
    } else if (suffix === 'm' || suffix === 'miliar') {
      multiplier = 1000000000;
    }

    const finalVal = numVal * multiplier;
    if (finalVal > highestVal) {
      highestVal = finalVal;
      parsedAmount = finalVal;
      originalAmountText = match[0]; // Full match string
    }
  }

  if (parsedAmount === 0) {
    return {
      success: false,
      type: 'pengeluaran',
      amount: 0,
      description: text,
      category: 'Lain-lain',
    };
  }

  // 3. Extract and Clean Description
  // We remove the matched amount string and helper words
  let description = text;
  
  // Remove the matched amount phrase from description
  if (originalAmountText) {
    // Create a regex to replace the exact matched amount case-insensitively
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaceRegex = new RegExp(escapeRegExp(originalAmountText), 'i');
    description = description.replace(replaceRegex, '');
  }

  // Clean Indonesian filler words and symbols
  const noiseWords = [
    'sebesar', 'untuk', 'beli', 'bayar', 'pemasukan', 'pengeluaran', 
    'nominal', 'sebanyak', 'harga', 'rupiah', 'rp', 'buat', 'jajan', 
    'uang', 'masuk', 'keluar', 'dapat', 'terima', 'plus', 'minus', '+', '-'
  ];

  let descWords = description.split(/\s+/);
  descWords = descWords.filter(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanWord.length > 0 && !noiseWords.includes(cleanWord);
  });

  // Reconstruct description
  let cleanedDesc = descWords.join(' ');
  
  // Capitalize first letters
  cleanedDesc = cleanedDesc
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim();

  // Fallbacks if description is empty after cleaning
  if (!cleanedDesc) {
    cleanedDesc = type === 'pemasukan' ? 'Pemasukan Umum' : 'Pengeluaran Umum';
  }

  // Determine category
  const { category } = getCategoryAndIcon(cleanedDesc, type);

  return {
    success: true,
    type,
    amount: parsedAmount,
    description: cleanedDesc,
    category,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
