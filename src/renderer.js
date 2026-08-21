const searchBtn = document.getElementById('search-btn');
const cekLanjutanBtn = document.getElementById('cek-lanjutan-btn'); // Tombol Baru
const exportBtn = document.getElementById('export-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const inputArea = document.getElementById('customer-ids');
const resultContainer = document.getElementById('result-container');
const tbody = document.getElementById('result-tbody');

// Elemen Settings
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const delaySetting = document.getElementById('delay-setting');
const delayVal = document.getElementById('delay-val');
const timeoutSetting = document.getElementById('timeout-setting');

let isPaused = false;
let isCancelled = false;
let appConfig = { delay: 4, timeout: 15 };
let indihomeDB = {}; 

function getTodayDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ==========================================
// KONTROL MODAL SETTINGS
// ==========================================
delaySetting.addEventListener('input', () => { delayVal.textContent = delaySetting.value; });
settingsBtn.addEventListener('click', () => {
  delaySetting.value = appConfig.delay;
  delayVal.textContent = appConfig.delay;
  timeoutSetting.value = appConfig.timeout;
  settingsModal.style.display = 'block';
});
closeSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
saveSettingsBtn.addEventListener('click', () => {
  appConfig.delay = parseInt(delaySetting.value);
  appConfig.timeout = parseInt(timeoutSetting.value);
  localStorage.setItem('indihomeConfig', JSON.stringify(appConfig));
  settingsModal.style.display = 'none';
});

// ==========================================
// KONTROL TOMBOL PAUSE & STOP
// ==========================================
pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  if (isPaused) {
    pauseBtn.innerHTML = '▶️ Resume';
    pauseBtn.classList.replace('btn-secondary', 'btn-primary');
    pauseBtn.style.backgroundColor = '#2e7d32'; // Hijau
    searchBtn.textContent = '⏸️ Dijeda...';
  } else {
    pauseBtn.innerHTML = '⏸️ Pause';
    pauseBtn.classList.replace('btn-primary', 'btn-secondary');
    pauseBtn.style.backgroundColor = ''; // Kembali abu-abu
  }
});
stopBtn.addEventListener('click', () => {
  if (confirm('Hentikan proses pengecekan?')) {
    isCancelled = true;
    isPaused = false;
  }
});

// ==========================================
// MEMUAT RIWAYAT & DATABASE AWAL
// ==========================================
inputArea.addEventListener('input', () => { localStorage.setItem('indihomeInput', inputArea.value); });

function loadHistory() {
  const savedConfig = localStorage.getItem('indihomeConfig');
  if (savedConfig) appConfig = JSON.parse(savedConfig);

  const savedInput = localStorage.getItem('indihomeInput');
  if (savedInput) inputArea.value = savedInput;

  const savedDB = localStorage.getItem('indihomeDatabase');
  if (savedDB) {
    indihomeDB = JSON.parse(savedDB);
    exportBtn.disabled = false;
  }
}
loadHistory();


// ==========================================
// FITUR CEK LANJUTAN (Restart UI + Filter + Cek)
// ==========================================
cekLanjutanBtn.addEventListener('click', () => {
  const rawText = inputArea.value;
  let numbers = rawText.split('\n').map(n => n.trim()).filter(n => n !== '');
  
  if (numbers.length === 0) return alert('Kotak input kosong. Silakan masukkan nomor.');

  // 1. Filter: Buang data yang sudah PAID di masa lalu
  const uncompletedNumbers = numbers.filter(num => {
    if (!indihomeDB[num]) return true; 
    const pastRecords = Object.values(indihomeDB[num]);
    return !pastRecords.includes('PAID');
  });

  if (uncompletedNumbers.length === 0) {
    return alert('Semua nomor di dalam daftar ini sudah berstatus PAID. Tidak ada yang perlu dilanjutkan.');
  }

  // 2. Refresh UI Textbox
  inputArea.value = uncompletedNumbers.join('\n');
  localStorage.setItem('indihomeInput', inputArea.value);

  // 3. Langsung mulai proses cek otomatis
  searchBtn.click();
});


