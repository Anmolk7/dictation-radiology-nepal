import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import useAudioRecorder from "./hooks/useAudioRecorder";
import useMedASR from "./hooks/useMedASR";
import RecordingPanel from "./components/RecordingPanel.jsx";
import PlayerPreview from "./components/PlayerPreview.jsx";
import TemplateBuilder from "./pages/TemplateBuilder.jsx";
import TemplateManager from "./pages/TemplateManager.jsx";
import SectionRecorder from "./components/SectionRecorder.jsx";
import { createFreeFormTemplate } from "./utils/templateUtils";
import "./App.css";

// Home Page Component
function HomePage({ onStartRecording, onManageTemplates }) {
  return (
    <div className="home-page">
      <div className="home-container">
        <div className="home-header">
          <h1>🏥 Radiology Dictation Tool🇳🇵</h1>
          <p>Fast, structured, accurate medical documentation</p>
        </div>

        <div className="home-grid">
          <button className="home-card primary" onClick={onStartRecording}>
            <div className="card-icon">🎙️</div>
            <h2>Start Recording</h2>
            <p>Record a new dictation and transcribe it to text</p>
          </button>

          <button className="home-card secondary" onClick={onManageTemplates}>
            <div className="card-icon">📚</div>
            <h2>Manage Templates</h2>
            <p>Create, edit, and organize your dictation templates</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// Recording Page Component with Template Workflow
function RecordingPage({
  selectedTemplate,
  onTemplateChange,
  workflowState,
  setWorkflowState,
  workflowData,
  setWorkflowData,
}) {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isElectronReady, setIsElectronReady] = useState(false);
  const [templates, setTemplates] = useState([]);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    error: recordingError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecorder();

  const handleTranscriptionUpdate = useCallback((newTranscript) => {
    setAccumulatedTranscript(newTranscript);
  }, []);

  const {
    isTranscribing,
    transcript,
    error: transcriptError,
    transcribeAudio,
  } = useMedASR(handleTranscriptionUpdate);

  const [accumulatedTranscript, setAccumulatedTranscript] = useState("");
  const transcriptionInProgressRef = useRef(false);
  const pendingAudioRef = useRef(null);

  // Check if Electron API is available
  useEffect(() => {
    if (window.electron && window.electron.transcribeAudio) {
      setIsElectronReady(true);
      console.log("✓ Electron IPC bridge ready");
      loadTemplates();
    } else {
      console.warn(
        "⚠ Electron IPC bridge not available - are you running in Electron?",
      );
    }
  }, []);

  const loadTemplates = async () => {
    try {
      if (window.electron && window.electron.listTemplates) {
        const result = await window.electron.listTemplates();
        setTemplates(result);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    }
  };

  useEffect(() => {
    if (workflowState === "section-recording") {
      return undefined;
    }

    const processLatestAudio = async () => {
      const blob = pendingAudioRef.current;
      if (!blob || transcriptionInProgressRef.current) return;

      pendingAudioRef.current = null;
      transcriptionInProgressRef.current = true;
      try {
        await transcribeAudio(blob);
      } catch (err) {
        console.error("MedASR streaming update failed:", err.message);
      } finally {
        transcriptionInProgressRef.current = false;
        if (pendingAudioRef.current) {
          processLatestAudio();
        }
      }
    };

    const handleAudioChunk = (event) => {
      pendingAudioRef.current = event.detail.blob;
      processLatestAudio();
    };

    window.addEventListener("audio-chunk-ready", handleAudioChunk);
    return () => {
      window.removeEventListener("audio-chunk-ready", handleAudioChunk);
      pendingAudioRef.current = null;
    };
  }, [transcribeAudio, workflowState]);

  const handleSaveAndTranscribe = useCallback(async () => {
    try {
      if (!window.electron) {
        throw new Error(
          "Electron API not available. Make sure you are running in Electron.",
        );
      }

      setSavedMessage("");

      const finalTranscript =
        accumulatedTranscript || transcript || "No transcription available";

      if (!patientId.trim()) {
        setSavedMessage("Error: Patient ID is required");
        return;
      }

      // Store workflow data
      setWorkflowData({
        patientId,
        transcript: finalTranscript,
        selectedTemplate,
      });

      if (selectedTemplate) {
        // Navigate to section recorder
        setWorkflowState("section-recording");
      } else {
        // Save as plain text
        const result = await window.electron.saveDictation({
          patientId,
          transcript: finalTranscript,
        });
        setSavedMessage(result.message);
        // Reset state
        setPatientId("");
        setAccumulatedTranscript("");
        setTimeout(() => {
          setSavedMessage("");
          navigate("/");
        }, 2000);
      }
    } catch (err) {
      setSavedMessage(`Error: ${err.message}`);
    }
  }, [
    transcript,
    patientId,
    accumulatedTranscript,
    selectedTemplate,
    navigate,
    setWorkflowState,
    setWorkflowData,
  ]);

  const handleTemplateSubmit = useCallback(() => {
    setFormError("");

    if (!patientId.trim()) {
      setFormError("Patient ID is required");
      return;
    }

    const template = selectedTemplate || createFreeFormTemplate();

    setWorkflowData({
      patientId,
      selectedTemplate: template,
    });
    if (!selectedTemplate) {
      onTemplateChange(template);
    }
    setWorkflowState("section-recording");
  }, [
    patientId,
    selectedTemplate,
    setWorkflowData,
    setWorkflowState,
    onTemplateChange,
  ]);

  const handleStartRecording = useCallback(async () => {
    setAccumulatedTranscript("");
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  // Section Recording View
  if (workflowState === "section-recording" && selectedTemplate) {
    return (
      <div>
        <SectionRecorder
          patientId={workflowData.patientId}
          template={selectedTemplate}
          onSave={() => {
            setWorkflowState("recording");
            setPatientId("");
            setAccumulatedTranscript("");
            onTemplateChange(null);
            navigate("/");
          }}
          onBack={() => setWorkflowState("recording")}
        />
      </div>
    );
  }

  // Recording View
  return (
    <div className="app">
      <div className="container">
        {!isElectronReady && (
          <div className="warning">
            ⚠ Running in browser mode. For full functionality, please run with:{" "}
            <code>npm run dev</code>
          </div>
        )}

        <RecordingPanel
          isRecording={isRecording}
          isPaused={isPaused}
          recordingTime={recordingTime}
          patientId={patientId}
          setPatientId={setPatientId}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          isTranscribing={isTranscribing}
          onSaveAndTranscribe={handleSaveAndTranscribe}
          audioBlob={audioBlob}
          templates={templates}
          selectedTemplate={selectedTemplate}
          onTemplateChange={onTemplateChange}
          onTemplateSubmit={handleTemplateSubmit}
          onHomeClick={() => navigate("/")}
          formError={formError}
        />

        {audioBlob && !isRecording && <PlayerPreview audioBlob={audioBlob} />}

        {(isRecording ||
          isTranscribing ||
          accumulatedTranscript ||
          transcript) && (
          <div className="transcript">
            <h3>Live Transcription</h3>
            {accumulatedTranscript || transcript ? (
              <p>{accumulatedTranscript || transcript}</p>
            ) : (
              <div className="listening-indicator">
                {isTranscribing
                  ? "Transcribing audio…"
                  : "Listening for dictation…"}
              </div>
            )}
          </div>
        )}

        {recordingError && <div className="error">{recordingError}</div>}
        {transcriptError && <div className="error">{transcriptError}</div>}
        {savedMessage && <div className="success">{savedMessage}</div>}
      </div>
    </div>
  );
}

// Main App Component with Routing
function App() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [workflowState, setWorkflowState] = useState("recording");
  const [workflowData, setWorkflowData] = useState({});
  const navigate = useNavigate();

  const handleStartRecording = () => {
    setSelectedTemplate(null);
    setWorkflowState("recording");
    navigate("/recording");
  };

  const handleManageTemplates = () => {
    navigate("/templates");
  };

  const handleTemplateBuilderSave = () => {
    navigate("/templates");
    setEditingTemplate(null);
  };

  const handleCreateNewTemplate = () => {
    setEditingTemplate(null);
    navigate("/template-builder");
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    navigate("/template-builder");
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            onStartRecording={handleStartRecording}
            onManageTemplates={handleManageTemplates}
          />
        }
      />
      <Route
        path="/recording"
        element={
          <RecordingPage
            selectedTemplate={selectedTemplate}
            onTemplateChange={setSelectedTemplate}
            workflowState={workflowState}
            setWorkflowState={setWorkflowState}
            workflowData={workflowData}
            setWorkflowData={setWorkflowData}
          />
        }
      />
      <Route
        path="/templates"
        element={
          <TemplateManager
            onCreateNew={handleCreateNewTemplate}
            onEditTemplate={handleEditTemplate}
            onBack={() => navigate("/")}
          />
        }
      />
      <Route
        path="/template-builder"
        element={
          <TemplateBuilder
            onSave={handleTemplateBuilderSave}
            onCancel={() => navigate("/templates")}
            initialTemplate={editingTemplate}
          />
        }
      />
    </Routes>
  );
}

// Wrap with Router
export default function AppWithRouter() {
  return (
    <Router>
      <App />
    </Router>
  );
}
