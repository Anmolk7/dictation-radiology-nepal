import React, { useState, useCallback, useEffect, useRef } from "react";
import useAudioRecorder from "./hooks/useAudioRecorder";
import useWhisper from "./hooks/useWhisper";
import PlayerPreview from "./components/PlayerPreview";
import "./App.css";

function App() {
  const [patientId, setPatientId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [isElectronReady, setIsElectronReady] = useState(false);
  const [transcribingChunks, setTranscribingChunks] = useState("");

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
  } = useWhisper(handleStreamingUpdate);

  // State for streaming transcription
  const [isStreamingTranscription, setIsStreamingTranscription] =
    useState(false);
  const [accumulatedTranscript, setAccumulatedTranscript] = useState("");
  const streamingTranscriptRef = useRef("");

  // Check if Electron API is available
  useEffect(() => {
    if (window.electron && window.electron.transcribeAudio) {
      setIsElectronReady(true);
      console.log("✓ Electron IPC bridge ready");
    } else {
      console.warn(
        "⚠ Electron IPC bridge not available - are you running in Electron?",
      );
    }
  }, []);

  // Listen for audio chunks and transcribe them in real-time using streaming
  useEffect(() => {
    let currentStreamingProcess = null;

    const handleAudioChunk = async (event) => {
      const { blob, isRecording: stillRecording } = event.detail;

      if (!window.electron) {
        console.warn("❌ Cannot transcribe chunk - Electron API not available");
        return;
      }

      try {
        // Start streaming transcription if not already started
        if (!isStreamingTranscription && stillRecording) {
          console.log("🎤 Starting streaming transcription...");
          setIsStreamingTranscription(true);
          streamingTranscriptRef.current = "";

          // Start the streaming transcription process
          currentStreamingProcess = transcribeAudio(blob, true);
        } else if (isStreamingTranscription && stillRecording) {
          // Continue streaming with new chunk
          console.log(
            "🎤 Continuing streaming transcription with new chunk...",
          );
          if (currentStreamingProcess) {
            // Wait for previous chunk to complete before starting new one
            await currentStreamingProcess;
          }
          currentStreamingProcess = transcribeAudio(blob, true);
        } else if (!stillRecording) {
          // Recording stopped, finalize transcription
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
  }, [isStreamingTranscription, transcribeAudio]);

  const handleSaveAndTranscribe = useCallback(async () => {
    try {
      if (!window.electron) {
        throw new Error(
          "Electron API not available. Make sure you are running in Electron.",
        );
      }

      setSavedMessage("");

      // Use the accumulated streaming transcript, or fallback to other sources
      const finalTranscript =
        accumulatedTranscript ||
        transcript ||
        transcribingChunks ||
        "No transcription available";

      // Save to file
      const result = await window.electron.saveDictation({
        patientId,
        transcript: finalTranscript,
      });

      setSavedMessage(result.message);

      // Reset state
      setPatientId("");
      setTranscribingChunks("");
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (err) {
      setSavedMessage(`Error: ${err.message}`);
    }
  }, [transcribingChunks, transcript, patientId, accumulatedTranscript]);

  const handleStartRecording = useCallback(async () => {
    setTranscribingChunks(""); // Clear previous chunk transcript
    setAccumulatedTranscript(""); // Clear accumulated transcript
    streamingTranscriptRef.current = ""; // Clear ref
    await startRecording();
  }, [startRecording]);

  const handleClearTranscript = useCallback(() => {
    setTranscribingChunks("");
    setAccumulatedTranscript("");
    streamingTranscriptRef.current = "";
  }, []);

  return (
    <div className="app">
      <div className="container">
        {!isElectronReady && (
          <div className="warning">
            ⚠ Running in browser mode. For full functionality, please run with:{" "}
            <code>npm run dev</code>
          </div>
        )}

        {audioBlob && !isRecording && <PlayerPreview audioBlob={audioBlob} />}

        {(isRecording ||
          accumulatedTranscript ||
          transcript ||
          transcribingChunks) && (
          <div className="transcript">
            <div className="transcript-header">
              <h3>📝 Live Transcription:</h3>
              <button
                className="btn btn-clear"
                onClick={handleClearTranscript}
                disabled={
                  isRecording || isTranscribing || isStreamingTranscription
                }
                title="Clear transcription and start fresh"
              >
                Clear
              </button>
            </div>
            <p>
              {accumulatedTranscript ||
                transcript ||
                transcribingChunks ||
                (!isRecording ? "No transcription yet" : "")}
            </p>
            {isRecording && !transcript && !transcribingChunks && (
              <div className="listening-indicator">🎤 Listening...</div>
            )}
            {(isTranscribing || isStreamingTranscription) && (
              <span className="transcribing-indicator">Writing...</span>
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

export default App;
