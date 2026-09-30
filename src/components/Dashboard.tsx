import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Search,
  Filter,
  Trash2,
  Download,
  Calendar,
  Layers,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Gamepad2,
  HeartPulse,
  Coins,
  Briefcase,
  Laptop,
  Store,
  Gift,
  AlertCircle,
  FileText,
  Pencil,
  Plus,
  X,
  Check,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Transaction } from '../types';
import { formatRupiah } from '../utils/parser';
import { generatePDFReport } from '../utils/pdfGenerator';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onDeleteMultipleTransactions?: (ids: string[]) => void;
  onClearTransactions: () => void;
  onEditTransaction?: (tx: Transaction) => void;
  onAddTransaction?: (tx: Transaction) => void;
}

// Map icon string to Lucide component
const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'Utensils': return <Utensils className="w-4 h-4" />;
    case 'Car': return <Car className="w-4 h-4" />;
    case 'ShoppingBag': return <ShoppingBag className="w-4 h-4" />;
    case 'ReceiptText':
    case 'Receipt': return <Receipt className="w-4 h-4" />;
    case 'Gamepad2': return <Gamepad2 className="w-4 h-4" />;
    case 'HeartPulse': return <HeartPulse className="w-4 h-4" />;
    case 'Coins': return <Coins className="w-4 h-4" />;
    case 'Briefcase': return <Briefcase className="w-4 h-4" />;
    case 'Laptop': return <Laptop className="w-4 h-4" />;
    case 'Store': return <Store className="w-4 h-4" />;
    case 'Gift': return <Gift className="w-4 h-4" />;
    default: return <Coins className="w-4 h-4" />;
  }
};

const indonesianMonths = [
  { value: '1', name: 'Januari' },
  { value: '2', name: 'Februari' },
  { value: '3', name: 'Maret' },
  { value: '4', name: 'April' },
  { value: '5', name: 'Mei' },
  { value: '6', name: 'Juni' },
  { value: '7', name: 'Juli' },
  { value: '8', name: 'Agustus' },
  { value: '9', name: 'September' },
  { value: '10', name: 'Oktober' },
  { value: '11', name: 'November' },
  { value: '12', name: 'Desember' },
];

const daysArray = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

