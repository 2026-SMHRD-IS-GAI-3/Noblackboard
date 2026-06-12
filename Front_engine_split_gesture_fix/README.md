# AirNote Local Setup

This project runs the AirNote frontend and a local Korean STT server.

## First-Time Setup

1. Install Node.js LTS.
2. Install Python 3.10 or newer.
3. Java is checked by the setup script because some AirNote backend workflows may need it. The frontend and local STT server can still run without Java.
4. Double-click `setup.bat`.

`setup.bat` does the following:

- checks Node, npm, Python, and Java
- runs `npm install`
- creates `stt_server\.venv`
- installs Python STT dependencies
- prepares the faster-whisper `medium` model

The model download happens only the first time. Later runs load the model from the local model folder.

This project can also be distributed with the prepared runtime already included:

```text
stt_server\.venv
stt_server\cuda-runtime
stt_server\models
```

When those folders exist, `run_all.bat` runs STT entirely from this project.
It does not require the old `C:\Users\SMHRD\Desktop\airnote-stt\airnote-stt`
folder or the user Hugging Face cache.

To test only the bundled STT server, run:

```text
stt_server\run_stt.bat
```

Then open `http://localhost:5000/health`. The response should report
`local_model_only: true`.

## Run AirNote

Double-click `run_all.bat`.

It opens two command windows:

- STT server: `http://localhost:5000`
- frontend dev server: usually `http://localhost:5173`

Open:

```text
http://localhost:5173/pages/presentation.html
```

## STT Model

AirNote always uses faster-whisper `medium` for STT accuracy.

Model location:

```text
stt_server\models
```

This folder is ignored by Git because model files are large.

The STT server tries GPU first:

```text
device=cuda, compute_type=int8_float16
```

If GPU loading fails, it automatically falls back to CPU:

```text
device=cpu, compute_type=int8
```

## STT Server API

Default server:

```text
http://localhost:5000
```

Useful endpoints:

- `GET /health`
- `POST /warmup`
- `POST /stt`

The frontend uses `http://localhost:5000` by default. If STT is off or unavailable, AirNote disables STT only. Webcam gestures, pointer, writing, page movement, and the PDF viewer continue to work.

## Troubleshooting

### `setup.bat` says Node.js is missing

Install Node.js LTS, reopen the terminal, then run `setup.bat` again.

### `setup.bat` says Python is missing

Install Python 3.10 or newer. During installation, enable `Add python.exe to PATH`.

### Model download is slow

The first setup downloads faster-whisper `medium`. This is expected. After it is stored in `stt_server\models`, future runs load from disk.

### GPU STT fails

The server automatically falls back to CPU `int8`. Check `http://localhost:5000/health` to see which device is active.

### STT is disabled in the app

Make sure `run_all.bat` is running and that the STT server window shows Uvicorn on port `5000`. Then reload the presentation page.

### Port 5000 is already in use

Close the other program using port `5000`, then run `run_all.bat` again.

## Legacy `airnote-stt` Folder

The new runtime path is `stt_server`. The frontend no longer depends on `airnote-stt`.

Do not delete `airnote-stt` until you have verified on your machine that:

- `setup.bat` completes
- `run_all.bat` starts both servers
- `http://localhost:5000/health` responds
- STT works on the presentation page
