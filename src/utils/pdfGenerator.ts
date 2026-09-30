import { jsPDF } from 'jspdf';
import { Transaction } from '../types';
import { formatRupiah } from './parser';

/**
 * Generates and downloads a beautifully styled PDF financial report
 * @param transactions The list of transactions to include in the report
 * @param periodTitle The name of the filtered period (e.g., "Juni 2026", "Minggu Ini")
 */
export function generatePDFReport(transactions: Transaction[], periodTitle: string): void {
  // Sort chronologically (oldest first) for standard statement style
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate totals
  let totalIncome = 0;
  let totalExpense = 0;
  sortedTransactions.forEach((t) => {
    if (t.type === 'pemasukan') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }
  });
  const balance = totalIncome - totalExpense;

  // Initialize jsPDF (A4, portrait, millimeters)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15; // Left/Right margin for elegant breathing room
  const contentWidth = pageWidth - margin * 2; // 180mm

  let currentY = 15;

  // Helper to check for page overflow
  const checkPageOverflow = (heightNeeded: number, isTableSection: boolean = false) => {
    if (currentY + heightNeeded > pageHeight - 15) {
      doc.addPage();
      currentY = 15;
      drawFooter(doc, pageWidth, pageHeight, margin);
      if (isTableSection) {
        drawTableHeader(currentY);
        currentY += 8;
      }
      return true;
    }
    return false;
  };

  // Helper for footer
  const drawFooter = (pdf: jsPDF, w: number, h: number, m: number) => {
    pdf.saveGraphicsState();
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184); // slate-400
    
    // Page footer line
    pdf.setDrawColor(241, 245, 249); // slate-100
    pdf.line(m, h - 12, w - m, h - 12);
    
    pdf.text('Laporan Keuangan Otomatis FahKeu — by Faiz_Fahmi_Id since 2026', m, h - 8);
    
    const pageNum = pdf.getNumberOfPages();
    pdf.text(`Halaman ${pageNum}`, w - m - doc.getTextWidth(`Halaman ${pageNum}`), h - 8);
    pdf.restoreGraphicsState();
  };

  // --- HEADER SECTION ---
  // Background Accent bar (Top)
  doc.setFillColor(15, 23, 42); // slate-900 (FahKeu Primary Theme)
  doc.rect(0, 0, pageWidth, 5, 'F');

  currentY = 14;

  // Logo Badge (small rounded rectangle with 'FK') - Clean tech aesthetic
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.roundedRect(margin, currentY - 5, 8, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255); // White text
  doc.text('FK', margin + 1.5, currentY + 0.5);

  // Branding Text next to Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('FahKeu', margin + 11, currentY + 1.5);

  // Subtitle below Logo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('PENCATAT KEUANGAN PINTAR & INTERAKTIF', margin, currentY + 6.5);

  // Metadata block (Right side aligned, beautifully balanced)
  const filterStr = `PERIODE REKAP: ${periodTitle.toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(filterStr, pageWidth - margin - doc.getTextWidth(filterStr), currentY - 1);

  const dateStr = `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} WIB`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), currentY + 3.5);

  currentY += 10;

  // Horizontal separator line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // --- FINANCIAL OVERVIEW TITLE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RINGKASAN LAPORAN KEUANGAN', margin, currentY);

  currentY += 4;

  // --- STATS CARDS (GRID LAYOUT) ---
  const cardWidth = contentWidth / 3 - 3; // ~57mm
  const cardHeight = 22;

  // Card 1: Sisa Saldo (Left)
  const card1X = margin;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(card1X, currentY, cardWidth, cardHeight, 3, 3, 'FD');
  // Decorative left border
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(card1X, currentY, 1.5, cardHeight, 'F');
  // Content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('SISA SALDO', card1X + 4, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(formatRupiah(balance), card1X + 4, currentY + 14);

  // Card 2: Total Pemasukan (Middle)
  const card2X = margin + cardWidth + 4.5;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 3, 3, 'FD');
  // Decorative left border
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(card2X, currentY, 1.5, cardHeight, 'F');
  // Content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('TOTAL PEMASUKAN', card2X + 4, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`+ ${formatRupiah(totalIncome)}`, card2X + 4, currentY + 14);

  // Card 3: Total Pengeluaran (Right)
  const card3X = margin + (cardWidth * 2) + 9;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 3, 3, 'FD');
  // Decorative left border
  doc.setFillColor(244, 63, 94); // rose-500
  doc.rect(card3X, currentY, 1.5, cardHeight, 'F');
  // Content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('TOTAL PENGELUARAN', card3X + 4, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`- ${formatRupiah(totalExpense)}`, card3X + 4, currentY + 14);

  currentY += cardHeight + 10;

  // --- TABLE SECTION TITLE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`RIWAYAT TRANSAKSI LENGKAP (${sortedTransactions.length} item)`, margin, currentY);

  currentY += 5;

  // --- TABLE HEADERS (Sum to contentWidth = 180mm) ---
  const colWidths = {
    no: 8,
    tanggal: 32,
    tipe: 22,
    kategori: 26,
    deskripsi: 54,
    nominal: 38,
  };

  function drawTableHeader(y: number) {
    doc.setFillColor(15, 23, 42); // slate-900 Header
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255); // White text

    let currentX = margin;
    
    // Column 1: No
    doc.text('No', currentX + 2, y + 5.5);
    currentX += colWidths.no;

    // Column 2: Tanggal
    doc.text('Tanggal & Waktu', currentX + 2, y + 5.5);
    currentX += colWidths.tanggal;

    // Column 3: Tipe
    doc.text('Jenis Aliran', currentX + 2, y + 5.5);
    currentX += colWidths.tipe;

    // Column 4: Kategori
    doc.text('Kategori', currentX + 2, y + 5.5);
    currentX += colWidths.kategori;

    // Column 5: Deskripsi
    doc.text('Deskripsi / Catatan', currentX + 2, y + 5.5);
    currentX += colWidths.deskripsi;

    // Column 6: Nominal
    doc.text('Nominal (Rp)', currentX + colWidths.nominal - doc.getTextWidth('Nominal (Rp)') - 2, y + 5.5);
  }

  drawTableHeader(currentY);
  currentY += 8;

  // --- TABLE ROWS (DATA) ---
  if (sortedTransactions.length === 0) {
    // Empty State Row
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, contentWidth, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, 12, 'D');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Tidak ada data transaksi pada periode ini.', pageWidth / 2, currentY + 7.5, { align: 'center' });
    currentY += 12;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    sortedTransactions.forEach((t, index) => {
      // Format transaction Date
      const dateObj = new Date(t.date);
      const formattedDate = dateObj.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) + ' ' + dateObj.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Split Kategori & Deskripsi to fit column widths and calculate row height dynamically
      const splitCategory = doc.splitTextToSize(t.category || '-', colWidths.kategori - 4);
      const splitDesc = doc.splitTextToSize(t.description || '-', colWidths.deskripsi - 4);
      const numLines = Math.max(1, splitCategory.length, splitDesc.length);
      const rowHeight = 6 + (numLines * 3.5); // Elegant cell padding

      // Check page overflow and redraw header if a new page is added
      checkPageOverflow(rowHeight, true);

      // Zebra striping backgrounds
      if (index % 2 === 0) {
        doc.setFillColor(255, 255, 255); // Plain white
      } else {
        doc.setFillColor(248, 250, 252); // slate-50
      }
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');

      // Row thin bottom border
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.setLineWidth(0.3);
      doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);

      // Write values
      let currentX = margin;
      doc.setTextColor(51, 65, 85); // slate-700

      // Column 1: Index
      doc.text((index + 1).toString(), currentX + 2, currentY + 5.5);
      currentX += colWidths.no;

      // Column 2: Date
      doc.text(formattedDate, currentX + 2, currentY + 5.5);
      currentX += colWidths.tanggal;

      // Column 3: Type with distinct color feedback
      if (t.type === 'pemasukan') {
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.setFont('helvetica', 'bold');
        doc.text('PEMASUKAN', currentX + 2, currentY + 5.5);
      } else {
        doc.setTextColor(225, 29, 72); // rose-600
        doc.setFont('helvetica', 'bold');
        doc.text('PENGELUARAN', currentX + 2, currentY + 5.5);
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      currentX += colWidths.tipe;

      // Column 4: Category (Multi-line)
      splitCategory.forEach((line: string, i: number) => {
        doc.text(line, currentX + 2, currentY + 5.5 + (i * 3.5));
      });
      currentX += colWidths.kategori;

      // Column 5: Description (Multi-line)
      splitDesc.forEach((line: string, i: number) => {
        doc.text(line, currentX + 2, currentY + 5.5 + (i * 3.5));
      });
      currentX += colWidths.deskripsi;

      // Column 6: Amount with proper currency format and spacing
      const amountSign = t.type === 'pemasukan' ? '+' : '-';
      const amountVal = `${amountSign} Rp ${t.amount.toLocaleString('id-ID')}`;
      if (t.type === 'pemasukan') {
        doc.setTextColor(5, 150, 105); // emerald-600 bold
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(220, 38, 38); // red-600 bold
        doc.setFont('helvetica', 'bold');
      }
      doc.text(amountVal, currentX + colWidths.nominal - doc.getTextWidth(amountVal) - 2, currentY + 5.5);
      doc.setFont('helvetica', 'normal');

      currentY += rowHeight;
    });
  }

  // Draw final footer on the last page
  drawFooter(doc, pageWidth, pageHeight, margin);

  // Trigger Save download in user browser
  const sanitizedPeriod = periodTitle.toLowerCase().replace(/\s+/g, '_');
  doc.save(`fahkeu_rekap_${sanitizedPeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
}
