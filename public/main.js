const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

let mainWindow;
let medasrWorker = null;
let medasrWorkerOutput = "";
let medasrWorkerError = "";
let medasrRequestId = 0;
const medasrRequests = new Map();

function getMedasrWorkerCommand() {
  if (isDev) {
    const scriptPath = path.join(process.cwd(), "transcribe_realtime.py");
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Transcription script not found at: ${scriptPath}`);
    }
    return {
      command: process.env.MEDASR_PYTHON || "python3.11",
      args: [scriptPath, "--server"],
    };
  }

  const binaryPath = path.join(
    process.resourcesPath,
    "transcribe_realtime",
    "transcribe_realtime",
  );
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Transcription binary not found at: ${binaryPath}`);
  }
  return { command: binaryPath, args: ["--server"] };
}

function rejectPendingMedasrRequests(error) {
  for (const { reject } of medasrRequests.values()) {
    reject(error);
  }
  medasrRequests.clear();
}

function getMedasrWorkerEnvironment() {
  // Production builds bundle FFmpeg and the authorized MedASR model, so a
  // Finder-launched app does not depend on Homebrew, a terminal PATH, or a
  // Hugging Face login on the recipient's Mac.
  const bundledBinDirectory = isDev
    ? null
    : path.join(process.resourcesPath, "bin");
  const homebrewPaths = ["/opt/homebrew/bin", "/usr/local/bin"];
  const currentPath = process.env.PATH || "";
  const environment = {
    ...process.env,
    PATH: [bundledBinDirectory, ...homebrewPaths, currentPath]
      .filter(Boolean)
      .join(path.delimiter),
  };

  if (!isDev) {
    environment.MEDASR_MODEL_PATH = path.join(
      process.resourcesPath,
      "medasr-model",
    );
    environment.HF_HUB_OFFLINE = "1";
    environment.TRANSFORMERS_OFFLINE = "1";
  }

  return environment;
}

function startMedasrWorker() {
  if (medasrWorker && !medasrWorker.killed) {
    return medasrWorker;
  }

  const { command, args } = getMedasrWorkerCommand();
  console.log("[MedASR] Starting persistent worker:", command, args.join(" "));
  medasrWorker = spawn(command, args, {
    env: getMedasrWorkerEnvironment(),
  });
  medasrWorkerOutput = "";
  medasrWorkerError = "";

  medasrWorker.stdout.on("data", (data) => {
    medasrWorkerOutput += data.toString();
    const lines = medasrWorkerOutput.split("\n");
    medasrWorkerOutput = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        const request = medasrRequests.get(response.id);
        if (!request) continue;
        medasrRequests.delete(response.id);
        if (response.error) {
          request.reject(new Error(response.error));
        } else {
          request.resolve(response.text);
        }
      } catch (error) {
        console.error("[MedASR] Invalid worker response:", line, error);
      }
    }
  });

  medasrWorker.stderr.on("data", (data) => {
    medasrWorkerError += data.toString();
    console.log("[MedASR]", data.toString());
  });

  medasrWorker.on("error", (error) => {
    rejectPendingMedasrRequests(error);
    medasrWorker = null;
  });
  medasrWorker.on("exit", (code) => {
    if (code !== 0) {
      rejectPendingMedasrRequests(
        new Error(
          `MedASR worker stopped with code ${code}: ${medasrWorkerError.trim()}`,
        ),
      );
    }
    medasrWorker = null;
  });
  return medasrWorker;
}

function transcribeWithMedasr(audioBuffer) {
  const worker = startMedasrWorker();
  const id = ++medasrRequestId;
  return new Promise((resolve, reject) => {
    if (!worker.stdin || worker.exitCode !== null || worker.killed) {
      reject(
        new Error(
          `MedASR worker is unavailable: ${medasrWorkerError.trim() || "restart the app and verify Python 3.11 is installed"}`,
        ),
      );
      return;
    }
    medasrRequests.set(id, { resolve, reject });
    worker.stdin.write(
      `${JSON.stringify({ id, audioBase64: Buffer.from(audioBuffer).toString("base64") })}\n`,
      (error) => {
        if (error && medasrRequests.has(id)) {
          medasrRequests.delete(id);
          reject(error);
        }
      },
    );
  });
}

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

