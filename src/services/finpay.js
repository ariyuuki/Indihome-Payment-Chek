const axios = require('axios');

async function checkBill(customerNumber) {
  if (!customerNumber || customerNumber.trim() === '') {
    throw new Error('Nomor pelanggan tidak boleh kosong');
  }

  try {
    // Kita tembak API publik gratis dari JSONPlaceholder sebagai simulasi
    // URL ini dijamin hidup dan akan merespon
    const response = await axios.get('https://jsonplaceholder.typicode.com/users/1', {
      timeout: 10000 
    });

    const apiData = response.data;

    // Kita "sulap" data user dari API publik ini menjadi format tagihan kita
    return {
      customerNumber: customerNumber,
      customerName: apiData.name,         // Mengambil nama dari API publik (misal: Leanne Graham)
      period: '2026-08',
      amount: 350000,
      adminFee: 2500,
      total: 352500,
      status: 'UNPAID'
    };

  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.data.message || 'Gagal mengambil data'}`);
    } else if (error.request) {
      throw new Error('Tidak dapat terhubung ke server API. Periksa koneksi internet Anda.');
    } else {
      throw new Error(error.message);
    }
  }
}

module.exports = { checkBill };