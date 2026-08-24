# Dictation Tool for Radiology Residents

An Electron desktop application for radiology residents to record voice dictations and automatically transcribe them locally using Google's MedASR model.

## Features

✅ **Cross-platform**: Runs on Windows and macOS  
✅ **Audio Recording**: Record dictations with start/stop/pause/resume controls  
✅ **Real-time Timer**: Display elapsed recording time  
✅ **Playback Preview**: Listen to your recording before saving  
✅ **Medical Transcription**: Convert speech to text using MedASR, trained for medical dictation  
✅ **Patient-based Organization**: Save dictations with patient ID and timestamp  
✅ **Local Processing**: Completely offline transcription using bundled Whisper  
✅ **Simple UI**: Clean, intuitive interface for quick dictations

## Project Structure

```
dictation-radiology-nepal/
├── public/
│   ├── index.html           # React app entry HTML
│   ├── main.js             # Electron main process
│   └── preload.js          # IPC bridge for secure communication
├── src/
│   ├── index.js            # React app entry point
│   ├── App.jsx             # Root component
│   ├── App.css             # Main styles
│   ├── index.css           # Base styles
│   ├── components/
│   │   ├── RecordingPanel.jsx    # Recording controls
│   │   ├── Timer.jsx             # Timer display
│   │   └── PlayerPreview.jsx     # Audio playback
│   └── hooks/
│       ├── useAudioRecorder.js   # Audio recording logic
│       └── useWhisper.js         # Whisper integration
├── package.json            # Dependencies and scripts
├── .gitignore             # Git ignore file
└── dictations/            # Output folder for saved dictations (auto-created)
```

## Prerequisites

- **Node.js 14+** (for development)
- **Python 3.10+** (Python 3.11 recommended for MedASR transcription)
- **FFmpeg**: Install on macOS with `brew install ffmpeg`
- **Hugging Face account**: Accept the MedASR model conditions at https://huggingface.co/google/medasr

## Installation & Setup

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Install MedASR

Install Python 3.11 on macOS if `python3 --version` reports an older version:

```bash
brew install python@3.11
```

```bash
python3.11 -m pip install --upgrade pip
python3.11 -m pip install -r requirements-medasr.txt
```

Create a Hugging Face read token at https://huggingface.co/settings/tokens, then make it available before starting the app:

```bash
export HF_TOKEN=your_hugging_face_read_token
```

Start the application with the same supported Python interpreter:

```bash
MEDASR_PYTHON=python3.11 npm run dev
```

The first transcription downloads the gated MedASR model. Later transcriptions run locally; CPU inference can take noticeably longer than the recording.

## Development

Run the app in development mode:

```bash
npm run dev
```

This will:

1. Start the React development server on `http://localhost:3000`
2. Open the Electron app window
3. Enable hot-reload for code changes

## Usage

1. **Enter Patient ID**: Type a patient identifier (e.g., RAD001)
2. **Start Recording**: Click "Start Recording" to begin capturing audio
3. **Pause/Resume**: Use pause button if needed (only while recording)
4. **Stop**: Click "Stop Recording" when finished
5. **Preview**: Listen to your recording in the playback preview
6. **Save & Transcribe**: Click button to transcribe and save the dictation

Dictations are saved to `~/<User>/AppData/Roaming/Dictation Tool/dictations/` (Windows) or `~/Library/Application Support/Dictation Tool/dictations/` (macOS) with format: `{PatientID}_{YYYY-MM-DD_HH-MM-SS}.txt`

## Building for Distribution

### Build executables:

```bash
npm run build
```

This creates:

- **Windows**: `.exe` and `.msi` installers in `dist/`
- **macOS**: `.dmg` and `.app` files in `dist/`

### On macOS to build for Windows:

You'll need to use a CI/CD service or a Windows machine. Consider GitHub Actions or similar.

## Future Enhancements

- [ ] AWS S3 integration for encrypted storage
- [ ] Patient database and search functionality
- [ ] Edit and manage saved transcriptions
- [ ] Multiple file format export (PDF, DOCX)
- [ ] Dark mode
- [ ] Voice activity detection (VAD) for auto-stop
- [ ] Cloud backup options
- [ ] Multi-language support

## Troubleshooting

### "MedASR model access denied"

Accept the model conditions at https://huggingface.co/google/medasr and set a valid `HF_TOKEN` with read access.

### "ffmpeg is required"

Install FFmpeg on macOS: `brew install ffmpeg`

### Microphone permission denied

Grant microphone permissions when prompted by your OS

### App won't start

1. Check that you're in the project directory
2. Run `npm install --legacy-peer-deps` again
3. Make sure Node.js version is 14+

### Transcription is slow

- First run downloads the model (~3GB) - this is normal
- Consider upgrading to GPU (requires CUDA setup for faster processing)
- Whisper queue might be processing - allow more time

## Technical Details

- **Electron**: 27.x - Desktop app framework
- **React**: 18.x - UI framework
- **MedASR**: Local medical speech-to-text model (Hugging Face / Google Health)
- **Web Audio API**: Native browser audio capture
- **Electron IPC**: Secure renderer-to-main process communication

## File Saving

Dictations are saved with:

- **Location**: User's app data directory
- **Filename format**: `{PatientID}_{Timestamp}.txt`
- **Format**: Plain UTF-8 text
- **Timestamp**: ISO format with hyphens (e.g., 2026-04-06_14-30-45)

## Security Notes

- Dictations are saved locally on the machine
- MedASR runs locally after its initial Hugging Face model download
- Future S3 integration will support encryption
- Preload script uses context isolation for security

## License

MIT

## Support

For issues or feature requests, please create an issue in the repository.
