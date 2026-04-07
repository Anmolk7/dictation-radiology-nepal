const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

// Try to find whisper in common locations
function getWhisperPath() {
  const possiblePaths = [
    '/usr/local/bin/whisper',
    '/usr/bin/whisper',
    '/opt/homebrew/bin/whisper',
    `${os.homedir()}/Library/Python/3.9/bin/whisper`,
    `${os.homedir()}/Library/Python/3.10/bin/whisper`,
    `${os.homedir()}/Library/Python/3.11/bin/whisper`,
    `${os.homedir()}/Library/Python/3.12/bin/whisper`,
    `${os.homedir()}/.local/bin/whisper`,
  ];

  for (const whisperPath of possiblePaths) {
    try {
      if (fs.existsSync(whisperPath)) {
        console.log('[Init] Found whisper at:', whisperPath);
        return whisperPath;
      }
    } catch (err) {
      // Continue searching
    }
  }

  // If not found, try using python module
  console.warn('[Init] Whisper binary not found in common locations, will try via python');
  return 'whisper';
}

const WHISPER_PATH = getWhisperPath();

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
    console.log('[IPC] transcribe-audio handler called with buffer length:', audioBuffer.length);

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `recording_${Date.now()}.webm`);
    const outputFile = path.join(tempDir, `recording_${Date.now()}`);

    // Write audio buffer to temp file
    const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
    fs.writeFileSync(tempFile, buffer);
    console.log('[IPC] Audio written to temp file:', tempFile);

    // Run whisper command with language set to English
    return new Promise((resolve, reject) => {
      console.log('[IPC] Running whisper from:', WHISPER_PATH);
      const whisper = spawn(WHISPER_PATH, [
        tempFile,
        '--language',
        'en',
        '--output_format',
        'txt',
        '--output_dir',
        tempDir,
      ]);

      let stderr = '';
      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('[Whisper stderr]', data.toString());
      });

      whisper.stdout.on('data', (data) => {
        console.log('[Whisper stdout]', data.toString());
      });

      whisper.on('close', (code) => {
        try {
          console.log('[IPC] Whisper process closed with code:', code);
          if (code === 0) {
            const txtFile = `${outputFile}.txt`;
            if (!fs.existsSync(txtFile)) {
              throw new Error(`Output file not found: ${txtFile}`);
            }
            const transcript = fs.readFileSync(txtFile, 'utf-8');
            console.log('[IPC] Transcript length:', transcript.length);

            // Cleanup temp files
            fs.unlinkSync(tempFile);
            if (fs.existsSync(txtFile)) {
              fs.unlinkSync(txtFile);
            }

            resolve(transcript);
          } else {
            reject(new Error(`Whisper exited with code ${code}. stderr: ${stderr}`));
          }
        } catch (err) {
          reject(err);
        }
      });

      whisper.on('error', (err) => {
        console.error('[IPC] Whisper process error:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('[IPC] transcribe-audio error:', error);
    throw error;
  }
});

// Save text to file
ipcMain.handle('save-dictation', async (event, { patientId, transcript }) => {
  try {
    console.log('[IPC] save-dictation handler called for patient:', patientId);

    // Save to dictations folder in project root
    let dictationsDir;

    if (isDev) {
      // In development, use current working directory (where npm run dev was executed)
      dictationsDir = path.join(process.cwd(), 'dictations');
    } else {
      // In production, save relative to the app's resource directory
      dictationsDir = path.join(path.dirname(app.getAppPath()), 'dictations');
    }

    console.log('[IPC] Saving to dictations directory:', dictationsDir);

    // Create dictations folder if it doesn't exist
    if (!fs.existsSync(dictationsDir)) {
      fs.mkdirSync(dictationsDir, { recursive: true });
      console.log('[IPC] Created dictations directory:', dictationsDir);
    }

    // Generate filename with patient ID and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${patientId}_${timestamp}.txt`;
    const filePath = path.join(dictationsDir, filename);

    // Write transcript to file
    fs.writeFileSync(filePath, transcript, 'utf-8');
    console.log('[IPC] Dictation saved to:', filePath);

    return {
      success: true,
      message: `Dictation saved to ${filePath}`,
      filePath,
    };
  } catch (error) {
    console.error('[IPC] save-dictation error:', error);
    throw error;
  }
});