export default function Dashboard({ 
  transactions, 
  onDeleteTransaction, 
  onDeleteMultipleTransactions, 
  onClearTransactions,
  onEditTransaction,
  onAddTransaction
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pemasukan' | 'pengeluaran'>('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmFilterClear, setConfirmFilterClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleExecuteClear = async () => {
    setIsClearing(true);
    try {
      await onClearTransactions();
    } finally {
      setIsClearing(false);
      setConfirmClear(false);
    }
  };

  // Modal State untuk Tambah / Edit Transaksi (CRUD)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalDesc, setModalDesc] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalType, setModalType] = useState<'pemasukan' | 'pengeluaran'>('pengeluaran');
  const [modalCategory, setModalCategory] = useState('Makanan');
  const [modalSource, setModalSource] = useState<'web' | 'telegram'>('web');

  const openAddModal = () => {
    setEditingId(null);
    setModalDesc('');
    setModalAmount('');
    setModalType('pengeluaran');
    setModalCategory('Makanan');
    setModalSource('web');
    setIsModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingId(tx.id);
    setModalDesc(tx.description);
    setModalAmount(String(tx.amount));
    setModalType(tx.type);
    setModalCategory(tx.category || (tx.type === 'pemasukan' ? 'Gaji' : 'Makanan'));
    setModalSource(tx.source || 'web');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDesc = modalDesc.trim();
    const numAmount = Math.abs(parseFloat(modalAmount.replace(/[^0-9.]/g, ''))) || 0;

    if (!cleanDesc || numAmount <= 0) return;

    if (editingId) {
      // Mode Edit
      const existing = transactions.find(t => t.id === editingId);
      if (existing && onEditTransaction) {
        onEditTransaction({
          ...existing,
          description: cleanDesc,
          amount: numAmount,
          type: modalType,
          category: modalCategory,
        });
      }
    } else {
      // Mode Tambah Baru
      if (onAddTransaction) {
        onAddTransaction({
          id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          date: new Date().toISOString(),
          type: modalType,
          amount: numAmount,
          description: cleanDesc,
          category: modalCategory,
          source: 'web'
        });
      }
    }

    setIsModalOpen(false);
  };

  // Available Years calculated from transactions
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach((t) => {
      try {
        const year = new Date(t.date).getFullYear().toString();
        years.add(year);
      } catch (e) {
        // ignore invalid dates
      }
    });
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // 1. Calculate General Financial KPIs
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach((t) => {
      if (t.type === 'pemasukan') {
        income += t.amount;
      } else {
        expense += t.amount;
      }
    });
    return {
      income,
      expense,
      balance: income - expense,
      savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
    };
  }, [transactions]);

  // 2. Format Data for Area Chart (Cash Flow Progression)
  const cashFlowData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    // Sort transactions in ascending order (oldest first) to track cumulative balance
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentBalance = 0;
    return sorted.map((t) => {
      if (t.type === 'pemasukan') {
        currentBalance += t.amount;
      } else {
        currentBalance -= t.amount;
      }
      
      const formattedDate = new Date(t.date).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      });

      return {
        tanggal: formattedDate,
        'Sisa Saldo': currentBalance,
        Nominal: t.amount,
        type: t.type,
        Keterangan: t.description,
      };
    });
  }, [transactions]);

  // 3. Format Data for Pie Chart (Expense Categories Breakdown)
  const expensePieData = useMemo(() => {
    const categoriesMap: { [key: string]: { name: string; value: number; color: string } } = {};
    
    // Initialize standard categories for nice visual colors
    const colorsMap: { [key: string]: string } = {
      'Makanan & Minuman': '#F87171',
      'Transportasi': '#60A5FA',
      'Belanja & Pribadi': '#FBBF24',
      'Tagihan & Utilitas': '#34D399',
      'Hiburan & Liburan': '#A78BFA',
      'Kesehatan': '#FB7185',
      'Lain-lain': '#9CA3AF',
    };

    transactions
      .filter((t) => t.type === 'pengeluaran')
      .forEach((t) => {
        const cat = t.category || 'Lain-lain';
        if (!categoriesMap[cat]) {
          categoriesMap[cat] = {
            name: cat,
            value: 0,
            color: colorsMap[cat] || '#6B7280',
          };
        }
        categoriesMap[cat].value += t.amount;
      });

    return Object.values(categoriesMap).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 4. Monthly/Weekly Bar Chart data
  const barChartData = useMemo(() => {
    // Group transactions by category to show dynamic breakdown
    const categoriesMap: { [key: string]: { Pemasukan: number; Pengeluaran: number } } = {};
    
    transactions.forEach((t) => {
      const cat = t.category || 'Lain-lain';
      if (!categoriesMap[cat]) {
        categoriesMap[cat] = { Pemasukan: 0, Pengeluaran: 0 };
      }
      if (t.type === 'pemasukan') {
        categoriesMap[cat].Pemasukan += t.amount;
      } else {
        categoriesMap[cat].Pengeluaran += t.amount;
      }
    });

    return Object.entries(categoriesMap)
      .map(([name, data]) => ({
        name,
        Pemasukan: data.Pemasukan,
        Pengeluaran: data.Pengeluaran,
      }))
      .filter(item => item.Pemasukan > 0 || item.Pengeluaran > 0)
      .slice(0, 5); // top 5
  }, [transactions]);

  // 5. Filter Transactions List
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch =
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchType =
        typeFilter === 'all' || t.type === typeFilter;

      let matchYear = true;
      let matchMonth = true;
      let matchDay = true;

      try {
        const tDate = new Date(t.date);
        const tYear = tDate.getFullYear().toString();
        const tMonth = (tDate.getMonth() + 1).toString();
        const tDay = tDate.getDate().toString();

        matchYear = yearFilter === 'all' || tYear === yearFilter;
        matchMonth = monthFilter === 'all' || tMonth === monthFilter;
        matchDay = dayFilter === 'all' || tDay === dayFilter;
      } catch (e) {
        // ignore date parse errors
      }

      return matchSearch && matchType && matchYear && matchMonth && matchDay;
    });
  }, [transactions, searchTerm, typeFilter, yearFilter, monthFilter, dayFilter]);

  const hasActiveFilters = yearFilter !== 'all' || monthFilter !== 'all' || dayFilter !== 'all' || searchTerm !== '' || typeFilter !== 'all';

  // Dynamic period title based on selected filters
  const currentPeriodTitle = useMemo(() => {
    let titleParts = [];
    if (dayFilter !== 'all') titleParts.push(`Hari ${dayFilter}`);
    if (monthFilter !== 'all') {
      const monthName = indonesianMonths.find(m => m.value === monthFilter)?.name || `Bulan ${monthFilter}`;
      titleParts.push(monthName);
    }
    if (yearFilter !== 'all') titleParts.push(yearFilter);
    
    if (titleParts.length === 0) {
      return 'Semua Periode';
    }
    return titleParts.join(' ');
  }, [dayFilter, monthFilter, yearFilter]);

  // Export to PDF report
  const exportToPDF = () => {
    if (filteredTransactions.length === 0) return;
    generatePDFReport(filteredTransactions, currentPeriodTitle);
  };

  // Export to CSV function
  const exportToCSV = () => {
    if (transactions.length === 0) return;
    
    const headers = ['ID', 'Tanggal', 'Tipe', 'Jumlah', 'Deskripsi', 'Kategori', 'Sumber'];
    const rows = transactions.map((t) => [
      t.id,
      new Date(t.date).toLocaleString('id-ID'),
      t.type,
      t.amount,
      t.description.replace(/,/g, ';'),
      t.category,
      t.source,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catatkeu_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom tooltip for Area Chart
  const CustomAreaTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{data.tanggal}</p>
          <p className="text-slate-500 font-medium">Transaksi: <span className="text-slate-700 dark:text-slate-300">{data.Keterangan}</span></p>
          <p className={`font-semibold ${data.type === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
            Nominal: {data.type === 'pemasukan' ? '+' : '-'} {formatRupiah(data.Nominal)}
          </p>
          <p className="font-bold text-slate-900 dark:text-white border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
            Sisa Saldo: {formatRupiah(data['Sisa Saldo'])}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 space-y-6">
      
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Analisis Keuangan Profesional</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Dasbor visualisasi transaksi keuangan Anda dari web maupun Telegram.</p>
        </div>
        
        {transactions.length > 0 && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={exportToCSV}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ekspor PDF ({currentPeriodTitle})</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Balance Card */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border-l-4 border-l-indigo-500 border border-y-slate-200/60 border-r-slate-200/60 dark:border-y-slate-800/80 dark:border-r-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-400 font-medium block">SISA SALDO</span>
            <span className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100 truncate block">
              {formatRupiah(totals.balance)}
            </span>
          </div>
        </div>

        {/* Total Income Card */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-y-slate-200/60 border-r-slate-200/60 dark:border-y-slate-800/80 dark:border-r-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-400 font-medium block">TOTAL PEMASUKAN</span>
            <span className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate block">
              {formatRupiah(totals.income)}
            </span>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border-l-4 border-l-rose-500 border border-y-slate-200/60 border-r-slate-200/60 dark:border-y-slate-800/80 dark:border-r-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-400 font-medium block">TOTAL PENGELUARAN</span>
            <span className="text-lg font-mono font-bold text-rose-600 dark:text-rose-400 truncate block">
              {formatRupiah(totals.expense)}
            </span>
          </div>
        </div>

        {/* Savings Rate Card */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border-l-4 border-l-amber-500 border border-y-slate-200/60 border-r-slate-200/60 dark:border-y-slate-800/80 dark:border-r-slate-800/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-slate-400 font-medium block">TINGKAT HEMAT</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100">
                {totals.savingsRate}%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">dari pendapatan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Graphs Area */}
      {transactions.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-12 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Belum Ada Grafik Terbuat</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Silakan tambahkan beberapa transaksi di kolom chat terlebih dahulu untuk melihat grafik analisis profesional yang canggih ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          
          {/* Cash Flow Progression - 2/3 width on large screens */}
          <div className="bg-white dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm lg:col-span-2 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span>Grafik Sisa Saldo Real-Time</span>
            </h3>
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="tanggal" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString('id-ID')}k`}
                  />
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Area type="monotone" dataKey="Sisa Saldo" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expense Categories Breakdown - 1/3 width */}
          <div className="bg-white dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm flex flex-col justify-between min-w-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Distribusi Pengeluaran</span>
              </h3>
              
              {expensePieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-center text-xs text-slate-400">
                  Belum ada data pengeluaran dicatat.
                </div>
              ) : (
                <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mt-2 min-w-0">
                  {/* Pie Graphic */}
                  <div className="h-44 w-44 shrink-0 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {expensePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [formatRupiah(value), 'Jumlah']}
                          contentStyle={{ borderRadius: '10px', fontSize: '11px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend list */}
                  <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto pr-1 min-w-0">
                    {expensePieData.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex items-center justify-between text-xs min-w-0">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-slate-600 dark:text-slate-400 truncate font-medium">{entry.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 ml-2 shrink-0">
                          {formatRupiah(entry.value)}
                        </span>
                      </div>
                    ))}
                    {expensePieData.length > 5 && (
                      <div className="text-[10px] text-center text-slate-400 font-medium pt-1">
                        + {expensePieData.length - 5} Kategori Lainnya
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Breakdown Comparison bar chart */}
          <div className="bg-white dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm lg:col-span-3 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Arus Kas per Kategori Utama</span>
            </h3>
            <div className="h-60 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString('id-ID')}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatRupiah(value), 'Jumlah']}
                    contentStyle={{ borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Transaction List & Search */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <span>Riwayat Transaksi Lengkap</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 text-[10px] font-bold">
                {transactions.length} Total
              </span>
            </h3>

            {onAddTransaction && (
              <button
                onClick={openAddModal}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Transaksi</span>
              </button>
            )}

            {transactions.length > 0 && onClearTransactions && (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 active:scale-95 rounded-xl text-xs font-bold transition shadow-xs"
                title="Kosongkan seluruh data transaksi dan reset saldo kas ke Rp 0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan Transaksi</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari deskripsi / kategori..."
                className="w-full sm:w-48 pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Type filter */}
            <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition ${
                  typeFilter === 'all'
                    ? 'bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setTypeFilter('pemasukan')}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition ${
                  typeFilter === 'pemasukan'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Masuk
              </button>
              <button
                onClick={() => setTypeFilter('pengeluaran')}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition ${
                  typeFilter === 'pengeluaran'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Keluar
              </button>
            </div>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-100 dark:border-slate-900/60 flex flex-wrap items-center gap-3">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center space-x-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Tanggal:</span>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-2 min-w-[240px]">
            {/* Day */}
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Semua Hari</option>
              {daysArray.map((d) => (
                <option key={d} value={d}>Tgl {d}</option>
              ))}
            </select>

            {/* Month */}
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Semua Bulan</option>
              {indonesianMonths.map((m) => (
                <option key={m.value} value={m.value}>{m.name}</option>
              ))}
            </select>

            {/* Year */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Semua Tahun</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {(yearFilter !== 'all' || monthFilter !== 'all' || dayFilter !== 'all') && (
            <button
              onClick={() => {
                setDayFilter('all');
                setMonthFilter('all');
                setYearFilter('all');
              }}
              className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-rose-500 font-bold uppercase transition shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        {/* Transactions Table / Mobile Cards */}
        <div className="border border-slate-100 dark:border-slate-900 rounded-xl overflow-hidden">
          {/* Desktop/Tablet View (Visible on sm screens and up) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50/70 dark:bg-slate-900/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-900">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Keterangan / Kategori</th>
                  <th className="px-4 py-3">Sumber</th>
                  <th className="px-4 py-3 text-right">Jumlah</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900/50 font-medium">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada transaksi yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t, idx) => {
                    const dateFormatted = new Date(t.date).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={t.id ? `${t.id}_${idx}` : `tx_${idx}`} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition">
                        {/* Date */}
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>{dateFormatted}</span>
                          </div>
                        </td>

                        {/* Description / Category */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {t.description}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
                            <span className="inline-block">{t.category}</span>
                          </div>
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {t.source === 'telegram' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                              Telegram Bot
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                              Aplikasi Web
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-mono font-bold text-sm ${
                            t.type === 'pemasukan' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {t.type === 'pemasukan' ? '+' : '-'} {formatRupiah(t.amount)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            {onEditTransaction && (
                              <button
                                onClick={() => openEditModal(t)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition"
                                title="Edit Transaksi"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteTransaction(t.id)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-rose-500 rounded-lg transition"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Cards (Visible only on mobile) */}
          <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-900/50 bg-white dark:bg-slate-950">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Tidak ada transaksi yang cocok.
              </div>
            ) : (
              filteredTransactions.map((t) => {
                const dateFormatted = new Date(t.date).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {t.description}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-slate-400">
                        <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-medium">{t.category}</span>
                        <span>•</span>
                        <span>{dateFormatted}</span>
                      </div>
                      <div className="mt-1.5">
                        {t.source === 'telegram' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                            Telegram
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                            Aplikasi Web
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 space-y-2">
                      <span className={`font-mono font-bold text-sm ${
                        t.type === 'pemasukan' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {t.type === 'pemasukan' ? '+' : '-'} {formatRupiah(t.amount)}
                      </span>
                      <div className="flex items-center space-x-1">
                        {onEditTransaction && (
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-rose-500 rounded-lg transition"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Clear Data Trigger */}
        {transactions.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-900/50">
            {/* Filtered Delete Button */}
            {hasActiveFilters && filteredTransactions.length > 0 ? (
              <div className="w-full sm:w-auto">
                {!confirmFilterClear ? (
                  <button
                    onClick={() => setConfirmFilterClear(true)}
                    className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition border border-rose-200/50 dark:border-rose-900/30"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span>Hapus {filteredTransactions.length} Hasil Filter</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 text-xs bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl border border-rose-200/50 dark:border-rose-900/50">
                    <span className="text-rose-700 dark:text-rose-300 font-medium text-[10px]">Hapus {filteredTransactions.length} item?</span>
                    <button
                      onClick={async () => {
                        const idsToDelete = filteredTransactions.map(t => t.id);
                        if (onDeleteMultipleTransactions) {
                          await onDeleteMultipleTransactions(idsToDelete);
                        } else {
                          for (const id of idsToDelete) {
                            onDeleteTransaction(id);
                          }
                        }
                        setConfirmFilterClear(false);
                      }}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold text-[9px] transition"
                    >
                      Ya
                    </button>
                    <button
                      onClick={() => setConfirmFilterClear(false)}
                      className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md font-semibold text-[9px] transition"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:block" /> // Spacer
            )}

            <button
              onClick={() => setConfirmClear(true)}
              className="text-[10px] text-slate-400 hover:text-rose-500 font-semibold uppercase tracking-wider transition shrink-0 flex items-center space-x-1 py-1 px-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="w-3 h-3" />
              <span>Kosongkan Semua Transaksi (Reset Rp 0)</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Transaksi (CRUD Lengkap) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Tipe Transaksi */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Tipe Transaksi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType('pengeluaran')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      modalType === 'pengeluaran'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span>Pengeluaran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalType('pemasukan')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      modalType === 'pemasukan'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Pemasukan</span>
                  </button>
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Keterangan / Deskripsi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Makan siang, Gaji bulanan, Bensin"
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Nominal */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Nominal (Rp)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 25000"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Kategori
                </label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {modalType === 'pengeluaran' ? (
                    <>
                      <option value="Makanan">Makanan & Minuman</option>
                      <option value="Transportasi">Transportasi / Bensin</option>
                      <option value="Belanja">Belanja / Kebutuhan</option>
                      <option value="Tagihan">Tagihan & Langganan</option>
                      <option value="Hiburan">Hiburan & Rekreasi</option>
                      <option value="Kesehatan">Kesehatan & Medis</option>
                      <option value="Pendidikan">Pendidikan / Buku</option>
                      <option value="Lain-lain">Pengeluaran Lainnya</option>
                    </>
                  ) : (
                    <>
                      <option value="Gaji">Gaji / Upah</option>
                      <option value="Bisnis">Usaha / Bisnis</option>
                      <option value="Investasi">Investasi / Profit</option>
                      <option value="Bonus">Bonus & THR</option>
                      <option value="Hadiah">Hadiah / Hibah</option>
                      <option value="Lain-lain">Pemasukan Lainnya</option>
                    </>
                  )}
                </select>
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingId ? 'Simpan Perubahan' : 'Tambah Transaksi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Konfirmasi Kosongkan Seluruh Transaksi (Reset ke Rp 0) */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Kosongkan Seluruh Transaksi?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reset saldo kas menjadi Rp 0 bersih.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Anda akan menghapus <b>{transactions.length} catatan transaksi</b> secara permanen.
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <li>Seluruh riwayat transaksi di <b>Website</b> akan dihapus.</li>
                <li>Data di <b>Google Spreadsheet</b> akan dibersihkan.</li>
                <li>Sisa Saldo Kas akan kembali menjadi <b>Rp 0</b>.</li>
                <li>Cocok jika Anda ingin memulai pembukuan baru dari awal.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                disabled={isClearing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteClear}
                disabled={isClearing}
                className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
              >
                {isClearing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isClearing ? 'Sedang Membersihkan...' : 'Ya, Kosongkan Bersih (Reset Rp 0)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