app.on("ready", () => {
  createWindow();
  // Load the model before recording starts so the first transcript is not
  // delayed by Python and MedASR initialization.
  try {
    startMedasrWorker();
  } catch (error) {
    console.error("[MedASR] Could not start background worker:", error);
  }
});

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

// Transcribe audio through the persistent MedASR worker.
ipcMain.handle("transcribe-audio", async (event, payload) => {
  try {
    let audioBuffer = payload;
    let sessionId = null;
    if (payload && typeof payload === "object" && payload.audioBuffer) {
      audioBuffer = payload.audioBuffer;
      sessionId = payload.sessionId || null;
    }

    console.log(
      "[IPC] transcribe-audio handler called with buffer length:",
      audioBuffer.length,
      "sessionId:",
      sessionId,
    );

    let buffer;
    if (Buffer.isBuffer(audioBuffer)) {
      buffer = audioBuffer;
    } else if (ArrayBuffer.isView(audioBuffer)) {
      buffer = Buffer.from(audioBuffer);
    } else if (audioBuffer instanceof ArrayBuffer) {
      buffer = Buffer.from(new Uint8Array(audioBuffer));
    } else if (Array.isArray(audioBuffer)) {
      buffer = Buffer.from(audioBuffer);
    } else if (
      audioBuffer &&
      typeof audioBuffer === "object" &&
      Array.isArray(audioBuffer.data)
    ) {
      buffer = Buffer.from(audioBuffer.data);
    } else if (
      audioBuffer &&
      typeof audioBuffer === "object" &&
      typeof audioBuffer.length === "number"
    ) {
      buffer = Buffer.from(Array.from(audioBuffer));
    } else {
      throw new Error(
        `Unsupported audioBuffer type in transcribe-audio: ${typeof audioBuffer}`,
      );
    }
    return await transcribeWithMedasr(buffer);
  } catch (error) {
    console.error("[IPC] transcribe-audio error:", error);
    throw error;
  }
});

// Utility: Get base directory for app data (templates, dictations)
function getAppDataDir() {
  if (isDev) {
    return process.cwd();
  } else {
    // ~/Library/Application Support/Dictation Tool — writable, persists across updates
    return app.getPath("userData");
  }
}

// Utility: Get templates directory
function getTemplatesDir() {
  return path.join(getAppDataDir(), "templates");
}

// Utility: Get dictations directory
function getDictationsDir() {
  return path.join(getAppDataDir(), "dictations");
}

// Ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log("[IPC] Created directory:", dirPath);
  }
}

