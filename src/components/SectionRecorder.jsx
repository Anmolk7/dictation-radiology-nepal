import React, { useState, useCallback, useEffect } from "react";
import { generatePDF } from "../utils/pdfGenerator";
import useAudioRecorder from "../hooks/useAudioRecorder";
import useMedASR from "../hooks/useMedASR";
import {
  applyTranscriptDeletions,
  extractVoiceCommand,
  removeDeleteCommandWords,
  removeLastSentence,
  removeNextCommandWords,
  removeVoiceCommand,
} from "../utils/normalizeTranscript";
import "./SectionRecorder.css";

const SectionRecorder = ({ patientId, template, onSave, onBack }) => {
  const isFreeForm = template.isFreeForm === true;
  const [sectionTranscripts, setSectionTranscripts] = useState(
    template.sections.reduce((acc, section) => {
      acc[section.id] = section.description || "";
      return acc;
    }, {}),
  );
  const [currentRecordingSection, setCurrentRecordingSection] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const sectionSessionMapRef = React.useRef({});
  const currentSessionRef = React.useRef(null);
  const currentRecordingSectionRef = React.useRef(null);
  const transcriptDeletionsBySessionRef = React.useRef({});
  const lastDeleteSourceBySessionRef = React.useRef({});
  const lastNextSourceBySessionRef = React.useRef({});
  const deleteCommandExecutedBySessionRef = React.useRef({});
  const nextCommandExecutedBySessionRef = React.useRef({});
  const voiceCommandHandlerRef = React.useRef(null);
  const transcriptTextareaRefs = React.useRef({});

  const { isRecording, recordingTime, startRecording, stopRecording } =
    useAudioRecorder();

  useEffect(() => {
    if (!currentRecordingSection) {
      return;
    }

    const textarea = transcriptTextareaRefs.current[currentRecordingSection];
    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [currentRecordingSection, sectionTranscripts]);

  const handleStreamingUpdate = useCallback(
    (newTranscript, sessionId) => {
      if (!sessionId || sessionId !== currentSessionRef.current) {
        return;
      }

      const sectionId = sectionSessionMapRef.current[sessionId];
      if (!sectionId) {
        return;
      }

      const voiceCommand = extractVoiceCommand(newTranscript);
      let commandFreeTranscript = voiceCommand
        ? removeVoiceCommand(newTranscript)
        : newTranscript;

      if (deleteCommandExecutedBySessionRef.current[sessionId]) {
        commandFreeTranscript = removeDeleteCommandWords(commandFreeTranscript);
      }

      if (isFreeForm && nextCommandExecutedBySessionRef.current[sessionId]) {
        commandFreeTranscript = removeNextCommandWords(commandFreeTranscript);
      }

      if (voiceCommand === "delete") {
        deleteCommandExecutedBySessionRef.current[sessionId] = true;
        const lastDeleteSource =
          lastDeleteSourceBySessionRef.current[sessionId];
        if (lastDeleteSource !== commandFreeTranscript) {
          const deletions = transcriptDeletionsBySessionRef.current[sessionId];
          const currentTranscript = applyTranscriptDeletions(
            commandFreeTranscript,
            deletions,
          );
          deletions.push({
            source: commandFreeTranscript,
            replacement: removeLastSentence(currentTranscript),
          });
          lastDeleteSourceBySessionRef.current[sessionId] =
            commandFreeTranscript;
        }
      }

      if (isFreeForm && voiceCommand === "next") {
        const lastNextSource = lastNextSourceBySessionRef.current[sessionId];
        if (lastNextSource !== commandFreeTranscript) {
          const edits = transcriptDeletionsBySessionRef.current[sessionId];
          const currentTranscript = applyTranscriptDeletions(
            commandFreeTranscript,
            edits,
          );
          edits.push({
            source: commandFreeTranscript,
            replacement: `${currentTranscript}\n`,
          });
          lastNextSourceBySessionRef.current[sessionId] = commandFreeTranscript;
        }
        nextCommandExecutedBySessionRef.current[sessionId] = true;
      }

      const transcript = applyTranscriptDeletions(
        commandFreeTranscript,
        transcriptDeletionsBySessionRef.current[sessionId] || [],
      );

      setSectionTranscripts((prev) => ({
        ...prev,
        [sectionId]: transcript,
      }));

      if (voiceCommand === "stop" || (voiceCommand === "next" && !isFreeForm)) {
        voiceCommandHandlerRef.current?.(voiceCommand, sectionId);
      }
    },
    [isFreeForm],
  );

  const handleTranscriptionComplete = useCallback((sessionId) => {
    const currentSession = currentSessionRef.current;
    console.log(
      "🎉 [SectionRecorder] Transcription complete for session:",
      sessionId,
      "current session:",
      currentSession,
    );

    if (sessionId && currentSession === sessionId) {
      setCurrentRecordingSection(null);
      currentSessionRef.current = null;
    }

    if (sessionId) {
      delete sectionSessionMapRef.current[sessionId];
      delete transcriptDeletionsBySessionRef.current[sessionId];
      delete lastDeleteSourceBySessionRef.current[sessionId];
      delete lastNextSourceBySessionRef.current[sessionId];
      delete deleteCommandExecutedBySessionRef.current[sessionId];
    }
  }, []);

  const { transcribeAudio } = useMedASR(
    handleStreamingUpdate,
    handleTranscriptionComplete,
  );
  const transcriptionInProgressRef = React.useRef(false);
  const pendingAudioRef = React.useRef(null);

  useEffect(() => {
    const processLatestAudio = async () => {
      const pending = pendingAudioRef.current;
      if (!pending || transcriptionInProgressRef.current) return;

      pendingAudioRef.current = null;
      transcriptionInProgressRef.current = true;
      try {
        await transcribeAudio(pending.blob, pending.sessionId, pending.isFinal);
      } catch (err) {
        console.error("[SectionRecorder] MedASR update failed:", err);
      } finally {
        transcriptionInProgressRef.current = false;
        if (pendingAudioRef.current) processLatestAudio();
      }
    };

    const handleAudioChunk = (event) => {
      const { blob, isRecording: stillRecording, sessionId } = event.detail;
      if (sessionId && sectionSessionMapRef.current[sessionId]) {
        pendingAudioRef.current = {
          blob,
          sessionId,
          isFinal: !stillRecording,
        };
        processLatestAudio();
      }
    };

    window.addEventListener("audio-chunk-ready", handleAudioChunk);
    return () => {
      window.removeEventListener("audio-chunk-ready", handleAudioChunk);
      pendingAudioRef.current = null;
    };
  }, [transcribeAudio]);

  const handleStartRecording = async (sectionId) => {
    try {
      setError(null);
      const sessionId = `${sectionId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      sectionSessionMapRef.current[sessionId] = sectionId;
      currentSessionRef.current = sessionId;
      currentRecordingSectionRef.current = sectionId;
      transcriptDeletionsBySessionRef.current[sessionId] = [];
      lastDeleteSourceBySessionRef.current[sessionId] = null;
      lastNextSourceBySessionRef.current[sessionId] = null;
      deleteCommandExecutedBySessionRef.current[sessionId] = false;
      nextCommandExecutedBySessionRef.current[sessionId] = false;
      setCurrentRecordingSection(sectionId);
      await startRecording(sessionId);
    } catch (err) {
      setError(`Failed to start recording: ${err.message}`);
    }
  };

  const handleStopRecording = async (
    moveToNext = false,
    sectionId = currentRecordingSectionRef.current,
    fromVoiceCommand = false,
  ) => {
    try {
      // Close the UI recording state immediately so stop only needs one press.
      setCurrentRecordingSection(null);
      currentRecordingSectionRef.current = null;
      const stoppingSessionId = currentSessionRef.current;
      currentSessionRef.current = null;

      const blob = await stopRecording();
      if (!blob || blob.size === 0) {
        throw new Error("No audio was captured");
      }

      if (fromVoiceCommand && moveToNext && sectionId) {
        const sectionIndex = template.sections.findIndex(
          (section) => section.id === sectionId,
        );
        const nextSection = template.sections[sectionIndex + 1];
        if (nextSection) {
          await handleStartRecording(nextSection.id);
        }
      }

      if (stoppingSessionId) {
        delete sectionSessionMapRef.current[stoppingSessionId];
        delete transcriptDeletionsBySessionRef.current[stoppingSessionId];
        delete lastDeleteSourceBySessionRef.current[stoppingSessionId];
        delete lastNextSourceBySessionRef.current[stoppingSessionId];
        delete deleteCommandExecutedBySessionRef.current[stoppingSessionId];
        delete nextCommandExecutedBySessionRef.current[stoppingSessionId];
      }
    } catch (err) {
      console.error("Error stopping recording:", err);
      setError(`Failed to stop recording: ${err.message}`);
      setCurrentRecordingSection(null);
      currentRecordingSectionRef.current = null;
    }
  };

  voiceCommandHandlerRef.current = (command, sectionId) => {
    if (command === "stop" || (!isFreeForm && command === "next")) {
      void handleStopRecording(command === "next", sectionId, true);
    }
  };

  const handleEditTranscript = (sectionId, newText) => {
    setSectionTranscripts((prev) => ({
      ...prev,
      [sectionId]: newText,
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!window.electron) {
        throw new Error("Electron API not available");
      }

      // Show file save dialog
      console.log("📁 Opening file save dialog...");
      const dialogResult = await window.electron.showSaveDialog({
        patientId,
      });

      if (dialogResult.canceled) {
        console.log("User cancelled save dialog");
        setIsSaving(false);
        return;
      }

      const selectedFilePath = dialogResult.filePath;
      console.log("User selected path:", selectedFilePath);

      // Generate PDF
      console.log("🖨️ Generating PDF...");
      const pdfArrayBuffer = generatePDF({
        patientId,
        template,
        mappedContent: sectionTranscripts,
      });

      // Convert to array for IPC transfer
      const pdfArray = Array.from(new Uint8Array(pdfArrayBuffer));

      console.log("💾 Saving PDF via IPC...");
      // Call save-dictation-pdf IPC with PDF data and selected path
      const result = await window.electron.saveDictationPDF({
        patientId,
        template,
        mappedContent: sectionTranscripts,
        pdfData: pdfArray,
        filePath: selectedFilePath,
      });

      console.log("✅ Save result:", result);
      setSuccessMessage(result.message);
      setTimeout(() => {
        if (onSave) {
          onSave();
        }
      }, 1500);
    } catch (err) {
      console.error("❌ Error saving:", err);
      setError(`Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getTotalWords = () => {
    return Object.entries(sectionTranscripts).reduce(
      (sum, [sectionId, content]) => {
        const section = template.sections.find((s) => s.id === sectionId);
        const defaultText = section?.description || "";
        const actualContent =
          content.trim() !== defaultText.trim() ? content.trim() : "";
        return (
          sum + actualContent.split(/\s+/).filter((w) => w.length > 0).length
        );
      },
      0,
    );
  };

  return (
    <div className="section-recorder">
      <div className="recorder-header">
        <h2>
          {isFreeForm
            ? "🎙️ Free-form Dictation"
            : "🎙️ Section-by-Section Recording"}
        </h2>
        <p>
          {isFreeForm
            ? "Record your dictation continuously"
            : "Record each section individually for precise dictation"}
        </p>
      </div>

      {error && (
        <div className="error-box">
          <p>❌ {error}</p>
          <button className="btn btn-small" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="success-box">
          <p>✅ {successMessage}</p>
          <p style={{ fontSize: "12px", marginTop: "10px" }}>
            Redirecting to home...
          </p>
        </div>
      )}

      <div className="recorder-summary">
        <div className="summary-card">
          <h4>📋 Recording Details</h4>
          <div className="summary-row">
            <span className="label">Patient ID:</span>
            <span className="value">{patientId}</span>
          </div>
          {!isFreeForm && (
            <>
              <div className="summary-row">
                <span className="label">Template:</span>
                <span className="value">{template.name}</span>
              </div>
              <div className="summary-row">
                <span className="label">Sections:</span>
                <span className="value">{template.sections.length}</span>
              </div>
            </>
          )}
          <div className="summary-row">
            <span className="label">Total Words:</span>
            <span className="value">{getTotalWords()}</span>
          </div>
        </div>
      </div>

      <div className="sections-recording">
        {template.sections.map((section, index) => {
          const transcript = sectionTranscripts[section.id] || "";
          const isCurrentlyRecording = currentRecordingSection === section.id;

          if (isCurrentlyRecording) {
            console.log(
              `🔴 RENDERING STOP BUTTON: section=${section.id}, isRecording=${isRecording}, recordingTime=${recordingTime}`,
            );
          }

          return (
            <div key={section.id} className="section-recording-card">
              <div className="section-header">
                {!isFreeForm && <h4>Section {index + 1}</h4>}
                <div className="section-controls">
                  <button
                    className={`btn btn-small ${isCurrentlyRecording ? "btn-danger" : "btn-primary"}`}
                    onClick={
                      isCurrentlyRecording
                        ? () => handleStopRecording()
                        : () => handleStartRecording(section.id)
                    }
                    disabled={isRecording && !isCurrentlyRecording}
                  >
                    {isCurrentlyRecording ? (
                      <>⏹️ Stop ({recordingTime}s)</>
                    ) : (
                      <>🎙️ Record</>
                    )}
                  </button>
                </div>
              </div>

              <div className="section-prompt">
                <strong>{section.prompt}</strong>
              </div>
              <div className="section-transcript">
                <label>Transcript:</label>
                <textarea
                  ref={(element) => {
                    transcriptTextareaRefs.current[section.id] = element;
                  }}
                  value={transcript}
                  onChange={(e) =>
                    handleEditTranscript(section.id, e.target.value)
                  }
                  placeholder="Edit the description above or click 'Record' to dictate..."
                  rows="4"
                  disabled={isCurrentlyRecording}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="recorder-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBack}
          disabled={isSaving}
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "💾 Save as PDF"}
        </button>
      </div>
    </div>
  );
};

export default SectionRecorder;
