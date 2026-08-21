const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 550,       // Lebar jendela dikecilkan (sebelumnya 800)
    height: 700,      // Tinggi jendela disesuaikan (sebelumnya 600)
    minWidth: 450,    // Batas minimum lebar jika jendela di-resize manual
    minHeight: 500,   // Batas minimum tinggi
    autoHideMenuBar: true, // Tambahan: Menyembunyikan menu bar bawaan agar lebih rapi
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  // Tambahkan parameter timeoutSec (default 15 detik jika kosong)
  ipcMain.handle('open-finpay-page', async (event, customerNumber, timeoutSec = 15) => {
    
    // ... (KODE PEMBUATAN WINDOW TETAP SAMA SEPERTI SEBELUMNYA) ...

    // DI DALAM JAVASCRIPT MACRO, cari bagian "// 4. Polling Hasil" 
    // dan ubah angkanya dari 15 menjadi ${timeoutSec}
    
    // 1. Dapatkan jendela utama (aplikasi Anda) yang sedang aktif
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    
    // 2. Ambil koordinat posisinya di layar monitor
    const mainBounds = mainWindow.getBounds();

    // 3. Buat jendela popup dengan ukuran kecil dan posisi menempel jendela utama
    // 3. Buat jendela popup secara HIDDEN (Tidak Terlihat)
    const paymentWin = new BrowserWindow({
      show: false, // KUNCI UTAMA: Jendela tidak akan dimunculkan ke layar
      width: 350,
      height: 450,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false // PENTING: Agar perhitungan Altcha tidak melambat/berhenti saat jendela disembunyikan
      }
    });

    await paymentWin.loadURL('https://live.finpay.id/widgetpg/001111');

    try {
      // Jalankan Macro dan tunggu hasilnya
      const result = await paymentWin.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const wait = ms => new Promise(r => setTimeout(r, ms));

          async function runMacro() {
            // 1. Cari & Isi Nomor Pelanggan (Tunggu max 10 detik)
            let inputPelanggan;
            for(let i=0; i<10; i++) {
                inputPelanggan = document.querySelector('input[placeholder="Nomor Pelanggan"]');
                if(inputPelanggan) break;
                await wait(1000);
            }
            if(!inputPelanggan) return resolve({ status: 'ERROR', message: 'Form input tidak ditemukan.' });

            // Injeksi nilai ke input (Trik React/Vue)
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(inputPelanggan, '${customerNumber}');
            inputPelanggan.dispatchEvent(new Event('input', { bubbles: true }));
            inputPelanggan.dispatchEvent(new Event('change', { bubbles: true }));

            await wait(1500);

            // 2. Cari & Centang Altcha
            const altcha = document.querySelector('input[type="checkbox"][id^="altcha_checkbox"]');
            if(altcha && !altcha.checked) {
                altcha.click();
                altcha.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Tunggu Altcha selesai verifikasi (Altcha butuh waktu perhitungan sekitar 4-5 detik)
            await wait(5000);

            // 3. Klik Tombol Lanjutkan
            const paragraphs = document.querySelectorAll('p');
            let btnLanjut;
            for (let p of paragraphs) {
                if (p.textContent.includes('Lanjutkan')) {
                    btnLanjut = p.closest('button') || p;
                    break;
                }
            }
            
            if(btnLanjut) {
                btnLanjut.click();
            } else {
                return resolve({ status: 'ERROR', message: 'Tombol Lanjutkan tidak ditemukan.' });
            }

            // 4. Polling Hasil (Tunggu hingga 15 detik)
            // 4. Polling Hasil (Tunggu hingga timeoutSec detik)
            for(let i=0; i<${timeoutSec}; i++) {
                await wait(1000); // Cek layar setiap 1 detik
                
                const isUnpaid = Array.from(document.querySelectorAll('div')).some(el => el.textContent.includes('Konfirmasi Tagihan'));
                if(isUnpaid) return resolve({ status: 'UNPAID', message: 'Tagihan belum dibayar.' });

                const isPaid = Array.from(document.querySelectorAll('h1')).some(el => el.textContent.includes('Tagihan sudah terbayar'));
                if(isPaid) return resolve({ status: 'PAID', message: 'Tagihan sudah terbayar lunas.' });

                const isError = Array.from(document.querySelectorAll('div')).some(el => el.textContent.toLowerCase().includes('tidak ditemukan'));
                if(isError) return resolve({ status: 'ERROR', message: 'Nomor pelanggan tidak valid/tidak ditemukan.' });
            }

            resolve({ status: 'ERROR', message: 'Timeout: Tidak ada respon dari halaman Finpay.' });
          }
          
          runMacro();
        });
      `);

      // SETELAH MENDAPAT HASIL, TUTUP JENDELA POPUP
      if (!paymentWin.isDestroyed()) paymentWin.close();
      
      return { success: true, data: result };

    } catch (err) {
      if (!paymentWin.isDestroyed()) paymentWin.close();
      return { success: false, message: 'Gagal mengeksekusi macro.' };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});