// Save text to file
ipcMain.handle("save-dictation", async (event, { patientId, transcript }) => {
  try {
    console.log("[IPC] save-dictation handler called for patient:", patientId);

    const dictationsDir = getDictationsDir();
    ensureDir(dictationsDir);

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

// Template CRUD Handlers

// Create template
ipcMain.handle("create-template", async (event, template) => {
  try {
    console.log("[IPC] create-template handler called for:", template.name);

    const templatesDir = getTemplatesDir();
    ensureDir(templatesDir);

    const templateId = template.id;
    const filename = `${templateId}.json`;
    const filePath = path.join(templatesDir, filename);

    if (fs.existsSync(filePath)) {
      throw new Error(`Template with ID '${templateId}' already exists`);
    }

    const templateJson = JSON.stringify(template, null, 2);
    fs.writeFileSync(filePath, templateJson, "utf-8");
    console.log("[IPC] Template created:", filePath);

    return {
      success: true,
      message: `Template '${template.name}' created successfully`,
      templateId,
      filePath,
    };
  } catch (error) {
    console.error("[IPC] create-template error:", error);
    throw error;
  }
});

// List all templates
ipcMain.handle("list-templates", async () => {
  try {
    console.log("[IPC] list-templates handler called");

    const templatesDir = getTemplatesDir();
    ensureDir(templatesDir);

    const files = fs.readdirSync(templatesDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    const templates = jsonFiles.map((file) => {
      const filePath = path.join(templatesDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    });

    console.log("[IPC] Listed", templates.length, "templates");
    return templates;
  } catch (error) {
    console.error("[IPC] list-templates error:", error);
    throw error;
  }
});

// Read single template
ipcMain.handle("read-template", async (event, templateId) => {
  try {
    console.log("[IPC] read-template handler called for:", templateId);

    const templatesDir = getTemplatesDir();
    const filePath = path.join(templatesDir, `${templateId}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const template = JSON.parse(content);

    console.log("[IPC] Template read successfully");
    return template;
  } catch (error) {
    console.error("[IPC] read-template error:", error);
    throw error;
  }
});

// Update template
ipcMain.handle("update-template", async (event, template) => {
  try {
    console.log("[IPC] update-template handler called for:", template.id);

    const templatesDir = getTemplatesDir();
    const filePath = path.join(templatesDir, `${template.id}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Template '${template.id}' not found`);
    }

    template.updatedAt = new Date().toISOString();
    const templateJson = JSON.stringify(template, null, 2);
    fs.writeFileSync(filePath, templateJson, "utf-8");

    console.log("[IPC] Template updated:", filePath);
    return {
      success: true,
      message: `Template '${template.name}' updated successfully`,
      templateId: template.id,
    };
  } catch (error) {
    console.error("[IPC] update-template error:", error);
    throw error;
  }
});

// Delete template
ipcMain.handle("delete-template", async (event, templateId) => {
  try {
    console.log("[IPC] delete-template handler called for:", templateId);

    const templatesDir = getTemplatesDir();
    const filePath = path.join(templatesDir, `${templateId}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Template '${templateId}' not found`);
    }

    fs.unlinkSync(filePath);
    console.log("[IPC] Template deleted:", filePath);

    return {
      success: true,
      message: `Template deleted successfully`,
      templateId,
    };
  } catch (error) {
    console.error("[IPC] delete-template error:", error);
    throw error;
  }
});

// Show save dialog to user
ipcMain.handle("show-save-dialog", async (event, { patientId }) => {
  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `${patientId}_${timestamp}.pdf`;

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(os.homedir(), "Downloads", filename),
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    return result;
  } catch (error) {
    console.error("[IPC] show-save-dialog error:", error);
    throw error;
  }
});

// Save dictation as PDF
ipcMain.handle(
  "save-dictation-pdf",
  async (event, { patientId, template, mappedContent, pdfData, filePath }) => {
    try {
      console.log(
        "[IPC] save-dictation-pdf handler called for patient:",
        patientId,
      );

      // If no filePath provided, use default dictations directory
      if (!filePath) {
        const dictationsDir = getDictationsDir();
        ensureDir(dictationsDir);
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, -5);
        const filename = `${patientId}_${timestamp}.pdf`;
        filePath = path.join(dictationsDir, filename);
      } else {
        // Ensure directory exists for custom path
        const dir = path.dirname(filePath);
        ensureDir(dir);
      }

      if (pdfData && Array.isArray(pdfData)) {
        // Save the PDF from renderer process
        const pdfBuffer = Buffer.from(pdfData);
        fs.writeFileSync(filePath, pdfBuffer);
        console.log("[IPC] PDF saved to:", filePath);
      } else {
        // Fallback: save as JSON if PDF generation failed on renderer
        console.warn("[IPC] No PDF data received, saving as JSON fallback");
        const jsonFilePath = filePath.replace(".pdf", ".json");
        const jsonData = {
          patientId,
          templateName: template.name,
          templateId: template.id,
          timestamp,
          mappedContent,
          createdAt: new Date().toISOString(),
        };
        fs.writeFileSync(
          jsonFilePath,
          JSON.stringify(jsonData, null, 2),
          "utf-8",
        );
        console.log("[IPC] Fallback JSON saved to:", jsonFilePath);
        return {
          success: true,
          message: `Dictation saved as structured data (PDF generation had issues)`,
          filePath: jsonFilePath,
          pdfPath: filePath,
        };
      }

      const filename = path.basename(filePath);
      return {
        success: true,
        message: `Dictation PDF saved successfully to ${filename}`,
        filePath,
        pdfPath: filePath,
      };
    } catch (error) {
      console.error("[IPC] save-dictation-pdf error:", error);
      throw error;
    }
  },
);
