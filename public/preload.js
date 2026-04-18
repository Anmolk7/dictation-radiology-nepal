const { contextBridge, ipcRenderer } = require("electron");

try {
  contextBridge.exposeInMainWorld("electron", {
    // Audio transcription
    transcribeAudio: (audioBuffer, sessionId = null) => {
      const normalizeBuffer = (buffer) => {
        if (Buffer.isBuffer(buffer)) {
          return Array.from(buffer);
        }
        if (ArrayBuffer.isView(buffer)) {
          return Array.from(buffer);
        }
        if (buffer instanceof ArrayBuffer) {
          return Array.from(new Uint8Array(buffer));
        }
        if (Array.isArray(buffer)) {
          return buffer;
        }
        if (
          buffer &&
          typeof buffer === "object" &&
          typeof buffer.length === "number"
        ) {
          return Array.from(buffer);
        }
        throw new Error(
          "Unsupported audio buffer type in preload.transcribeAudio",
        );
      };

      if (
        audioBuffer &&
        typeof audioBuffer === "object" &&
        audioBuffer.audioBuffer
      ) {
        const normalized = normalizeBuffer(audioBuffer.audioBuffer);
        console.log(
          "Calling transcribe-audio IPC with payload, buffer length:",
          normalized.length,
          "sessionId:",
          audioBuffer.sessionId,
        );
        return ipcRenderer.invoke("transcribe-audio", {
          audioBuffer: normalized,
          sessionId: audioBuffer.sessionId,
        });
      }

      const normalized = normalizeBuffer(audioBuffer);
      console.log(
        "Calling transcribe-audio IPC with buffer length:",
        normalized.length,
        "sessionId:",
        sessionId,
      );
      return ipcRenderer.invoke("transcribe-audio", {
        audioBuffer: normalized,
        sessionId,
      });
    },

    // Dictation save
    saveDictation: (data) => {
      console.log("Calling save-dictation IPC with data:", data);
      return ipcRenderer.invoke("save-dictation", data);
    },

    // Transcription updates
    onTranscriptionUpdate: (callback) => {
      const listener = (event, data) => {
        callback(data);
      };
      ipcRenderer.on("transcription-update", listener);
      return () => {
        ipcRenderer.removeListener("transcription-update", listener);
      };
    },

    // Template CRUD operations
    createTemplate: (template) => {
      console.log("Calling create-template IPC with template:", template.name);
      return ipcRenderer.invoke("create-template", template);
    },

    listTemplates: () => {
      console.log("Calling list-templates IPC");
      return ipcRenderer.invoke("list-templates");
    },

    readTemplate: (templateId) => {
      console.log("Calling read-template IPC for:", templateId);
      return ipcRenderer.invoke("read-template", templateId);
    },

    updateTemplate: (template) => {
      console.log("Calling update-template IPC for:", template.id);
      return ipcRenderer.invoke("update-template", template);
    },

    deleteTemplate: (templateId) => {
      console.log("Calling delete-template IPC for:", templateId);
      return ipcRenderer.invoke("delete-template", templateId);
    },

    // Dictation save as PDF
    saveDictationPDF: (data) => {
      console.log("Calling save-dictation-pdf IPC with data:", data);
      return ipcRenderer.invoke("save-dictation-pdf", data);
    },

    // Show file save dialog
    showSaveDialog: (data) => {
      console.log("Calling show-save-dialog IPC");
      return ipcRenderer.invoke("show-save-dialog", data);
    },
  });
  console.log("Electron IPC bridge loaded successfully");
} catch (error) {
  console.error("Failed to set up electron bridge:", error);
}
