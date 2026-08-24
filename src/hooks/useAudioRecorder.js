import { useEffect, useRef, useState, useCallback } from "react";

const useAudioRecorder = () => {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const currentSessionIdRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);

  const timerIntervalRef = useRef(null);

  const startRecording = useCallback(async (sessionId = null) => {
    try {
      setError(null);
      currentSessionIdRef.current = sessionId;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContextRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
      analyserRef.current = audioContextRef.current.createAnalyser();

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      // Set up event handlers before starting
      mediaRecorder.onstart = () => {
        console.log("[Audio] 🎤 MediaRecorder started");
        setIsRecording(true);
        setRecordingTime(0);

        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

        // No automatic data collection - user controls when to stop
      };

      mediaRecorder.onstop = () => {
        console.log("[Audio] ⏹️ MediaRecorder stopped event fired");
      };

      mediaRecorder.onerror = (event) => {
        console.error("[Audio] ❌ MediaRecorder error:", event);
        setError(
          `MediaRecorder error: ${event.error?.message || "Unknown error"}`,
        );
      };

      mediaRecorder.onpause = () => {
        console.log("[Audio] ⏸️ MediaRecorder paused");
      };

      mediaRecorder.onresume = () => {
        console.log("[Audio] ▶️ MediaRecorder resumed");
      };

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          const blob = new Blob(audioChunksRef.current, {
            type: "audio/webm;codecs=opus",
          });
          console.log(
            "[Audio] ✓ Audio chunk collected, size:",
            event.data.size,
          );
          window.dispatchEvent(
            new CustomEvent("audio-chunk-ready", {
              detail: {
                blob,
                isRecording: true,
                sessionId: currentSessionIdRef.current,
              },
            }),
          );
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      // Emit an audio snapshot every second for lower-latency MedASR updates.
      mediaRecorder.start(1000);
    } catch (err) {
      setError(`Failed to start recording: ${err.message}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      console.log("[Audio] 🛑 stopRecording() called");
      console.log(
        "[Audio] - mediaRecorderRef.current:",
        !!mediaRecorderRef.current,
      );
      console.log("[Audio] - isRecording:", isRecording);
      console.log(
        "[Audio] - mediaRecorder.state:",
        mediaRecorderRef.current?.state,
      );

      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.onstop = () => {
          console.log("[Audio] ⏹️ onstop handler fired");
          console.log(
            "[Audio] - Audio chunks: ",
            audioChunksRef.current.length,
          );

          // Create the final blob from all collected chunks
          const blob = new Blob(audioChunksRef.current, {
            type: "audio/webm;codecs=opus",
          });

          console.log("[Audio] ✅ Final blob created, size:", blob.size);
          setAudioBlob(blob);
          setIsRecording(false);
          setIsPaused(false);
          setRecordingTime(0);

          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }

          // Stop all tracks
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach((track) => track.stop());

          // Close audio context
          if (
            audioContextRef.current &&
            audioContextRef.current.state !== "closed"
          ) {
            try {
              audioContextRef.current.close();
            } catch (err) {
              console.warn("Could not close AudioContext:", err.message);
            }
          }

          // Emit a final chunk event so callers can finalize streaming logic
          if (audioChunksRef.current.length > 0) {
            const finalBlob = new Blob(audioChunksRef.current, {
              type: "audio/webm;codecs=opus",
            });
            window.dispatchEvent(
              new CustomEvent("audio-chunk-ready", {
                detail: {
                  blob: finalBlob,
                  isRecording: false,
                  sessionId: currentSessionIdRef.current,
                },
              }),
            );
          }

          resolve(blob);
          audioChunksRef.current = [];
          currentSessionIdRef.current = null;
          mediaRecorderRef.current = null;
        };

        // Request any remaining data from the recorder before stopping
        if (mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.requestData();
        }
        mediaRecorderRef.current.stop();
      } else {
        resolve(null);
      }
    });
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== "closed") {
            audioContextRef.current.close();
          }
        } catch (err) {
          console.warn("Could not close AudioContext:", err.message);
        }
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
};

export default useAudioRecorder;
