# Dictation Tool for Radiology Residents

An Electron desktop application for radiology residents to record voice dictations and automatically transcribe them locally using Google's MedASR model.

## Features

✅ **Cross-platform**: Runs on Windows and macOS  
✅ **Audio Recording**: Record dictations with start/stop/pause/resume controls  
✅ **Real-time Timer**: Display elapsed recording time  
✅ **Playback Preview**: Listen to your recording before saving  
✅ **Medical Transcription**: Convert speech to text using MedASR, trained for medical dictation  
✅ **Patient-based Organization**: Save dictations with patient ID and timestamp  
✅ **Offline Distribution**: Bundles MedASR and FFmpeg after the build machine prepares the authorized model  
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
│       └── useMedASR.js          # MedASR integration
├── package.json            # Dependencies and scripts
├── .gitignore             # Git ignore file
└── dictations/            # Output folder for saved dictations (auto-created)
```

## Prerequisites

- **Node.js 20 LTS+** (for development and packaging)
- **Python 3.10+** (Python 3.11 recommended for MedASR transcription)
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

## Run Locally in Development Mode

From the project directory, install the JavaScript and Python dependencies once:

```bash
npm install --legacy-peer-deps
python3.11 -m pip install -r requirements-medasr.txt
```

Set your Hugging Face read token in the same terminal, then start the app with
Python 3.11:

```bash
export HF_TOKEN=your_hugging_face_read_token
MEDASR_PYTHON=python3.11 npm run dev
```

The first transcription downloads the gated MedASR model. Later transcriptions
run locally. Stop the development app with `Ctrl+C`.

The development command will:

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

### Build a macOS DMG on a new Mac

The build must run on the same CPU architecture as the app you plan to ship. For example, build on an Apple Silicon Mac for Apple Silicon Macs. This project currently produces an Apple Silicon (`arm64`) DMG.

#### 1. Install build prerequisites

Install the Xcode Command Line Tools, then install Homebrew if it is not already available:

```bash
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install Node.js and Python 3.11:

```bash
brew install node@20 python@3.11
```

Confirm the required interpreters are available:

```bash
node --version
python3.11 --version
```

#### 2. Get the project and install its dependencies

Copy the project to the new Mac or clone its repository, then run the following from the project directory:

```bash
npm install --legacy-peer-deps
python3.11 -m pip install --upgrade pip
python3.11 -m pip install -r requirements-medasr.txt
```

`requirements-medasr.txt` installs PyInstaller, which bundles the Python transcription worker used by the desktop app.

#### 3. Download the authorized offline model

Sign in to Hugging Face, open https://huggingface.co/google/medasr, and accept or request access using the same account that will create the token. Once access is approved, create a new read token for that account. In the same terminal, set the token and prepare the model for packaging:

```bash
export HF_TOKEN=your_hugging_face_read_token
npm run prepare-model
```

This downloads the model into `resources/medasr-model/`. The directory is ignored by Git and can add several gigabytes to the final DMG. Do not commit or distribute a model unless its license and Hugging Face conditions permit it.

#### 4. Create the DMG

From the project directory, run the complete packaging command:

```bash
npm run build
```

This command prepares the authorized model, bundles the Python worker and
FFmpeg, builds the React interface, and creates the Electron DMG installer. On
a successful Apple Silicon build, the installer is created at:

```text
dist/Dictation Tool-<version>-arm64.dmg
```

The unpacked application is available in `dist/mac-arm64/` for local testing. Open the DMG and drag **Dictation Tool** to **Applications**.

#### 5. First-run and distribution notes

- The DMG is unsigned. On a different Mac, macOS may show a Gatekeeper warning; Control-click the app and select **Open** for private testing. Sign and notarize the app with an Apple Developer ID before public distribution.
- The generated DMG includes FFmpeg and the downloaded MedASR model. Recipient Macs do not need Homebrew, Python, a Hugging Face account, or a terminal token to transcribe.
- The model is included only after the build machine runs `npm run prepare-model` with an authorized Hugging Face token. Confirm that your intended distribution complies with the model's license and conditions.

### Rebuild after changing code

Run `npm run build` again. The packaging script replaces the prior Python bundle automatically and writes a new DMG to `dist/`.

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

The distributed DMG includes FFmpeg. If this message appears, rebuild the installer using the current `npm run build` command.

### Microphone permission denied

Grant microphone permissions when prompted by your OS

### App won't start

1. Check that you're in the project directory
2. Run `npm install --legacy-peer-deps` again
3. Make sure Node.js version is 14+

### Transcription is slow

- First run downloads the model (~3GB) - this is normal
- Consider upgrading to GPU (requires CUDA setup for faster processing)
- MedASR processing might still be running - allow more time

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
