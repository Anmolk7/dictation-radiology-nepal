const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../build/index.html")}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers

// Transcribe audio using faster-whisper with real-time streaming
ipcMain.handle("transcribe-audio", async (event, audioBuffer) => {
  try {
    console.log(
      "[IPC] transcribe-audio handler called with buffer length:",
      audioBuffer.length,
    );

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `recording_${Date.now()}.webm`);

    // Write audio buffer to temp file
    const buffer = Buffer.isBuffer(audioBuffer)
      ? audioBuffer
      : Buffer.from(audioBuffer);
    fs.writeFileSync(tempFile, buffer);
    console.log("[IPC] Audio written to temp file:", tempFile);

    // Find the transcribe script path
    let scriptPath;
    if (isDev) {
      // In development, script is in project root
      scriptPath = path.join(process.cwd(), "transcribe_realtime.py");
    } else {
      // In production, script is in the resources/app directory
      scriptPath = path.join(process.resourcesPath, "transcribe_realtime.py");
    }

    console.log("[IPC] Using transcription script at:", scriptPath);

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Transcription script not found at: ${scriptPath}`);
    }

    // Find Python 3
    const python3Path = "python3";

    console.log("[IPC] Running real-time transcription with faster-whisper");

    return new Promise((resolve, reject) => {
      const python = spawn(python3Path, [scriptPath, tempFile, "en"]);

      let fullTranscript = "";
      let stderr = "";

      python.stdout.on("data", (data) => {
        try {
          const lines = data
            .toString()
            .split("\n")
            .filter((line) => line.trim());
          for (const line of lines) {
            const result = JSON.parse(line);

            if (result.type === "segment") {
              console.log("[Transcription] Segment:", result.text);
              fullTranscript = result.full_transcript;

              // Send streaming update to renderer
              if (mainWindow && mainWindow.webContents) {
                console.log(
                  "[IPC] Sending transcription-update event to renderer",
                );
                mainWindow.webContents.send("transcription-update", {
                  type: "segment",
                  text: result.text,
                  fullTranscript: result.full_transcript,
                });
              } else {
                console.warn(
                  "[IPC] Main window not available for sending update",
                );
              }
            } else if (result.type === "complete") {
              console.log("[Transcription] Complete:", result.text);
              fullTranscript = result.text;

              // Send completion signal
              if (mainWindow && mainWindow.webContents) {
                console.log(
                  "[IPC] Sending transcription-complete event to renderer",
                );
                mainWindow.webContents.send("transcription-update", {
                  type: "complete",
                  text: result.text,
                });
              }
            } else if (result.type === "error") {
              console.error("[Transcription Error]", result.error);
              reject(new Error(result.error));
            }
          }
        } catch (err) {
          console.error("[JSON Parse Error]", err, "Line:", line);
        }
      });

      python.stderr.on("data", (data) => {
        stderr += data.toString();
        console.log("[Python stderr]", data.toString());
      });

      python.on("close", (code) => {
        try {
          // Cleanup temp file
          fs.unlinkSync(tempFile);

          if (code === 0 && fullTranscript) {
            console.log("[Transcription] Process completed successfully");
            resolve(fullTranscript);
          } else if (code !== 0) {
            reject(
              new Error(
                `Transcription failed with code ${code}. stderr: ${stderr}`,
              ),
            );
          }
        } catch (err) {
          reject(err);
        }
      });

      python.on("error", (err) => {
        console.error("[Python Process Error]", err);
        reject(err);
      });
    });
  } catch (error) {
    console.error("[IPC] transcribe-audio error:", error);
    throw error;
  }
});

// Save text to file
ipcMain.handle("save-dictation", async (event, { patientId, transcript }) => {
  try {
    console.log("[IPC] save-dictation handler called for patient:", patientId);

    // Save to dictations folder in project root
    let dictationsDir;

    if (isDev) {
      // In development, use current working directory (where npm run dev was executed)
      dictationsDir = path.join(process.cwd(), "dictations");
    } else {
      // In production, save relative to the app's resource directory
      dictationsDir = path.join(path.dirname(app.getAppPath()), "dictations");
    }

    console.log("[IPC] Saving to dictations directory:", dictationsDir);

    // Create dictations folder if it doesn't exist
    if (!fs.existsSync(dictationsDir)) {
      fs.mkdirSync(dictationsDir, { recursive: true });
      console.log("[IPC] Created dictations directory:", dictationsDir);
    }

    // Generate filename with patient ID and timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `${patientId}_${timestamp}.txt`;
    const filePath = path.join(dictationsDir, filename);

    // Write transcript to file
    fs.writeFileSync(filePath, transcript, "utf-8");
    console.log("[IPC] Dictation saved to:", filePath);

    return {
      success: true,
      message: `Dictation saved to ${filePath}`,
      filePath,
    };
  } catch (error) {
    console.error("[IPC] save-dictation error:", error);
    throw error;
  }
});