// ==========================================
// LOGIKA PENGECEKAN UTAMA
// ==========================================
searchBtn.addEventListener('click', async () => {
  const rawText = inputArea.value;
  const numbers = rawText.split('\n').map(n => n.trim()).filter(n => n !== '');
  
  if (numbers.length === 0) return alert('Silakan masukkan minimal 1 nomor IndiHome.');

  localStorage.setItem('indihomeInput', rawText);
  const todayDate = getTodayDate();

  isPaused = false;
  isCancelled = false;
  
  // Matikan tombol saat proses berjalan
  searchBtn.disabled = true;
  cekLanjutanBtn.disabled = true; 
  exportBtn.disabled = true;
  inputArea.disabled = true;
  settingsBtn.disabled = true; 
  
  // Nyalakan tombol kendali
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  pauseBtn.innerHTML = '⏸️ Pause';
  pauseBtn.classList.replace('btn-primary', 'btn-secondary');
  pauseBtn.style.backgroundColor = '';
  
  tbody.innerHTML = '';
  resultContainer.style.display = 'block';

  // Siapkan UI Tabel
  numbers.forEach(num => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${num}</td><td id="status-${num}" class="text-loading">⏳ Antre...</td>`;
    tbody.appendChild(tr);
  });

  for (let i = 0; i < numbers.length; i++) {
    if (isCancelled) break;
    
    const currentNumber = numbers[i];
    const statusCell = document.getElementById(`status-${currentNumber}`);
    
    // Pastikan nomor ada di Database
    if (!indihomeDB[currentNumber]) {
        indihomeDB[currentNumber] = {};
    }

    // SKIP Jika pernah PAID
    const pastRecords = Object.values(indihomeDB[currentNumber]);
    if (pastRecords.includes('PAID')) {
        indihomeDB[currentNumber][todayDate] = 'PAID'; 
        localStorage.setItem('indihomeDatabase', JSON.stringify(indihomeDB));
        statusCell.innerHTML = `<span class="text-paid">PAID (Tercatat)</span>`;
        continue; // Lanjut ke nomor berikutnya
    }

    searchBtn.textContent = `Mengecek (${i + 1}/${numbers.length})...`;

    // FITUR AUTO-RETRY
    let attempt = 0;
    const maxAttempts = 3; 
    let success = false;
    let statusText = 'ERROR';
    let cssClass = 'text-error';

    while (attempt < maxAttempts && !success && !isCancelled) {
      attempt++;
      
      while (isPaused) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (isCancelled) break;
      }
      if (isCancelled) break;

      if (attempt > 1) {
        statusCell.innerHTML = `<span style="color: #e65100;">⚠️ Mengulang (${attempt}/3)...</span>`;
        for(let r=0; r<4; r++) {
           if(isCancelled) break;
           await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        statusCell.innerHTML = `⚙️ Sedang dicek...`;
      }

      if (isCancelled) break;

      const response = await window.api.openFinpayPage(currentNumber, appConfig.timeout);
      
      if (response.success && response.data) {
         if (response.data.status === 'PAID') {
            statusText = 'PAID'; cssClass = 'text-paid'; success = true;
         } else if (response.data.status === 'UNPAID') {
            statusText = 'UNPAID'; cssClass = 'text-unpaid'; success = true;
         } else {
            statusText = 'ERROR';
         }
      }
    }
    
    // Simpan ke UI dan Database
    statusCell.innerHTML = `<span class="${cssClass}">${statusText}</span>`;
    indihomeDB[currentNumber][todayDate] = statusText;
    localStorage.setItem('indihomeDatabase', JSON.stringify(indihomeDB));

    // JEDA DINAMIS ANTAR NOMOR 
    if (i < numbers.length - 1 && !isCancelled) {
      statusCell.innerHTML = `<span class="${cssClass}">${statusText}</span> <span style="color: #aaa; font-size: 12px;">(Jeda ${appConfig.delay}s)</span>`;
      let delaySteps = (appConfig.delay * 1000) / 500; 
      for(let j = 0; j < delaySteps; j++) {
         if(isCancelled) break;
         await new Promise(resolve => setTimeout(resolve, 500));
      }
      statusCell.innerHTML = `<span class="${cssClass}">${statusText}</span>`; 
    }
  }

  // Tanda batal jika di-stop
  if (isCancelled) {
     for(let i = 0; i < numbers.length; i++) {
        const cell = document.getElementById(`status-${numbers[i]}`);
        if(cell.innerText.includes('Antre')) cell.innerHTML = `<span class="text-error">🚫 Batal</span>`;
     }
  }

  // Kembalikan tombol UI
  searchBtn.textContent = '▶️ Mulai Cek';
  searchBtn.disabled = false;
  cekLanjutanBtn.disabled = false;
  inputArea.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  settingsBtn.disabled = false;
  exportBtn.disabled = Object.keys(indihomeDB).length === 0;
  
  if (!isCancelled) alert('Pengecekan Selesai!');
});

// ==========================================
// FITUR EXPORT
// ==========================================
exportBtn.addEventListener('click', () => {
  const numbers = Object.keys(indihomeDB);
  if (numbers.length === 0) return;

  let allDatesSet = new Set();
  numbers.forEach(num => {
    Object.keys(indihomeDB[num]).forEach(date => allDatesSet.add(date));
  });

  const dateHeaders = Array.from(allDatesSet).sort((a, b) => {
    const [d1, m1, y1] = a.split('/');
    const [d2, m2, y2] = b.split('/');
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  });

  let csvContent = `No Inet,${dateHeaders.join(',')}\n`;

  numbers.forEach(num => {
    let row = [num];
    dateHeaders.forEach(date => {
      row.push(indihomeDB[num][date] || '-');
    });
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Laporan_IndiHome_${getTodayDate().replace(/\//g, '-')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});