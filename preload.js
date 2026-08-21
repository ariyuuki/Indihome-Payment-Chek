const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Sekarang fungsi ini menerima 2 parameter: nomor dan timeout
  openFinpayPage: (customerNumber, timeoutSec) => ipcRenderer.invoke('open-finpay-page', customerNumber, timeoutSec)
});