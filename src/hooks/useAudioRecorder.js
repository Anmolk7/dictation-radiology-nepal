import { useEffect, useRef, useState, useCallback } from "react";

const useAudioRecorder = () => {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const chunkTimerRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);

  const timerIntervalRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
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

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);

          // Emit the accumulated audio whenever we get data
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob([...audioChunksRef.current], {
              type: "audio/webm;codecs=opus",
            });

            console.log(
              "[Audio] ✓ Emitting accumulated audio blob, size:",
              blob.size,
            );

            window.dispatchEvent(
              new CustomEvent("audio-chunk-ready", {
                detail: { blob, isRecording: true },
              }),
            );
          }
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);

        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

        // Every 2 seconds, request data from MediaRecorder for streaming transcription
        chunkTimerRef.current = setInterval(() => {
          if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
          ) {
            console.log("[Audio] 🎤 Requesting data for transcription chunk");
            mediaRecorderRef.current.requestData();
          }
        }, 2000); // Every 2 seconds instead of 500ms
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (err) {
      setError(`Failed to start recording: ${err.message}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.onstop = () => {
          // Emit final chunk if there's any remaining audio
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, {
              type: "audio/webm;codecs=opus",
            });

            window.dispatchEvent(
              new CustomEvent("audio-chunk-ready", {
                detail: { blob, isRecording: false }, // isRecording = false signals final chunk
              }),
            );

            console.log("[Audio] Emitting final chunk of size:", blob.size);
          }

          const blob = new Blob(audioChunksRef.current, {
            type: "audio/webm;codecs=opus",
          });
          setAudioBlob(blob);
          setIsRecording(false);
          setIsPaused(false);
          setRecordingTime(0);

          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }

          if (chunkTimerRef.current) {
            clearInterval(chunkTimerRef.current);
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

          resolve(blob);
        };

        mediaRecorderRef.current.stop();
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
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
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

      // Every 500ms request data
      chunkTimerRef.current = setInterval(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          console.log("[Audio] 🎤 Requesting data on resume");
          mediaRecorderRef.current.requestData();
        }
      }, 500);
    }
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
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
