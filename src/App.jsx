import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import useAudioRecorder from "./hooks/useAudioRecorder";
import useWhisper from "./hooks/useWhisper";
import RecordingPanel from "./components/RecordingPanel.jsx";
import PlayerPreview from "./components/PlayerPreview.jsx";
import TemplateBuilder from "./pages/TemplateBuilder.jsx";
import TemplateManager from "./pages/TemplateManager.jsx";
import SectionRecorder from "./components/SectionRecorder.jsx";
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
  const [transcribingChunks, setTranscribingChunks] = useState("");
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

  const handleStreamingUpdate = useCallback((newTranscript) => {
    setAccumulatedTranscript(newTranscript);
  }, []);

  const {
    isTranscribing,
    transcript,
    error: transcriptError,
    transcribeAudio,
  } = useWhisper(
    handleStreamingUpdate,
    null,
    workflowState !== "section-recording",
  );

  const [isStreamingTranscription, setIsStreamingTranscription] =
    useState(false);
  const [accumulatedTranscript, setAccumulatedTranscript] = useState("");
  const streamingTranscriptRef = useRef("");

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

  // Listen for audio chunks and transcribe them in real-time
  useEffect(() => {
    if (workflowState === "section-recording") {
      return undefined;
    }

    let currentStreamingProcess = null;

    const handleAudioChunk = async (event) => {
      const { blob, isRecording: stillRecording } = event.detail;

      if (!window.electron) {
        console.warn("❌ Cannot transcribe chunk - Electron API not available");
        return;
      }

      try {
        if (!isStreamingTranscription && stillRecording) {
          console.log("🎤 Starting streaming transcription...");
          setIsStreamingTranscription(true);
          streamingTranscriptRef.current = "";
          currentStreamingProcess = transcribeAudio(blob, true);
        } else if (isStreamingTranscription && stillRecording) {
          console.log(
            "🎤 Continuing streaming transcription with new chunk...",
          );
          if (currentStreamingProcess) {
            await currentStreamingProcess;
          }
          currentStreamingProcess = transcribeAudio(blob, true);
        } else if (!stillRecording) {
          console.log("🎤 Finalizing streaming transcription...");
          setIsStreamingTranscription(false);
          if (currentStreamingProcess) {
            await currentStreamingProcess;
          }
          currentStreamingProcess = null;
        }
      } catch (err) {
        console.error("❌ Error in streaming transcription:", err.message);
        setIsStreamingTranscription(false);
        currentStreamingProcess = null;
      }
    };

    console.log("🎧 Setting up audio-chunk-ready listener for streaming");
    window.addEventListener("audio-chunk-ready", handleAudioChunk);

    return () => {
      console.log("🎧 Removing audio-chunk-ready listener");
      window.removeEventListener("audio-chunk-ready", handleAudioChunk);
      if (currentStreamingProcess) {
        currentStreamingProcess = null;
      }
    };
  }, [workflowState, isStreamingTranscription, transcribeAudio]);

  const handleSaveAndTranscribe = useCallback(async () => {
    try {
      if (!window.electron) {
        throw new Error(
          "Electron API not available. Make sure you are running in Electron.",
        );
      }

      setSavedMessage("");

      const finalTranscript =
        accumulatedTranscript ||
        transcript ||
        transcribingChunks ||
        "No transcription available";

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
        setTranscribingChunks("");
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
    transcribingChunks,
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

    if (!selectedTemplate) {
      setFormError("Please select a dictation template to continue");
      return;
    }

    setWorkflowData({
      patientId,
      selectedTemplate,
    });
    setWorkflowState("section-recording");
  }, [patientId, selectedTemplate, setWorkflowData, setWorkflowState]);

  const handleStartRecording = useCallback(async () => {
    setTranscribingChunks("");
    setAccumulatedTranscript("");
    streamingTranscriptRef.current = "";
    await startRecording();
  }, [startRecording]);

  const handleClearTranscript = useCallback(() => {
    setTranscribingChunks("");
    setAccumulatedTranscript("");
    streamingTranscriptRef.current = "";
  }, []);

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
            setTranscribingChunks("");
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
          onStop={stopRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          isTranscribing={isTranscribing || isStreamingTranscription}
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
