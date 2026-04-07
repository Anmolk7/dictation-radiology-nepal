const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electron', {
    transcribeAudio: (audioBuffer) => {
      console.log('Calling transcribe-audio IPC with buffer length:', audioBuffer.length);
      return ipcRenderer.invoke('transcribe-audio', Array.from(audioBuffer));
    },
    saveDictation: (data) => {
      console.log('Calling save-dictation IPC with data:', data);
      return ipcRenderer.invoke('save-dictation', data);
    },
  });
  console.log('Electron IPC bridge loaded successfully');
} catch (error) {
  console.error('Failed to set up electron bridge:', error);
}
