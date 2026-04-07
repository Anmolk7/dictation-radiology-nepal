const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers

// Transcribe audio using Whisper
ipcMain.handle('transcribe-audio', async (event, audioBuffer) => {
  try {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `recording_${Date.now()}.webm`);
    const outputFile = path.join(tempDir, `recording_${Date.now()}`);

    // Write audio buffer to temp file
    fs.writeFileSync(tempFile, Buffer.from(audioBuffer));

    // Run whisper command
    return new Promise((resolve, reject) => {
      const whisper = spawn('whisper', [
        tempFile,
        '--output_format',
        'txt',
        '--output_dir',
        tempDir,
      ]);

      whisper.on('close', (code) => {
        try {
          if (code === 0) {
            const txtFile = `${outputFile}.txt`;
            const transcript = fs.readFileSync(txtFile, 'utf-8');

            // Cleanup temp files
            fs.unlinkSync(tempFile);
            if (fs.existsSync(txtFile)) {
              fs.unlinkSync(txtFile);
            }

            resolve(transcript);
          } else {
            reject(new Error(`Whisper exited with code ${code}`));
          }
        } catch (err) {
          reject(err);
        }
      });

      whisper.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    throw error;
  }
});

// Save text to file
ipcMain.handle('save-dictation', async (event, { patientId, transcript }) => {
  try {
    const dictationsDir = path.join(app.getPath('userData'), 'dictations');

    // Create dictations folder if it doesn't exist
    if (!fs.existsSync(dictationsDir)) {
      fs.mkdirSync(dictationsDir, { recursive: true });
    }

    // Generate filename with patient ID and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${patientId}_${timestamp}.txt`;
    const filePath = path.join(dictationsDir, filename);

    // Write transcript to file
    fs.writeFileSync(filePath, transcript, 'utf-8');

    return {
      success: true,
      message: `Dictation saved to ${filePath}`,
      filePath,
    };
  } catch (error) {
    throw error;
  }
});
