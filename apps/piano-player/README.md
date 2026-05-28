# Piano Player

Static browser frontend for Oh-My-Score. It plays MIDI files, renders an
interactive 3D piano, supports mouse/touch/keyboard performance input, and can
call the transcription API to convert uploaded audio files into MIDI.

## Run

The preferred local runtime is the root Docker Compose setup:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

This folder is also a static site. You can serve it with any static file server,
or deploy it through GitHub Pages. Static hosting supports MIDI playback and the
3D piano UI; audio-to-MIDI conversion needs a running backend.

## Files

- `index.html` is the static entrypoint.
- `styles/player.css` contains the UI styling.
- `scripts/player.js` contains upload, playback, keyboard, and 3D piano logic.
- `assets/` stores local brand/UI assets.
- `vendor/` stores browser libraries used directly by the static page.
