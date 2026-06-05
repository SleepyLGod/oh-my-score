
MIDI.loader = new widgets.Loader({ message: "Loading: Soundfonts...", background: "rgba(16,18,21,0.88)" });
var localTranscriptionApiUrl = "http://localhost:8084/transcription/audioToMidiWithFile";
var localTranscriptionJobsApiUrl = "http://localhost:8084/transcription/jobs";
var localStrudelSketchApiUrl = "http://localhost:8091/generate";
var localAiSketchApiUrl = "http://localhost:8092/suggest";
var transcriptionApiUrl = window.OMG_TRANSCRIPTION_API_URL || defaultTranscriptionApiUrl();
var transcriptionJobsApiUrl = window.OMG_TRANSCRIPTION_JOBS_API_URL || defaultTranscriptionJobsApiUrl();
var strudelSketchApiUrl = window.OMG_STRUDEL_SKETCH_API_URL || defaultStrudelSketchApiUrl();
var aiSketchApiUrl = window.OMG_AI_SKETCH_API_URL || defaultAiSketchApiUrl();
var activeMidiUrl = null;
var convertedMidiUrl = null;
var localMidiUrl = null;
var cleanedMidiUrl = null;
var cleanedPlaybackUrl = null;
var presetMidiUrl = null;
var presetPlaybackUrl = null;
var strudelMidiUrl = null;
var activeMidiBytes = null;
var cleanedMidiBytes = null;
var presetMidiBytes = null;
var strudelMidiBlob = null;
var strudelDownloadName = "";
var strudelPlaybackTitle = "";
var sourceMidiDownloadUrl = null;
var sourceMidiTitle = "";
var sourceAudioUrl = null;
var presetCreatedLabel = "";
var midiReady = false;
var loopEnabled = false;
var loopRestartQueued = false;
var uploadPanel = document.getElementById("upload-panel");
var settingsPanel = document.getElementById("settings-panel");
var staticPreviewBanner = document.getElementById("static-preview-banner");
var workspaceModeInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="workspace-mode"]'));
var uploadFileInput = document.getElementById("audio-file");
var midiFileInput = document.getElementById("midi-file");
var convertButton = document.getElementById("convert-button");
var uploadStatus = document.getElementById("upload-status");
var conversionResult = document.getElementById("conversion-result");
var conversionResultText = document.getElementById("conversion-result-text");
var downloadMidiLink = document.getElementById("download-midi-link");
var retryConvertButton = document.getElementById("retry-convert-button");
var fileName = document.getElementById("file-name");
var sourceAudioPreview = document.getElementById("source-audio-preview");
var sourceAudioPlayer = document.getElementById("source-audio-player");
var conversionModeInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="conversion-mode"]'));
var compareResultsPanel = document.getElementById("compare-results");
var clearCompareResultsButton = document.getElementById("clear-compare-results-button");
var compareCards = Array.prototype.slice.call(document.querySelectorAll(".compare-card"));
var sketchPanel = document.getElementById("sketch-panel");
var sketchResizer = document.getElementById("sketch-resizer");
var strudelExampleSelect = document.getElementById("strudel-example");
var strudelCodeInput = document.getElementById("strudel-code");
var strudelBarsSelect = document.getElementById("strudel-bars");
var strudelBpmInput = document.getElementById("strudel-bpm");
var aiModelSelect = document.getElementById("ai-model");
var aiStyleSelect = document.getElementById("ai-style");
var aiPromptInput = document.getElementById("ai-prompt");
var aiEditPromptInput = document.getElementById("ai-edit-prompt");
var generateAiSketchButton = document.getElementById("generate-ai-sketch-button");
var midiToStrudelButton = document.getElementById("midi-to-strudel-button");
var explainAiSketchButton = document.getElementById("explain-ai-sketch-button");
var applyAiEditButton = document.getElementById("apply-ai-edit-button");
var aiSketchStatus = document.getElementById("ai-sketch-status");
var aiSketchMeta = document.getElementById("ai-sketch-meta");
var strudelDraftSelect = document.getElementById("strudel-draft-select");
var saveStrudelDraftButton = document.getElementById("save-strudel-draft-button");
var loadStrudelDraftButton = document.getElementById("load-strudel-draft-button");
var duplicateStrudelDraftButton = document.getElementById("duplicate-strudel-draft-button");
var resetStrudelExampleButton = document.getElementById("reset-strudel-example-button");
var tidyStrudelButton = document.getElementById("tidy-strudel-button");
var clearStrudelButton = document.getElementById("clear-strudel-button");
var generateStrudelButton = document.getElementById("generate-strudel-button");
var strudelStatus = document.getElementById("strudel-status");
var strudelResult = document.getElementById("strudel-result");
var strudelResultTitle = document.getElementById("strudel-result-title");
var strudelMetrics = document.getElementById("strudel-metrics");
var noteActivitySummary = document.getElementById("note-activity-summary");
var noteActivityGrid = document.getElementById("note-activity-grid");
var noteDensitySummary = document.getElementById("note-density-summary");
var noteDensityGrid = document.getElementById("note-density-grid");
var previewStrudelButton = document.getElementById("preview-strudel-button");
var loadStrudelButton = document.getElementById("load-strudel-button");
var downloadStrudelLink = document.getElementById("download-strudel-link");
var midiFileName = document.getElementById("midi-file-name");
var midiStatus = document.getElementById("midi-status");
var midiStatusText = document.getElementById("midi-status-text");
var songSelect = document.getElementById("song-select");
var activeSongTitle = document.getElementById("active-song-title");
var speedSlider = document.getElementById("speed-slider");
var speedValue = document.getElementById("speed-value");
var octaveSlider = document.getElementById("octave-slider");
var octaveValue = document.getElementById("octave-value");
var keyboardOctaveValue = document.getElementById("keyboard-octave-value");
var noteColorInput = document.getElementById("note-color");
var playButton = document.getElementById("play-button");
var stopButton = document.getElementById("stop-button");
var restartButton = document.getElementById("restart-button");
var loopButton = document.getElementById("loop-button");
var resetViewButton = document.getElementById("reset-view-button");
var timelineSlider = document.getElementById("timeline-slider");
var timelineGrid = document.getElementById("timeline-grid");
var currentTimeReadout = document.getElementById("current-time");
var durationTimeReadout = document.getElementById("duration-time");
var barBeatReadout = document.getElementById("bar-beat-readout");
var totalBarsReadout = document.getElementById("total-bars-readout");
var loopStartButton = document.getElementById("loop-start-button");
var loopEndButton = document.getElementById("loop-end-button");
var loopClearButton = document.getElementById("loop-clear-button");
var loopRangeStatus = document.getElementById("loop-range-status");
var stageTipsButton = document.getElementById("stage-tips-button");
var stageTipsPopover = document.getElementById("stage-tips-popover");
var lowerKeyRow = document.getElementById("lower-key-row");
var middleKeyRow = document.getElementById("middle-key-row");
var upperKeyRow = document.getElementById("upper-key-row");
var analysisDisclosureStatus = document.getElementById("analysis-disclosure-status");
var analysisStatus = document.getElementById("analysis-status");
var analysisDuration = document.getElementById("analysis-duration");
var analysisTempo = document.getElementById("analysis-tempo");
var analysisTracks = document.getElementById("analysis-tracks");
var analysisChannels = document.getElementById("analysis-channels");
var analysisPrograms = document.getElementById("analysis-programs");
var analysisNotes = document.getElementById("analysis-notes");
var analysisPitchRange = document.getElementById("analysis-pitch-range");
var analysisPolyphony = document.getElementById("analysis-polyphony");
var downloadSourceMidiLink = document.getElementById("download-source-midi-link");
var cleanMidiButton = document.getElementById("clean-midi-button");
var downloadCleanedMidiLink = document.getElementById("download-cleaned-midi-link");
var loadCleanedMidiButton = document.getElementById("load-cleaned-midi-button");
var cleanupStatus = document.getElementById("cleanup-status");
var cleanupShortNoteSelect = document.getElementById("cleanup-short-note");
var cleanupDuplicatesInput = document.getElementById("cleanup-duplicates");
var cleanupVelocitySelect = document.getElementById("cleanup-velocity");
var arrangementPresetSelect = document.getElementById("arrangement-preset");
var melodySoundField = document.getElementById("melody-sound-field");
var melodySoundSelect = document.getElementById("melody-sound");
var bassSplitField = document.getElementById("bass-split-field");
var bassSplitPointSelect = document.getElementById("bass-split-point");
var createPresetMidiButton = document.getElementById("create-preset-midi-button");
var downloadPresetMidiLink = document.getElementById("download-preset-midi-link");
var loadPresetMidiButton = document.getElementById("load-preset-midi-button");
var presetStatus = document.getElementById("preset-status");
var analysisRequestId = 0;
var timelineDurationSeconds = 0;
var timelineBpm = 120;
var timelineBeatsPerBar = 4;
var loopRangeStartSeconds = null;
var loopRangeEndSeconds = null;
var activePlaybackProgram = 0;
var activePlaybackPrograms = null;
var strudelDraftStorageKey = "oh-my-score:strudel-drafts:v1";
var sketchIdeWidthStorageKey = "oh-my-score:sketch-ide-width:v1";
var sketchMinimumStageWidth = 700;
var sketchGap = 22;
var activePlaybackIsPreview = false;
var previewRestoreState = null;
var presetPlaybackOptions = null;
var isSeekingTimeline = false;
var wasPlayingBeforeSeek = false;
var playbackClockStartMs = 0;
var playbackClockBaseSeconds = 0;
var conversionPollDelayMs = 1200;
var maxConversionPollAttempts = 500;
var strudelExamples = {
    arpeggio: `import { note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";

export const metadata = {
  name: "strudel-sketch",
  title: "Arpeggio Sketch"
};

const melody = note(seq("C4", "D4", "E4", "G4", "A4", "G4", "E4", "D4"));
const bass = note(seq("C2", "G1", "A1", "F1")).slow(2);

export const pattern = stack(bass, melody);
export default pattern;
`,
    bassline: `import { note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";

export const metadata = {
  name: "bassline-sketch",
  title: "Bassline Sketch"
};

const bass = note(seq("C2", "C2", "G1", "A1", "F1", "F1", "G1", "G1"));
const pulse = note(seq("C3", "G2")).slow(4);

export const pattern = stack(bass, pulse);
export default pattern;
`,
    chords: `import { note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";

export const metadata = {
  name: "chord-sketch",
  title: "Chord Sketch"
};

const root = note(seq("C3", "F3", "A2", "G2")).slow(2);
const third = note(seq("E3", "A3", "C3", "B2")).slow(2);
const fifth = note(seq("G3", "C4", "E3", "D3")).slow(2);
const top = note(seq("C4", "A3", "E4", "D4"));

export const pattern = stack(root, third, fifth, top);
export default pattern;
`,
    minimal: `import { note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";

export const metadata = {
  name: "minimal-melody",
  title: "Minimal Melody"
};

const melody = note(seq("D4", "F4", "A4", "G4", "F4", "D4")).slow(2);
const drone = note(seq("D2")).slow(8);

export const pattern = stack(drone, melody);
export default pattern;
`
};
var defaultStrudelExample = "arpeggio";
var noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var conversionEngines = {
    "piano-onnx": { label: "Piano ONNX", description: "Piano-focused baseline" },
    "basic-pitch": { label: "Basic Pitch", description: "Experimental general audio" }
};
var compareResults = {};
var arrangementPresets = {
    piano: { label: "Piano", program: 0, instrument: "acoustic_grand_piano" },
    strings: { label: "Strings", program: 48, instrument: "string_ensemble_1" },
    "soft-synth": { label: "Soft Synth", program: 88, instrument: "pad_1_new_age" },
    "bass-melody": { label: "Bass + Melody", split: true, bassProgram: 32, bassInstrument: "acoustic_bass", splitPitch: 60 }
};
var bassMelodySplitPoints = {
    57: { label: "A3", pitch: 57 },
    60: { label: "C4", pitch: 60 },
    64: { label: "E4", pitch: 64 },
    67: { label: "G4", pitch: 67 }
};
var presetSoundfontInstruments = [
    arrangementPresets.piano.instrument,
    arrangementPresets.strings.instrument,
    arrangementPresets["soft-synth"].instrument,
    arrangementPresets["bass-melody"].bassInstrument
];
var keyboardLayoutRows = [
    {
        element: lowerKeyRow,
        keys: [
            { label: "Z", code: 90, offset: 0 },
            { label: "S", code: 83, offset: 1 },
            { label: "X", code: 88, offset: 2 },
            { label: "D", code: 68, offset: 3 },
            { label: "C", code: 67, offset: 4 },
            { label: "V", code: 86, offset: 5 },
            { label: "G", code: 71, offset: 6 },
            { label: "B", code: 66, offset: 7 },
            { label: "H", code: 72, offset: 8 },
            { label: "N", code: 78, offset: 9 },
            { label: "J", code: 74, offset: 10 },
            { label: "M", code: 77, offset: 11 },
            { label: ",", code: 188, offset: 12 }
        ]
    },
    {
        element: middleKeyRow,
        keys: [
            { label: "Q", code: 81, offset: 12 },
            { label: "2", code: 50, offset: 13 },
            { label: "W", code: 87, offset: 14 },
            { label: "3", code: 51, offset: 15 },
            { label: "E", code: 69, offset: 16 },
            { label: "R", code: 82, offset: 17 },
            { label: "5", code: 53, offset: 18 },
            { label: "T", code: 84, offset: 19 },
            { label: "6", code: 54, offset: 20 },
            { label: "Y", code: 89, offset: 21 },
            { label: "7", code: 55, offset: 22 },
            { label: "U", code: 85, offset: 23 }
        ]
    },
    {
        element: upperKeyRow,
        keys: [
            { label: "I", code: 73, offset: 24 },
            { label: "9", code: 57, offset: 25 },
            { label: "O", code: 79, offset: 26 },
            { label: "0", code: 48, offset: 27 },
            { label: "P", code: 80, offset: 28 },
            { label: "[", code: 219, offset: 29 },
            { label: "=", code: 187, offset: 30 },
            { label: "]", code: 221, offset: 31 }
        ]
    }
];
var keyCodeToOffset = {};

function isLocalFrontendHost() {
    var host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
}

function defaultTranscriptionApiUrl() {
    if (isLocalFrontendHost()) {
        return localTranscriptionApiUrl;
    }
    return "";
}

function defaultTranscriptionJobsApiUrl() {
    if (transcriptionApiUrl) {
        return transcriptionApiUrl.replace(/\/(?:audioToMidiWithFile|mp3ToMidiWithFile)$/, "/jobs");
    }
    if (isLocalFrontendHost()) {
        return localTranscriptionJobsApiUrl;
    }
    return "";
}

function defaultStrudelSketchApiUrl() {
    if (isLocalFrontendHost()) {
        return localStrudelSketchApiUrl;
    }
    return "";
}

function defaultAiSketchApiUrl() {
    if (isLocalFrontendHost()) {
        return localAiSketchApiUrl;
    }
    return "";
}

function hasTranscriptionService() {
    return Boolean(transcriptionApiUrl || transcriptionJobsApiUrl);
}

function hasStrudelSketchService() {
    return Boolean(strudelSketchApiUrl);
}

function hasAiSketchService() {
    return Boolean(aiSketchApiUrl);
}

function isHostedStaticMode() {
    return !isLocalFrontendHost()
        && !hasTranscriptionService()
        && !hasStrudelSketchService()
        && !hasAiSketchService();
}

function conversionWaitingStatus() {
    if (!uploadFileInput.files.length) return "Waiting";
    return hasTranscriptionService()
        ? "Ready to convert"
        : "Static preview: audio conversion requires local Docker.";
}

function setButtonAvailability(button, available, title) {
    if (!button) return;
    button.disabled = !available;
    if (title) {
        button.title = title;
    } else {
        button.removeAttribute("title");
    }
}

function updateLocalServiceControls() {
    var hostedStatic = isHostedStaticMode();
    document.body.classList.toggle("static-preview-mode", hostedStatic);
    document.body.dataset.runtimeMode = hostedStatic ? "static-preview" : "local-studio";
    if (staticPreviewBanner) {
        staticPreviewBanner.hidden = !hostedStatic;
    }

    setButtonAvailability(
        generateStrudelButton,
        hasStrudelSketchService(),
        hasStrudelSketchService() ? "" : "Strudel MIDI generation requires local Docker."
    );
    [generateAiSketchButton, midiToStrudelButton, explainAiSketchButton, applyAiEditButton].forEach(function (button) {
        setButtonAvailability(
            button,
            hasAiSketchService(),
            hasAiSketchService() ? "" : "AI Sketch requires local Docker and a configured model key."
        );
    });
}

function applyRuntimeModeMessaging() {
    updateLocalServiceControls();
    if (!isHostedStaticMode()) return;
    setUploadStatus("Static preview: audio conversion requires local Docker.");
    setStrudelStatus("Static preview: Generate MIDI requires local Docker.");
    setAiSketchStatus("Static preview: AI Sketch requires local Docker.");
    setAiSketchMeta("Demo MIDI, Open MIDI, playback, Smart Score, cleanup, and presets still work in this hosted preview.");
}

function setUploadStatus(message) {
    uploadStatus.textContent = message;
}

function hideConversionResult() {
    conversionResult.hidden = true;
    conversionResultText.textContent = "No MIDI generated yet";
    downloadMidiLink.removeAttribute("href");
    downloadMidiLink.removeAttribute("download");
}

function showConversionResult(downloadName, blob) {
    conversionResult.hidden = false;
    conversionResultText.textContent = downloadName + " (" + formatBytes(blob.size) + ")";
    downloadMidiLink.href = convertedMidiUrl;
    downloadMidiLink.download = downloadName;
}

function revokeObjectUrl(url) {
    if (url && url.indexOf("blob:") === 0) {
        URL.revokeObjectURL(url);
    }
}

function currentConversionMode() {
    var selected = conversionModeInputs.find(function (input) {
        return input.checked;
    });
    return selected ? selected.value : "piano-onnx";
}

function createConversionFormData(file, songName, engine) {
    var formData = new FormData();
    formData.append("file", file);
    formData.append("songName", songName);
    if (engine) {
        formData.append("engine", engine);
    }
    return formData;
}

function setSourceAudioPreview(file) {
    if (sourceAudioUrl) {
        revokeObjectUrl(sourceAudioUrl);
        sourceAudioUrl = null;
    }
    if (!file) {
        sourceAudioPreview.hidden = true;
        sourceAudioPlayer.removeAttribute("src");
        sourceAudioPlayer.load();
        return;
    }
    sourceAudioUrl = URL.createObjectURL(file);
    sourceAudioPlayer.src = sourceAudioUrl;
    sourceAudioPreview.hidden = false;
}

function restorePlaybackAfterPreview() {
    if (!activePlaybackIsPreview) return;
    if (previewRestoreState && previewRestoreState.url) {
        var restoreState = previewRestoreState;
        previewRestoreState = null;
        activePlaybackIsPreview = false;
        activeSongTitle.textContent = restoreState.title || activeSongTitle.textContent;
        loadMidiPlayback(restoreState.url, false, {
            playbackProgram: restoreState.playbackProgram,
            playbackPrograms: restoreState.playbackPrograms
        });
        return;
    }
    stopPlayback();
    activeMidiUrl = null;
    activePlaybackIsPreview = false;
    previewRestoreState = null;
}

function setWorkspaceMode(mode) {
    var isSketchMode = mode === "sketch";
    if (!isSketchMode) {
        restorePlaybackAfterPreview();
    }
    uploadPanel.hidden = isSketchMode;
    settingsPanel.hidden = isSketchMode;
    sketchPanel.hidden = !isSketchMode;
    document.body.classList.toggle("sketch-mode", isSketchMode);
    if (isSketchMode) {
        restoreSketchIdeWidth();
    }
    on_window_resize();
    updateFloatingChromeOffsets();
}

function defaultSketchIdeWidth() {
    return Math.round(window.innerWidth * 0.42);
}

function clampSketchIdeWidth(width) {
    var minimum = 380;
    var maximum = Math.max(minimum, Math.min(
        Math.round(window.innerWidth * 0.65),
        Math.round(window.innerWidth - sketchMinimumStageWidth - sketchGap)
    ));
    return Math.max(minimum, Math.min(maximum, Math.round(width)));
}

function applySketchIdeWidth(width, persist) {
    if (!document.documentElement) return;
    var nextWidth = clampSketchIdeWidth(width);
    document.documentElement.style.setProperty("--sketch-ide-width", nextWidth + "px");
    updateSketchLayoutMetrics();
    if (persist) {
        try {
            localStorage.setItem(sketchIdeWidthStorageKey, String(nextWidth));
        } catch (error) {
            console.warn(error);
        }
    }
    on_window_resize();
    updateFloatingChromeOffsets();
}

function restoreSketchIdeWidth() {
    var storedWidth = null;
    try {
        storedWidth = Number(localStorage.getItem(sketchIdeWidthStorageKey));
    } catch (error) {
        console.warn(error);
    }
    applySketchIdeWidth(storedWidth || defaultSketchIdeWidth(), false);
}

function beginSketchResize(event) {
    document.body.classList.add("is-resizing-sketch");
    if (sketchResizer.setPointerCapture) {
        sketchResizer.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
}

function resizeSketchIde(event) {
    if (!document.body.classList.contains("is-resizing-sketch")) return;
    applySketchIdeWidth(window.innerWidth - event.clientX, true);
}

function endSketchResize(event) {
    if (!document.body.classList.contains("is-resizing-sketch")) return;
    document.body.classList.remove("is-resizing-sketch");
    if (sketchResizer.releasePointerCapture) {
        try {
            sketchResizer.releasePointerCapture(event.pointerId);
        } catch (error) {
            console.warn(error);
        }
    }
    on_window_resize();
    updateFloatingChromeOffsets();
}

function updateFloatingChromeOffsets() {
    updateSketchLayoutMetrics();
    var chrome = document.body && document.body.classList.contains("sketch-mode")
        ? document.getElementById("sketch-review-dock")
        : document.getElementById("transport-bar");
    if (!chrome || !document.documentElement) return;
    var rect = chrome.getBoundingClientRect();
    var safeBottom = Math.max(64, Math.ceil(window.innerHeight - rect.top + 16));
    document.documentElement.style.setProperty("--transport-safe-bottom", safeBottom + "px");
    updateSketchLayoutMetrics();
}

function updateSketchLayoutMetrics() {
    if (!document.body || !document.documentElement) return;
    var isSketchMode = document.body.classList.contains("sketch-mode");
    var dock = document.getElementById("sketch-review-dock");
    if (!isSketchMode || !dock) {
        return;
    }
    var rootStyles = getComputedStyle(document.documentElement);
    var ideWidth = Number.parseFloat(rootStyles.getPropertyValue("--sketch-ide-width")) || clampSketchIdeWidth(defaultSketchIdeWidth());
    var minShellWidth = Math.ceil(sketchMinimumStageWidth + sketchGap + ideWidth);
    var shellWidth = Math.max(window.innerWidth, minShellWidth);
    var leftWidth = Math.max(sketchMinimumStageWidth, Math.ceil(shellWidth - ideWidth - sketchGap));
    document.documentElement.style.setProperty("--sketch-min-shell-width", minShellWidth + "px");
    document.documentElement.style.setProperty("--sketch-shell-width", shellWidth + "px");
    document.documentElement.style.setProperty("--sketch-left-width", leftWidth + "px");
}

function revokeCompareResultUrls() {
    Object.keys(compareResults).forEach(function (engine) {
        revokeObjectUrl(compareResults[engine].url);
    });
}

function resetCompareResults() {
    restorePlaybackAfterPreview();
    revokeCompareResultUrls();
    compareResults = {};
    compareCards.forEach(function (card) {
        var status = card.querySelector(".compare-status");
        var meta = card.querySelector(".compare-meta");
        var metrics = card.querySelector(".compare-metrics");
        var previewButton = card.querySelector(".compare-preview-button");
        var loadButton = card.querySelector(".compare-load-button");
        var downloadLink = card.querySelector(".compare-download-link");
        var engine = card.getAttribute("data-engine");
        status.textContent = "Waiting";
        meta.textContent = conversionEngines[engine].description;
        metrics.textContent = "Waiting for MIDI metrics";
        metrics.hidden = true;
        previewButton.hidden = true;
        loadButton.hidden = true;
        downloadLink.hidden = true;
        downloadLink.removeAttribute("href");
        downloadLink.removeAttribute("download");
    });
}

function hideCompareResults() {
    compareResultsPanel.hidden = true;
    resetCompareResults();
}

function showCompareResults() {
    compareResultsPanel.hidden = false;
    resetCompareResults();
}

function clearCompareResults() {
    hideCompareResults();
    setUploadStatus("Compare results cleared");
}

function updateCompareCard(engine, statusText, metaText) {
    var card = compareCards.find(function (candidate) {
        return candidate.getAttribute("data-engine") === engine;
    });
    if (!card) return;
    card.querySelector(".compare-status").textContent = statusText;
    if (metaText) {
        card.querySelector(".compare-meta").textContent = metaText;
    }
}

function compareMetricsText(blob, summary) {
    return formatDuration(summary.durationSeconds)
        + " · " + formatCount(summary.noteCount, "note", "notes")
        + " · " + summary.pitchRangeLabel
        + " · poly " + summary.maxPolyphony
        + " · " + formatBytes(blob.size);
}

function showCompareResult(engine, job, blob, songName) {
    var card = compareCards.find(function (candidate) {
        return candidate.getAttribute("data-engine") === engine;
    });
    if (!card) return;
    var engineLabel = job.engineLabel || conversionEngines[engine].label;
    var downloadName = songName + "-" + engine + ".mid";
    var url = URL.createObjectURL(blob);
    compareResults[engine] = {
        blob: blob,
        url: url,
        downloadName: downloadName,
        title: songName + " · " + engineLabel
    };

    var elapsed = conversionElapsedText(job);
    updateCompareCard(engine, "Ready", elapsed ? "Converted in " + elapsed : "Converted · " + formatBytes(blob.size));
    var metrics = card.querySelector(".compare-metrics");
    blob.arrayBuffer().then(function (arrayBuffer) {
        if (!compareResults[engine] || compareResults[engine].blob !== blob) return;
        var summary = parseMidiAnalysis(new Uint8Array(arrayBuffer));
        compareResults[engine].summary = summary;
        metrics.textContent = compareMetricsText(blob, summary);
        metrics.hidden = false;
    }).catch(function (error) {
        if (!compareResults[engine] || compareResults[engine].blob !== blob) return;
        console.warn(error);
        metrics.textContent = "Analysis unavailable · " + formatBytes(blob.size);
        metrics.hidden = false;
    });
    var previewButton = card.querySelector(".compare-preview-button");
    var loadButton = card.querySelector(".compare-load-button");
    var downloadLink = card.querySelector(".compare-download-link");
    previewButton.hidden = false;
    loadButton.hidden = false;
    downloadLink.hidden = false;
    downloadLink.href = url;
    downloadLink.download = downloadName;
}

function setStrudelStatus(message) {
    strudelStatus.textContent = message;
    if (!strudelCodeInput) return;
    strudelCodeInput.classList.remove("is-generating", "is-error", "is-ready");
    var lowerMessage = String(message || "").toLowerCase();
    if (lowerMessage.indexOf("generating") >= 0) {
        strudelCodeInput.classList.add("is-generating");
    } else if (lowerMessage.indexOf("error") >= 0
        || lowerMessage.indexOf("failed") >= 0
        || lowerMessage.indexOf("unavailable") >= 0
        || lowerMessage.indexOf("invalid") >= 0
        || lowerMessage.indexOf("unable") >= 0) {
        strudelCodeInput.classList.add("is-error");
    } else {
        strudelCodeInput.classList.add("is-ready");
    }
}

function resetStrudelResult(message) {
    if (activePlaybackIsPreview && activeMidiUrl === strudelMidiUrl) {
        restorePlaybackAfterPreview();
    }
    revokeObjectUrl(strudelMidiUrl);
    strudelMidiUrl = null;
    strudelMidiBlob = null;
    strudelDownloadName = "";
    strudelPlaybackTitle = "";
    strudelResult.hidden = true;
    strudelMetrics.textContent = "Waiting for MIDI metrics";
    downloadStrudelLink.removeAttribute("href");
    downloadStrudelLink.removeAttribute("download");
    resetNoteActivity();
    if (message) {
        setStrudelStatus(message);
    }
}

function selectedStrudelExample() {
    return strudelExamples[strudelExampleSelect.value] ? strudelExampleSelect.value : defaultStrudelExample;
}

function loadStrudelExample(key, message) {
    var exampleKey = strudelExamples[key] ? key : defaultStrudelExample;
    strudelExampleSelect.value = exampleKey;
    strudelCodeInput.value = strudelExamples[exampleKey];
    resetStrudelResult(message || (hasStrudelSketchService()
        ? "Example loaded. Generate MIDI when ready."
        : "Static preview: Generate MIDI requires local Docker."));
}

function readStrudelDrafts() {
    try {
        var rawDrafts = localStorage.getItem(strudelDraftStorageKey);
        var parsedDrafts = rawDrafts ? JSON.parse(rawDrafts) : [];
        return Array.isArray(parsedDrafts) ? parsedDrafts.filter(function (draft) {
            return draft && typeof draft.source === "string";
        }).slice(0, 12) : [];
    } catch (error) {
        console.warn(error);
        return [];
    }
}

function writeStrudelDrafts(drafts) {
    try {
        localStorage.setItem(strudelDraftStorageKey, JSON.stringify(drafts.slice(0, 12)));
        return true;
    } catch (error) {
        console.warn(error);
        setStrudelStatus("Unable to save local draft.");
        return false;
    }
}

function renderStrudelDrafts(selectedId) {
    var drafts = readStrudelDrafts();
    strudelDraftSelect.innerHTML = "";
    if (!drafts.length) {
        var emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "No saved drafts";
        strudelDraftSelect.appendChild(emptyOption);
        strudelDraftSelect.disabled = true;
        loadStrudelDraftButton.disabled = true;
        duplicateStrudelDraftButton.disabled = true;
        return;
    }
    drafts.forEach(function (draft) {
        var option = document.createElement("option");
        option.value = draft.id;
        option.textContent = draft.title;
        strudelDraftSelect.appendChild(option);
    });
    strudelDraftSelect.disabled = false;
    loadStrudelDraftButton.disabled = false;
    duplicateStrudelDraftButton.disabled = false;
    strudelDraftSelect.value = selectedId || drafts[0].id;
}

function newDraftTitle(prefix) {
    var timestamp = new Date().toLocaleString([], {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
    return prefix + " " + timestamp;
}

function saveStrudelDraft() {
    var source = strudelCodeInput.value;
    if (!source.trim()) {
        setStrudelStatus("Add Strudel code before saving a draft.");
        strudelCodeInput.focus();
        return;
    }
    var drafts = readStrudelDrafts();
    var selectedId = strudelDraftSelect.value;
    var existingDraft = drafts.find(function (draft) {
        return draft.id === selectedId;
    });
    var draft = existingDraft || {
        id: String(Date.now()) + "-" + Math.random().toString(16).slice(2),
        title: newDraftTitle("Sketch")
    };
    draft.source = source;
    draft.updatedAt = new Date().toISOString();
    if (!existingDraft) {
        drafts.unshift(draft);
    }
    if (writeStrudelDrafts(drafts)) {
        renderStrudelDrafts(draft.id);
        resetStrudelResult("Draft saved locally.");
    }
}

function loadStrudelDraft() {
    var selectedId = strudelDraftSelect.value;
    var draft = readStrudelDrafts().find(function (item) {
        return item.id === selectedId;
    });
    if (!draft) {
        setStrudelStatus("No local draft selected.");
        return;
    }
    strudelCodeInput.value = draft.source;
    resetStrudelResult("Draft loaded. Generate MIDI when ready.");
}

function duplicateStrudelDraft() {
    var selectedId = strudelDraftSelect.value;
    var sourceDraft = readStrudelDrafts().find(function (item) {
        return item.id === selectedId;
    });
    var source = sourceDraft ? sourceDraft.source : strudelCodeInput.value;
    if (!source.trim()) {
        setStrudelStatus("No draft content to duplicate.");
        return;
    }
    var copy = {
        id: String(Date.now()) + "-" + Math.random().toString(16).slice(2),
        title: newDraftTitle("Copy"),
        source: source,
        updatedAt: new Date().toISOString()
    };
    var drafts = readStrudelDrafts();
    drafts.unshift(copy);
    if (writeStrudelDrafts(drafts)) {
        renderStrudelDrafts(copy.id);
        strudelCodeInput.value = source;
        resetStrudelResult("Draft duplicated locally.");
    }
}

function tidyStrudelSource() {
    strudelCodeInput.value = strudelCodeInput.value
        .split("\n")
        .map(function (line) {
            return line.replace(/\s+$/g, "");
        })
        .join("\n")
        .trim() + "\n";
    resetStrudelResult("Sketch tidied. Generate MIDI when ready.");
}

function clearStrudelSource() {
    strudelCodeInput.value = "";
    resetStrudelResult("Sketch cleared");
}

function setAiSketchStatus(message) {
    aiSketchStatus.textContent = message;
}

function setAiSketchMeta(message) {
    aiSketchMeta.textContent = message || "";
    aiSketchMeta.hidden = !message;
}

function aiSketchJsonError(response, payload) {
    var message = payload && payload.error ? payload.error : response.statusText;
    throw new Error("HTTP " + response.status + ": " + (message || "AI sketch request failed."));
}

function aiSketchEndpoint(path) {
    return aiSketchApiUrl.replace(/\/suggest$/, "") + path;
}

function fetchAiSketchRequest(path, payload) {
    if (!aiSketchApiUrl) {
        return Promise.reject(new Error("AI sketch needs local Docker service."));
    }
    return fetch(aiSketchEndpoint(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then(function (response) {
        return response.json().catch(function () {
            return {};
        }).then(function (payload) {
            if (!response.ok) {
                aiSketchJsonError(response, payload);
            }
            return payload;
        });
    });
}

function fetchAiSketchSuggestion(payload) {
    return fetchAiSketchRequest("/suggest", payload);
}

function fetchAiMidiSketch(payload) {
    return fetchAiSketchRequest("/from-midi", payload);
}

function currentAiSourcePayload() {
    return {
        model: aiModelSelect.value,
        source: strudelCodeInput.value,
        style: aiStyleSelect.value,
        bars: strudelBarsSelect.value,
        bpm: strudelBpmInput.value
    };
}

function applyAiSketchSuggestion(payload) {
    strudelCodeInput.value = payload.source || "";
    resetStrudelResult("AI pattern ready. Review code, then Generate MIDI.");
    var warningText = Array.isArray(payload.warnings) && payload.warnings.length
        ? " Warnings: " + payload.warnings.join(" ")
        : "";
    setAiSketchMeta((payload.explanation || "Pattern generated.") + warningText);
    setAiSketchStatus("Generated with " + (payload.model || "model"));
}

function applyAiExplanation(payload) {
    var structureText = Array.isArray(payload.structure) && payload.structure.length
        ? " Structure: " + payload.structure.join(" ")
        : "";
    var warningText = Array.isArray(payload.warnings) && payload.warnings.length
        ? " Warnings: " + payload.warnings.join(" ")
        : "";
    setAiSketchMeta((payload.explanation || "Explanation ready.") + structureText + warningText);
    setAiSketchStatus("Explained with " + (payload.model || "model"));
}

function explainAiStrudelPattern() {
    if (!hasAiSketchService()) {
        setAiSketchStatus("Static preview: AI Sketch requires local Docker.");
        return;
    }
    if (!strudelCodeInput.value.trim()) {
        setAiSketchStatus("Add Strudel code first.");
        strudelCodeInput.focus();
        return;
    }
    setAiSketchStatus(aiModelSelect.value === "mimo-v2.5-pro"
        ? "Explaining code... MiMo may take 1-3 minutes."
        : "Explaining code...");
    setAiSketchMeta("");
    explainAiSketchButton.disabled = true;
    fetchAiSketchRequest("/explain", currentAiSourcePayload()).then(applyAiExplanation).catch(function (error) {
        console.error(error);
        setAiSketchStatus(aiSketchErrorMessage(error));
    }).finally(function () {
        explainAiSketchButton.disabled = !hasAiSketchService();
    });
}

function applyAiEdit(payload) {
    strudelCodeInput.value = payload.source || "";
    resetStrudelResult("AI edit applied. Review code, then Generate MIDI.");
    var warningText = Array.isArray(payload.warnings) && payload.warnings.length
        ? " Warnings: " + payload.warnings.join(" ")
        : "";
    setAiSketchMeta((payload.explanation || "Edit applied.") + warningText);
    setAiSketchStatus("Edited with " + (payload.model || "model"));
}

function editAiStrudelPattern() {
    if (!hasAiSketchService()) {
        setAiSketchStatus("Static preview: AI Sketch requires local Docker.");
        return;
    }
    var instruction = aiEditPromptInput.value.trim();
    if (!strudelCodeInput.value.trim()) {
        setAiSketchStatus("Add Strudel code first.");
        strudelCodeInput.focus();
        return;
    }
    if (!instruction) {
        setAiSketchStatus("Describe the edit first.");
        aiEditPromptInput.focus();
        return;
    }
    setAiSketchStatus(aiModelSelect.value === "mimo-v2.5-pro"
        ? "Applying edit... MiMo may take 1-3 minutes."
        : "Applying edit...");
    setAiSketchMeta("");
    applyAiEditButton.disabled = true;
    var payload = currentAiSourcePayload();
    payload.instruction = instruction;
    fetchAiSketchRequest("/edit", payload).then(applyAiEdit).catch(function (error) {
        console.error(error);
        setAiSketchStatus(aiSketchErrorMessage(error));
    }).finally(function () {
        applyAiEditButton.disabled = !hasAiSketchService();
    });
}

function generateAiStrudelPattern() {
    if (!hasAiSketchService()) {
        setAiSketchStatus("Static preview: AI Sketch requires local Docker.");
        return;
    }
    var prompt = aiPromptInput.value.trim();
    if (!prompt) {
        setAiSketchStatus("Describe the sketch first.");
        aiPromptInput.focus();
        return;
    }
    setAiSketchStatus(aiModelSelect.value === "mimo-v2.5-pro"
        ? "Generating pattern... MiMo may take 1-3 minutes."
        : "Generating pattern...");
    setAiSketchMeta("");
    generateAiSketchButton.disabled = true;
    fetchAiSketchSuggestion({
        model: aiModelSelect.value,
        style: aiStyleSelect.value,
        prompt: prompt,
        bars: strudelBarsSelect.value,
        bpm: strudelBpmInput.value
    }).then(applyAiSketchSuggestion).catch(function (error) {
        console.error(error);
        setAiSketchStatus(aiSketchErrorMessage(error));
    }).finally(function () {
        generateAiSketchButton.disabled = !hasAiSketchService();
    });
}

function generateStrudelFromCurrentMidi() {
    if (!hasAiSketchService()) {
        setAiSketchStatus("Static preview: MIDI-to-Strudel requires local Docker AI service.");
        return;
    }
    if (!activeMidiBytes) {
        setAiSketchStatus("Load a source MIDI before creating a sketch.");
        return;
    }
    var summary;
    try {
        summary = midiSketchSummary(activeMidiBytes, {
            bars: strudelBarsSelect.value,
            bpm: Number(strudelBpmInput.value) || 120
        });
    } catch (error) {
        console.warn(error);
        setAiSketchStatus(error.message || "Unable to summarize current MIDI.");
        return;
    }
    setAiSketchStatus(aiModelSelect.value === "mimo-v2.5-pro"
        ? "Generating sketch from MIDI... MiMo may take 1-3 minutes."
        : "Generating sketch from MIDI...");
    setAiSketchMeta(summary.warnings.concat([
        "Uses current source MIDI only, first " + summary.bars + " bars, representative melody/bass, and no exact channel/control/program reconstruction."
    ]).join(" "));
    midiToStrudelButton.disabled = true;
    fetchAiMidiSketch({
        model: aiModelSelect.value,
        style: aiStyleSelect.value,
        bars: strudelBarsSelect.value,
        bpm: summary.bpm,
        midiSummary: summary
    }).then(function (payload) {
        applyAiSketchSuggestion(payload);
        strudelBpmInput.value = String(summary.bpm);
    }).catch(function (error) {
        console.error(error);
        setAiSketchStatus(aiSketchErrorMessage(error));
    }).finally(function () {
        midiToStrudelButton.disabled = !hasAiSketchService();
    });
}

function bytesFromBase64(text) {
    var binary = atob(text);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function strudelJsonError(response, payload) {
    var message = payload && payload.error ? payload.error : response.statusText;
    throw new Error("HTTP " + response.status + ": " + (message || "Strudel sketch request failed."));
}

function fetchStrudelSketch(payload) {
    if (!strudelSketchApiUrl) {
        return Promise.reject(new Error("Strudel sketch needs local Docker service."));
    }
    return fetch(strudelSketchApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then(function (response) {
        return response.json().catch(function () {
            return {};
        }).then(function (payload) {
            if (!response.ok) {
                strudelJsonError(response, payload);
            }
            return payload;
        });
    });
}

function showStrudelResult(payload) {
    var bytes = bytesFromBase64(payload.midiBase64 || "");
    strudelMidiBlob = new Blob([bytes], { type: "audio/midi" });
    strudelMidiUrl = URL.createObjectURL(strudelMidiBlob);
    strudelDownloadName = safeMidiDownloadName(payload.fileName || "strudel-sketch.mid");
    strudelPlaybackTitle = "Strudel Sketch";

    strudelResult.hidden = false;
    strudelResultTitle.textContent = strudelDownloadName + " (" + formatBytes(strudelMidiBlob.size) + ")";
    downloadStrudelLink.href = strudelMidiUrl;
    downloadStrudelLink.download = strudelDownloadName;

    try {
        strudelMetrics.textContent = compareMetricsText(strudelMidiBlob, parseMidiAnalysis(bytes));
    } catch (error) {
        console.warn(error);
        strudelMetrics.textContent = "Analysis unavailable · " + formatBytes(strudelMidiBlob.size);
    }
    try {
        renderNoteActivity(bytes, { bars: payload.bars });
    } catch (error) {
        console.warn(error);
        resetNoteActivity("Analysis unavailable");
    }
}

function generateStrudelSketch() {
    if (!hasStrudelSketchService()) {
        setStrudelStatus("Static preview: Strudel MIDI generation requires local Docker.");
        return;
    }
    resetStrudelResult();
    setStrudelStatus("Generating MIDI sketch...");
    generateStrudelButton.disabled = true;
    fetchStrudelSketch({
        source: strudelCodeInput.value,
        bars: strudelBarsSelect.value,
        bpm: strudelBpmInput.value
    }).then(function (payload) {
        showStrudelResult(payload);
        setStrudelStatus("Sketch generated. Preview or load as source.");
    }).catch(function (error) {
        console.error(error);
        setStrudelStatus(strudelErrorMessage(error));
    }).finally(function () {
        generateStrudelButton.disabled = !hasStrudelSketchService();
    });
}

function previewStrudelSketch() {
    if (!strudelMidiUrl) return;
    if (!activePlaybackIsPreview) {
        previewRestoreState = {
            url: activeMidiUrl,
            title: activeSongTitle.textContent,
            playbackProgram: activePlaybackProgram,
            playbackPrograms: activePlaybackPrograms
        };
    }
    loadMidiPreview(strudelMidiUrl, true, { playbackProgram: arrangementPresets.piano.program });
    activeSongTitle.textContent = strudelPlaybackTitle + " Preview";
    setStrudelStatus("Previewing sketch MIDI");
}

function loadStrudelSketchAsSource() {
    if (!strudelMidiBlob) return;
    loadConvertedMidi(strudelMidiBlob, strudelDownloadName, strudelPlaybackTitle, { start: false });
    activeSongTitle.textContent = strudelPlaybackTitle;
    setStrudelStatus("Loaded sketch as source");
}

function setMidiStatus(message, statusClass) {
    midiStatus.className = "status-pill" + (statusClass ? " " + statusClass : "");
    midiStatusText.textContent = message;
}

function updateUploadButton() {
    convertButton.disabled = !midiReady || !uploadFileInput.files.length || !hasTranscriptionService();
    convertButton.textContent = currentConversionMode() === "compare" ? "Compare Engines" : "Convert to MIDI";
    if (hasTranscriptionService()) {
        convertButton.removeAttribute("title");
    } else {
        convertButton.title = "Audio conversion requires local Docker backend.";
    }
}

function songNameFromFile(file) {
    return file.name.replace(/\.[^/.]+$/, "") || "upload";
}

function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    var kilobytes = bytes / 1024;
    if (kilobytes < 1024) return kilobytes.toFixed(1) + " KB";
    return (kilobytes / 1024).toFixed(1) + " MB";
}

function formatDuration(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "--";
    var totalSeconds = Math.round(seconds);
    var minutes = Math.floor(totalSeconds / 60);
    var remainingSeconds = totalSeconds % 60;
    return minutes + ":" + String(remainingSeconds).padStart(2, "0");
}

function beatDurationSeconds() {
    return timelineBpm > 0 ? 60 / timelineBpm : 0.5;
}

function barBeatFromSeconds(seconds) {
    var beatSeconds = beatDurationSeconds();
    var totalBeats = Math.max(0, Math.floor((seconds || 0) / beatSeconds));
    return {
        bar: Math.floor(totalBeats / timelineBeatsPerBar) + 1,
        beat: totalBeats % timelineBeatsPerBar + 1
    };
}

function totalTimelineBars() {
    var beatSeconds = beatDurationSeconds();
    if (!timelineDurationSeconds || !beatSeconds) return 0;
    return Math.max(1, Math.ceil(timelineDurationSeconds / beatSeconds / timelineBeatsPerBar));
}

function formatBarBeat(seconds) {
    if (!timelineDurationSeconds) return "Bar -- Beat --";
    var position = barBeatFromSeconds(seconds);
    return "Bar " + position.bar + " Beat " + position.beat;
}

function setLoopRangeButtonsEnabled(enabled) {
    loopStartButton.disabled = !enabled;
    loopEndButton.disabled = !enabled;
    loopClearButton.disabled = !enabled || !hasLoopRange();
}

function renderTimelineGrid() {
    timelineGrid.innerHTML = "";
    var bars = totalTimelineBars();
    if (!bars) return;

    var interval = Math.max(1, Math.ceil(bars / 8));
    for (var bar = 1; bar <= bars; bar += interval) {
        var marker = document.createElement("span");
        marker.textContent = String(bar);
        marker.style.left = bars > 1 ? ((bar - 1) / (bars - 1) * 100).toFixed(2) + "%" : "0";
        timelineGrid.appendChild(marker);
    }
    if (bars > 1 && (bars - 1) % interval !== 0) {
        var endMarker = document.createElement("span");
        endMarker.textContent = String(bars);
        endMarker.style.left = "100%";
        timelineGrid.appendChild(endMarker);
    }
}

function updateBarBeatReadouts(seconds) {
    var bars = totalTimelineBars();
    barBeatReadout.textContent = formatBarBeat(seconds || 0);
    totalBarsReadout.textContent = bars ? bars + " bars" : "-- bars";
}

function resetTimeline() {
    timelineDurationSeconds = 0;
    timelineBpm = 120;
    timelineBeatsPerBar = 4;
    loopRangeStartSeconds = null;
    loopRangeEndSeconds = null;
    timelineSlider.value = "0";
    timelineSlider.disabled = true;
    currentTimeReadout.textContent = "0:00";
    durationTimeReadout.textContent = "--";
    timelineGrid.innerHTML = "";
    updateBarBeatReadouts(0);
    updateLoopRangeStatus();
    setLoopRangeButtonsEnabled(false);
}

function setTimelineDuration(seconds, options) {
    options = options || {};
    timelineDurationSeconds = isFinite(seconds) && seconds > 0 ? seconds : 0;
    timelineBpm = options.bpm || timelineBpm || 120;
    timelineBeatsPerBar = options.beatsPerBar || 4;
    timelineSlider.disabled = timelineDurationSeconds <= 0;
    durationTimeReadout.textContent = formatDuration(timelineDurationSeconds);
    renderTimelineGrid();
    updateBarBeatReadouts(0);
    updateLoopRangeStatus();
    setLoopRangeButtonsEnabled(timelineDurationSeconds > 0);
}

function updateTimelinePosition(seconds) {
    var boundedSeconds = Math.max(0, Math.min(seconds || 0, timelineDurationSeconds || seconds || 0));
    currentTimeReadout.textContent = formatDuration(boundedSeconds);
    updateBarBeatReadouts(boundedSeconds);
    if (!isSeekingTimeline && timelineDurationSeconds > 0) {
        timelineSlider.value = String(Math.round(boundedSeconds / timelineDurationSeconds * 1000));
    }
}

function currentTimelineSeekSeconds() {
    if (!timelineDurationSeconds) return 0;
    return parseInt(timelineSlider.value, 10) / 1000 * timelineDurationSeconds;
}

function currentPlaybackSeconds() {
    if (!MIDI.Player.playing || playbackClockStartMs <= 0) {
        return currentTimelineSeekSeconds();
    }
    return playbackClockBaseSeconds + (Date.now() - playbackClockStartMs) / 1000;
}

function syncPlayerSeekTime(seconds) {
    var milliseconds = Math.max(0, seconds) * 1000;
    MIDI.Player.currentTime = milliseconds;
    MIDI.Player.restart = milliseconds;
}

function hasLoopRange() {
    return loopRangeStartSeconds !== null
        && loopRangeEndSeconds !== null
        && loopRangeEndSeconds > loopRangeStartSeconds + 0.05;
}

function activeLoopStartSeconds() {
    return hasLoopRange() ? loopRangeStartSeconds : 0;
}

function activeLoopEndSeconds(fallbackEndSeconds) {
    return hasLoopRange() ? loopRangeEndSeconds : fallbackEndSeconds;
}

function updateLoopRangeStatus(message) {
    if (message) {
        loopRangeStatus.textContent = message;
    } else if (hasLoopRange()) {
        loopRangeStatus.textContent = "Loop range: "
            + formatDuration(loopRangeStartSeconds) + " - " + formatDuration(loopRangeEndSeconds)
            + " · " + formatBarBeat(loopRangeStartSeconds);
    } else {
        loopRangeStatus.textContent = "Loop range: full track";
    }
    if (loopClearButton) {
        loopClearButton.disabled = !timelineDurationSeconds || !hasLoopRange();
    }
}

function setLoopRangeStart() {
    if (!timelineDurationSeconds) return;
    loopRangeStartSeconds = currentTimelineSeekSeconds();
    if (loopRangeEndSeconds !== null && loopRangeEndSeconds <= loopRangeStartSeconds + 0.05) {
        loopRangeEndSeconds = null;
    }
    updateLoopRangeStatus();
}

function setLoopRangeEnd() {
    if (!timelineDurationSeconds) return;
    var endSeconds = currentTimelineSeekSeconds();
    if (loopRangeStartSeconds === null) {
        loopRangeStartSeconds = 0;
    }
    if (endSeconds <= loopRangeStartSeconds + 0.05) {
        updateLoopRangeStatus("Loop range needs an end after the start");
        return;
    }
    loopRangeEndSeconds = endSeconds;
    updateLoopRangeStatus();
}

function clearLoopRange() {
    loopRangeStartSeconds = null;
    loopRangeEndSeconds = null;
    updateLoopRangeStatus();
}

function formatCount(count, singular, plural) {
    var label = count === 1 ? singular : plural;
    return count + " " + label;
}

function midiNoteName(noteNumber) {
    return noteNames[noteNumber % 12] + (Math.floor(noteNumber / 12) - 1);
}

function resetMidiAnalysis(message, statusLabel) {
    analysisStatus.textContent = message || "Load a MIDI file to inspect score details.";
    analysisDisclosureStatus.textContent = statusLabel || "Empty";
    analysisDuration.textContent = "--";
    analysisTempo.textContent = "--";
    analysisTracks.textContent = "--";
    analysisChannels.textContent = "--";
    analysisPrograms.textContent = "--";
    analysisNotes.textContent = "--";
    analysisPitchRange.textContent = "--";
    analysisPolyphony.textContent = "--";
    cleanMidiButton.disabled = true;
    createPresetMidiButton.disabled = true;
    resetTimeline();
}

function updateMidiAnalysis(summary) {
    analysisStatus.textContent = "Analysis ready";
    analysisDisclosureStatus.textContent = summary.noteCount ? "Ready" : "Empty";
    analysisDuration.textContent = formatDuration(summary.durationSeconds);
    analysisTempo.textContent = summary.tempoLabel;
    analysisTracks.textContent = formatCount(summary.trackCount, "track", "tracks");
    analysisChannels.textContent = formatCount(summary.channelCount, "channel", "channels");
    analysisPrograms.textContent = summary.programLabel;
    analysisNotes.textContent = formatCount(summary.noteCount, "note", "notes");
    analysisPitchRange.textContent = summary.pitchRangeLabel;
    analysisPolyphony.textContent = summary.maxPolyphony + " max";
    cleanMidiButton.disabled = !activeMidiBytes || !summary.noteCount;
    createPresetMidiButton.disabled = !activeMidiBytes || !summary.noteCount;
    setTimelineDuration(summary.durationSeconds, {
        bpm: summary.primaryBpm,
        beatsPerBar: summary.beatsPerBar
    });
}

function resetCleanedMidi(message) {
    if (cleanedMidiUrl) {
        revokeObjectUrl(cleanedMidiUrl);
    }
    if (cleanedPlaybackUrl && cleanedPlaybackUrl !== activeMidiUrl && cleanedPlaybackUrl.indexOf("blob:") === 0) {
        revokeObjectUrl(cleanedPlaybackUrl);
        cleanedPlaybackUrl = null;
    }
    cleanedMidiUrl = null;
    cleanedMidiBytes = null;
    downloadCleanedMidiLink.hidden = true;
    downloadCleanedMidiLink.removeAttribute("href");
    downloadCleanedMidiLink.removeAttribute("download");
    loadCleanedMidiButton.hidden = true;
    cleanupStatus.textContent = message || "Cleaned MIDI is a separate variant. Source MIDI stays unchanged.";
}

function resetPresetMidi(message) {
    if (presetMidiUrl) {
        revokeObjectUrl(presetMidiUrl);
    }
    if (presetPlaybackUrl && presetPlaybackUrl !== activeMidiUrl && presetPlaybackUrl.indexOf("blob:") === 0) {
        revokeObjectUrl(presetPlaybackUrl);
        presetPlaybackUrl = null;
    }
    presetMidiUrl = null;
    presetMidiBytes = null;
    presetCreatedLabel = "";
    presetPlaybackOptions = null;
    downloadPresetMidiLink.hidden = true;
    downloadPresetMidiLink.removeAttribute("href");
    downloadPresetMidiLink.removeAttribute("download");
    loadPresetMidiButton.hidden = true;
    presetStatus.textContent = message || "Presets write General MIDI programs and use bundled browser soundfonts.";
}

function resetSourceMidiDownload() {
    if (sourceMidiDownloadUrl) {
        revokeObjectUrl(sourceMidiDownloadUrl);
    }
    sourceMidiDownloadUrl = null;
    sourceMidiTitle = "";
    downloadSourceMidiLink.hidden = true;
    downloadSourceMidiLink.removeAttribute("href");
    downloadSourceMidiLink.removeAttribute("download");
}

function safeMidiDownloadName(name) {
    name = name || "score.mid";
    name = name.replace(/[\\/:*?"<>|\s]+/g, "_");
    if (!/\.midi?$/i.test(name)) {
        name += ".mid";
    }
    return name;
}

function midiBytesToDataUrl(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return "data:audio/midi;base64," + btoa(binary);
}

function setSourceMidiDownload(bytes, downloadName, title) {
    resetSourceMidiDownload();
    sourceMidiTitle = title || activeSongTitle.textContent || "score";
    sourceMidiDownloadUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "audio/midi" }));
    downloadSourceMidiLink.href = sourceMidiDownloadUrl;
    downloadSourceMidiLink.download = safeMidiDownloadName(downloadName || sourceMidiTitle);
    downloadSourceMidiLink.hidden = false;
}

function cleanedDownloadName() {
    var name = activeSongTitle.textContent || "score";
    name = name.replace(/\s+\(Cleaned\)$/, "");
    name = name.replace(/\.[^/.]+$/, "");
    name = name.replace(/-cleaned$/i, "");
    name = name.replace(/[\\/:*?"<>|\s]+/g, "_");
    return (name || "score") + "-cleaned.mid";
}

function baseMidiFileName(suffix) {
    var name = activeSongTitle.textContent || sourceMidiTitle || "score";
    name = name.replace(/\s+\((Cleaned|Preset: [^)]+)\)$/, "");
    name = name.replace(/\.[^/.]+$/, "");
    name = name.replace(/[\\/:*?"<>|\s]+/g, "_");
    return (name || "score") + suffix + ".mid";
}

function presetDownloadName(preset) {
    return baseMidiFileName("-" + preset.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
}

function selectedMelodyPreset() {
    return arrangementPresets[melodySoundSelect.value] || arrangementPresets.strings;
}

function selectedBassMelodySplitPoint() {
    var fallback = bassMelodySplitPoints[arrangementPresets["bass-melody"].splitPitch];
    return bassMelodySplitPoints[bassSplitPointSelect.value] || fallback;
}

function selectedPresetLabel(preset) {
    if (!preset.split) {
        return preset.label;
    }
    return preset.label + " - " + selectedMelodyPreset().label;
}

function updatePresetFields() {
    var preset = arrangementPresets[arrangementPresetSelect.value] || arrangementPresets.piano;
    melodySoundField.hidden = !preset.split;
    bassSplitField.hidden = !preset.split;
}

function setStageTipsOpen(isOpen) {
    stageTipsPopover.hidden = !isOpen;
    stageTipsButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function toggleStageTips() {
    setStageTipsOpen(stageTipsPopover.hidden);
}

function analyzeMidiUrl(url, options) {
    options = options || {};
    var requestId = ++analysisRequestId;
    activeMidiBytes = null;
    if (options.storeAsSource) {
        resetSourceMidiDownload();
    }
    if (!options.preserveCleaned) {
        resetCleanedMidi();
    }
    if (!options.preservePreset) {
        resetPresetMidi();
    }
    resetMidiAnalysis("Analyzing MIDI...");

    fetch(url).then(function (response) {
        if (!response.ok) {
            throw new Error("Unable to read MIDI file");
        }
        return response.arrayBuffer();
    }).then(function (arrayBuffer) {
        if (requestId !== analysisRequestId) return;
        activeMidiBytes = new Uint8Array(arrayBuffer);
        if (options.storeAsSource) {
            setSourceMidiDownload(activeMidiBytes, options.sourceDownloadName, options.sourceTitle);
        }
        updateMidiAnalysis(parseMidiAnalysis(activeMidiBytes));
    }).catch(function (error) {
        if (requestId !== analysisRequestId) return;
        activeMidiBytes = null;
        if (options.storeAsSource) {
            resetSourceMidiDownload();
        }
        console.warn(error);
        resetMidiAnalysis("MIDI analysis unavailable. Playback may still work.", "Unavailable");
    });
}

function readUint16(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes, offset) {
    return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function appendUint32(bytes, value) {
    bytes.push((value >>> 24) & 0xff);
    bytes.push((value >>> 16) & 0xff);
    bytes.push((value >>> 8) & 0xff);
    bytes.push(value & 0xff);
}

function appendVarLength(bytes, value) {
    var buffer = value & 0x7f;
    while ((value = value >> 7)) {
        buffer = buffer << 8;
        buffer |= ((value & 0x7f) | 0x80);
    }

    while (true) {
        bytes.push(buffer & 0xff);
        if (buffer & 0x80) {
            buffer = buffer >> 8;
        } else {
            break;
        }
    }
}

function bytesToText(bytes, offset, length) {
    var text = "";
    for (var i = 0; i < length; i += 1) {
        text += String.fromCharCode(bytes[offset + i]);
    }
    return text;
}

function pushBytes(target, bytes, start, end) {
    for (var i = start; i < end; i += 1) {
        target.push(bytes[i]);
    }
}

function readVarLength(bytes, state, limit) {
    var value = 0;
    var byteValue;
    do {
        if (state.offset >= limit) {
            throw new Error("Unexpected end of MIDI variable length value");
        }
        byteValue = bytes[state.offset];
        state.offset += 1;
        value = (value << 7) + (byteValue & 0x7f);
    } while (byteValue & 0x80);
    return value;
}

function midiEventDataLength(status) {
    var eventType = status & 0xf0;
    if (eventType === 0xc0 || eventType === 0xd0) return 1;
    if (eventType >= 0x80 && eventType <= 0xe0) return 2;
    if (status === 0xf1 || status === 0xf3) return 1;
    if (status === 0xf2) return 2;
    return 0;
}

function cleanupOptions() {
    return {
        shortNoteDivisor: cleanupShortNoteSelect.value === "off" ? 0 : Number(cleanupShortNoteSelect.value) || 32,
        removeDuplicates: cleanupDuplicatesInput.checked,
        velocityMode: cleanupVelocitySelect.value || "moderate"
    };
}

function cleanupVelocityRange(mode) {
    if (mode === "strong") return { min: 64, max: 100 };
    if (mode === "moderate") return { min: 56, max: 108 };
    return null;
}

function normalizeVelocity(velocity, mode) {
    if (velocity <= 0) return velocity;
    var range = cleanupVelocityRange(mode);
    if (!range) return velocity;
    return Math.max(range.min, Math.min(range.max, velocity));
}

function addPolyphonyEvent(polyphonyEvents, activeNotes, tick, channel, noteNumber, delta) {
    var key = channel + ":" + noteNumber;
    if (delta > 0) {
        activeNotes[key] = (activeNotes[key] || 0) + 1;
        polyphonyEvents.push({ tick: tick, delta: 1 });
        return true;
    }
    if (!activeNotes[key]) return false;
    activeNotes[key] -= 1;
    polyphonyEvents.push({ tick: tick, delta: -1 });
    return false;
}

function parseMidiTrack(bytes, start, end, summary) {
    var state = { offset: start };
    var runningStatus = null;
    var tick = 0;
    var activeNotes = {};

    while (state.offset < end) {
        tick += readVarLength(bytes, state, end);
        if (state.offset >= end) break;

        var status = bytes[state.offset];
        var dataOffset;
        if (status < 0x80) {
            if (runningStatus === null) {
                throw new Error("MIDI running status found before status byte");
            }
            status = runningStatus;
            dataOffset = state.offset;
        } else {
            state.offset += 1;
            dataOffset = state.offset;
            if (status < 0xf0) {
                runningStatus = status;
            }
        }

        if (status === 0xff) {
            var metaType = bytes[state.offset];
            state.offset += 1;
            var metaLength = readVarLength(bytes, state, end);
            if (metaType === 0x51 && metaLength === 3) {
                var microsecondsPerQuarter = (bytes[state.offset] << 16) + (bytes[state.offset + 1] << 8) + bytes[state.offset + 2];
                summary.tempoEvents.push({
                    tick: tick,
                    bpm: Math.round(60000000 / microsecondsPerQuarter),
                    microsecondsPerQuarter: microsecondsPerQuarter
                });
            } else if (metaType === 0x58 && metaLength >= 2 && !summary.timeSignature) {
                summary.timeSignature = {
                    numerator: bytes[state.offset],
                    denominator: Math.pow(2, bytes[state.offset + 1])
                };
            }
            state.offset += metaLength;
            continue;
        }

        if (status === 0xf0 || status === 0xf7) {
            var sysexLength = readVarLength(bytes, state, end);
            state.offset += sysexLength;
            continue;
        }

        var dataLength = midiEventDataLength(status);
        state.offset = dataOffset + dataLength;

        var eventType = status & 0xf0;
        var channel = (status & 0x0f) + 1;
        var firstDataByte = bytes[dataOffset];
        var secondDataByte = dataLength > 1 ? bytes[dataOffset + 1] : 0;

        if (eventType >= 0x80 && eventType <= 0xe0) {
            summary.channels[channel] = true;
        }

        if (eventType === 0xc0) {
            summary.programs[firstDataByte] = true;
            summary.channelPrograms[channel + ":" + firstDataByte] = true;
        } else if (eventType === 0x90 && secondDataByte > 0) {
            summary.noteCount += 1;
            summary.minPitch = Math.min(summary.minPitch, firstDataByte);
            summary.maxPitch = Math.max(summary.maxPitch, firstDataByte);
            addPolyphonyEvent(summary.polyphonyEvents, activeNotes, tick, channel, firstDataByte, 1);
        } else if (eventType === 0x80 || (eventType === 0x90 && secondDataByte === 0)) {
            addPolyphonyEvent(summary.polyphonyEvents, activeNotes, tick, channel, firstDataByte, -1);
        }

        summary.maxTick = Math.max(summary.maxTick, tick);
    }
}

function durationSecondsFromTempoEvents(maxTick, division, tempoEvents) {
    if (division <= 0 || (division & 0x8000)) return 0;
    var sortedTempos = tempoEvents.slice().sort(function (a, b) {
        return a.tick - b.tick;
    });
    var microsecondsPerQuarter = 500000;
    var lastTick = 0;
    var seconds = 0;

    sortedTempos.forEach(function (tempo) {
        var boundedTick = Math.min(tempo.tick, maxTick);
        if (boundedTick > lastTick) {
            seconds += (boundedTick - lastTick) * microsecondsPerQuarter / division / 1000000;
            lastTick = boundedTick;
        }
        microsecondsPerQuarter = tempo.microsecondsPerQuarter;
    });

    if (maxTick > lastTick) {
        seconds += (maxTick - lastTick) * microsecondsPerQuarter / division / 1000000;
    }

    return seconds;
}

function maxPolyphony(polyphonyEvents) {
    var active = 0;
    var maxActive = 0;
    polyphonyEvents.sort(function (a, b) {
        if (a.tick !== b.tick) return a.tick - b.tick;
        return a.delta - b.delta;
    }).forEach(function (event) {
        active += event.delta;
        maxActive = Math.max(maxActive, active);
    });
    return maxActive;
}

function popActiveNote(activeNotes, key) {
    if (!activeNotes[key] || !activeNotes[key].length) return null;
    return activeNotes[key].pop();
}

function pushActiveNote(activeNotes, key, note) {
    if (!activeNotes[key]) {
        activeNotes[key] = [];
    }
    activeNotes[key].push(note);
}

function pushSplitChannel(activeNotes, key, channel) {
    if (!activeNotes[key]) {
        activeNotes[key] = [];
    }
    activeNotes[key].push(channel);
}

function popSplitChannel(activeNotes, key, fallbackChannel) {
    if (!activeNotes[key] || !activeNotes[key].length) {
        return fallbackChannel;
    }
    return activeNotes[key].pop();
}

function cleanMidiTrack(sourceBytes, cleanedBytes, start, end, division, options, stats) {
    var state = { offset: start };
    var runningStatus = null;
    var tick = 0;
    var activeNotes = {};
    var ticksPerQuarter = division > 0 && !(division & 0x8000) ? division : 480;
    var shortNoteThreshold = options.shortNoteDivisor > 0
        ? Math.max(1, Math.round(ticksPerQuarter / options.shortNoteDivisor))
        : 0;

    while (state.offset < end) {
        tick += readVarLength(sourceBytes, state, end);
        if (state.offset >= end) break;

        var status = sourceBytes[state.offset];
        var dataOffset;
        if (status < 0x80) {
            if (runningStatus === null) {
                throw new Error("MIDI running status found before status byte");
            }
            status = runningStatus;
            dataOffset = state.offset;
        } else {
            state.offset += 1;
            dataOffset = state.offset;
            if (status < 0xf0) {
                runningStatus = status;
            }
        }

        if (status === 0xff) {
            state.offset += 1;
            var metaLength = readVarLength(sourceBytes, state, end);
            state.offset += metaLength;
            continue;
        }

        if (status === 0xf0 || status === 0xf7) {
            var sysexLength = readVarLength(sourceBytes, state, end);
            state.offset += sysexLength;
            continue;
        }

        var dataLength = midiEventDataLength(status);
        state.offset = dataOffset + dataLength;

        var eventType = status & 0xf0;
        var channel = (status & 0x0f) + 1;
        var noteNumber = sourceBytes[dataOffset];
        var velocityOffset = dataOffset + 1;
        var velocity = dataLength > 1 ? sourceBytes[velocityOffset] : 0;
        var key = channel + ":" + noteNumber;

        if (eventType === 0x90 && velocity > 0) {
            stats.notesSeen += 1;
            var normalizedVelocity = normalizeVelocity(velocity, options.velocityMode);
            if (cleanedBytes[velocityOffset] !== normalizedVelocity) {
                stats.velocitiesNormalized += 1;
                cleanedBytes[velocityOffset] = normalizedVelocity;
            }
            var isDuplicateOverlap = options.removeDuplicates && activeNotes[key] && activeNotes[key].length > 0;
            if (isDuplicateOverlap) {
                cleanedBytes[velocityOffset] = 0;
                stats.duplicateOverlapsRemoved += 1;
            }
            pushActiveNote(activeNotes, key, {
                startTick: tick,
                velocityOffset: velocityOffset,
                muted: isDuplicateOverlap
            });
        } else if (eventType === 0x80 || (eventType === 0x90 && velocity === 0)) {
            var noteOn = popActiveNote(activeNotes, key);
            if (!noteOn || noteOn.muted) continue;
            if (shortNoteThreshold > 0 && tick - noteOn.startTick > 0 && tick - noteOn.startTick < shortNoteThreshold) {
                cleanedBytes[noteOn.velocityOffset] = 0;
                stats.shortNotesRemoved += 1;
            }
        }
    }
}

function cleanMidiBytes(sourceBytes, options) {
    if (bytesToText(sourceBytes, 0, 4) !== "MThd") {
        throw new Error("Invalid MIDI header");
    }

    var cleanedBytes = new Uint8Array(sourceBytes);
    var headerLength = readUint32(sourceBytes, 4);
    var division = readUint16(sourceBytes, 12);
    var offset = 8 + headerLength;
    var stats = {
        notesSeen: 0,
        duplicateOverlapsRemoved: 0,
        shortNotesRemoved: 0,
        velocitiesNormalized: 0
    };

    while (offset + 8 <= sourceBytes.length) {
        var chunkType = bytesToText(sourceBytes, offset, 4);
        var chunkLength = readUint32(sourceBytes, offset + 4);
        var chunkStart = offset + 8;
        var chunkEnd = chunkStart + chunkLength;
        if (chunkEnd > sourceBytes.length) {
            throw new Error("MIDI track chunk exceeds file length");
        }
        if (chunkType === "MTrk") {
            cleanMidiTrack(sourceBytes, cleanedBytes, chunkStart, chunkEnd, division, options, stats);
        }
        offset = chunkEnd;
    }

    return {
        bytes: cleanedBytes,
        stats: stats
    };
}

function collectPresetTrackInfo(bytes, start, end) {
    var state = { offset: start };
    var runningStatus = null;
    var info = {
        noteChannels: {},
        programChannels: {}
    };

    while (state.offset < end) {
        readVarLength(bytes, state, end);
        if (state.offset >= end) break;

        var status = bytes[state.offset];
        var dataOffset;
        if (status < 0x80) {
            if (runningStatus === null) {
                throw new Error("MIDI running status found before status byte");
            }
            status = runningStatus;
            dataOffset = state.offset;
        } else {
            state.offset += 1;
            dataOffset = state.offset;
            if (status < 0xf0) {
                runningStatus = status;
            }
        }

        if (status === 0xff) {
            state.offset += 1;
            var metaLength = readVarLength(bytes, state, end);
            state.offset += metaLength;
            continue;
        }

        if (status === 0xf0 || status === 0xf7) {
            var sysexLength = readVarLength(bytes, state, end);
            state.offset += sysexLength;
            continue;
        }

        var dataLength = midiEventDataLength(status);
        state.offset = dataOffset + dataLength;

        var eventType = status & 0xf0;
        var channel = (status & 0x0f) + 1;
        if (eventType === 0xc0) {
            info.programChannels[channel] = true;
        } else if (eventType === 0x90 && bytes[dataOffset + 1] > 0) {
            info.noteChannels[channel] = true;
        }
    }

    return info;
}

function presetTrackBytes(sourceBytes, start, end, presetProgram, stats) {
    var info = collectPresetTrackInfo(sourceBytes, start, end);
    var trackBytes = new Uint8Array(sourceBytes.slice(start, end));
    var state = { offset: 0 };
    var runningStatus = null;
    var insertedBytes = [];
    var noteChannels = Object.keys(info.noteChannels).map(Number).sort(function (a, b) {
        return a - b;
    });

    noteChannels.forEach(function (channel) {
        if (channel === 10 || info.programChannels[channel]) return;
        insertedBytes.push(0x00, 0xc0 + channel - 1, presetProgram);
        stats.programChangesInserted += 1;
    });

    while (state.offset < trackBytes.length) {
        readVarLength(trackBytes, state, trackBytes.length);
        if (state.offset >= trackBytes.length) break;

        var status = trackBytes[state.offset];
        var dataOffset;
        if (status < 0x80) {
            if (runningStatus === null) {
                throw new Error("MIDI running status found before status byte");
            }
            status = runningStatus;
            dataOffset = state.offset;
        } else {
            state.offset += 1;
            dataOffset = state.offset;
            if (status < 0xf0) {
                runningStatus = status;
            }
        }

        if (status === 0xff) {
            state.offset += 1;
            var metaLength = readVarLength(trackBytes, state, trackBytes.length);
            state.offset += metaLength;
            continue;
        }

        if (status === 0xf0 || status === 0xf7) {
            var sysexLength = readVarLength(trackBytes, state, trackBytes.length);
            state.offset += sysexLength;
            continue;
        }

        var dataLength = midiEventDataLength(status);
        state.offset = dataOffset + dataLength;

        if ((status & 0xf0) === 0xc0 && (status & 0x0f) !== 9 && trackBytes[dataOffset] !== presetProgram) {
            trackBytes[dataOffset] = presetProgram;
            stats.programChangesRewritten += 1;
        }
    }

    var output = insertedBytes.slice();
    pushBytes(output, trackBytes, 0, trackBytes.length);
    return output;
}

function createPresetMidiBytes(sourceBytes, presetProgram) {
    if (bytesToText(sourceBytes, 0, 4) !== "MThd") {
        throw new Error("Invalid MIDI header");
    }

    var headerLength = readUint32(sourceBytes, 4);
    var offset = 8 + headerLength;
    var output = [];
    var stats = {
        programChangesInserted: 0,
        programChangesRewritten: 0
    };
    pushBytes(output, sourceBytes, 0, offset);

    while (offset + 8 <= sourceBytes.length) {
        var chunkType = bytesToText(sourceBytes, offset, 4);
        var chunkLength = readUint32(sourceBytes, offset + 4);
        var chunkStart = offset + 8;
        var chunkEnd = chunkStart + chunkLength;
        if (chunkEnd > sourceBytes.length) {
            throw new Error("MIDI track chunk exceeds file length");
        }

        pushBytes(output, sourceBytes, offset, offset + 4);
        if (chunkType === "MTrk") {
            var trackBytes = presetTrackBytes(sourceBytes, chunkStart, chunkEnd, presetProgram, stats);
            appendUint32(output, trackBytes.length);
            pushBytes(output, trackBytes, 0, trackBytes.length);
        } else {
            appendUint32(output, chunkLength);
            pushBytes(output, sourceBytes, chunkStart, chunkEnd);
        }
        offset = chunkEnd;
    }

    return {
        bytes: new Uint8Array(output),
        stats: stats
    };
}

function bassMelodyTrackBytes(sourceBytes, start, end, options, stats) {
    var output = [
        0x00, 0xc0, options.melodyProgram,
        0x00, 0xc1, options.bassProgram
    ];
    var state = { offset: start };
    var runningStatus = null;
    var activeSplitNotes = {};
    var pendingDelta = 0;

    function writeEvent(delta, eventBytes) {
        appendVarLength(output, pendingDelta + delta);
        pushBytes(output, eventBytes, 0, eventBytes.length);
        pendingDelta = 0;
    }

    while (state.offset < end) {
        var delta = readVarLength(sourceBytes, state, end);
        if (state.offset >= end) break;

        var status = sourceBytes[state.offset];
        var dataOffset;
        if (status < 0x80) {
            if (runningStatus === null) {
                throw new Error("MIDI running status found before status byte");
            }
            status = runningStatus;
            dataOffset = state.offset;
        } else {
            state.offset += 1;
            dataOffset = state.offset;
            if (status < 0xf0) {
                runningStatus = status;
            }
        }

        if (status === 0xff) {
            var metaType = sourceBytes[state.offset];
            state.offset += 1;
            var metaLength = readVarLength(sourceBytes, state, end);
            var metaBytes = [0xff, metaType];
            appendVarLength(metaBytes, metaLength);
            pushBytes(metaBytes, sourceBytes, state.offset, state.offset + metaLength);
            state.offset += metaLength;
            writeEvent(delta, metaBytes);
            continue;
        }

        if (status === 0xf0 || status === 0xf7) {
            var sysexLength = readVarLength(sourceBytes, state, end);
            var sysexBytes = [status];
            appendVarLength(sysexBytes, sysexLength);
            pushBytes(sysexBytes, sourceBytes, state.offset, state.offset + sysexLength);
            state.offset += sysexLength;
            writeEvent(delta, sysexBytes);
            continue;
        }

        var dataLength = midiEventDataLength(status);
        state.offset = dataOffset + dataLength;

        var eventType = status & 0xf0;
        var originalChannel = status & 0x0f;
        var firstDataByte = sourceBytes[dataOffset];
        var secondDataByte = dataLength > 1 ? sourceBytes[dataOffset + 1] : 0;
        var splitKey = originalChannel + ":" + firstDataByte;

        if (eventType === 0xc0) {
            pendingDelta += delta;
            stats.programChangesSkipped += 1;
            continue;
        }

        if (eventType === 0x90 && secondDataByte > 0) {
            var noteChannel = firstDataByte < options.splitPitch ? 1 : 0;
            pushSplitChannel(activeSplitNotes, splitKey, noteChannel);
            writeEvent(delta, [eventType + noteChannel, firstDataByte, secondDataByte]);
            if (noteChannel === 1) {
                stats.bassNotes += 1;
            } else {
                stats.melodyNotes += 1;
            }
            continue;
        }

        if (eventType === 0x80 || (eventType === 0x90 && secondDataByte === 0)) {
            var fallbackChannel = firstDataByte < options.splitPitch ? 1 : 0;
            var routedChannel = popSplitChannel(activeSplitNotes, splitKey, fallbackChannel);
            writeEvent(delta, [eventType + routedChannel, firstDataByte, secondDataByte]);
            continue;
        }

        if (eventType === 0xb0 && dataLength === 2) {
            writeEvent(delta, [0xb0, firstDataByte, secondDataByte]);
            writeEvent(0, [0xb1, firstDataByte, secondDataByte]);
            stats.controlsDuplicated += 1;
            continue;
        }

        var eventBytes = [status];
        pushBytes(eventBytes, sourceBytes, dataOffset, dataOffset + dataLength);
        writeEvent(delta, eventBytes);
    }

    return output;
}

function createBassMelodyMidiBytes(sourceBytes, melodyProgram, splitPitch) {
    if (bytesToText(sourceBytes, 0, 4) !== "MThd") {
        throw new Error("Invalid MIDI header");
    }

    var bassPreset = arrangementPresets["bass-melody"];
    var headerLength = readUint32(sourceBytes, 4);
    var offset = 8 + headerLength;
    var output = [];
    var stats = {
        melodyNotes: 0,
        bassNotes: 0,
        programChangesSkipped: 0,
        controlsDuplicated: 0
    };
    var options = {
        melodyProgram: melodyProgram,
        bassProgram: bassPreset.bassProgram,
        splitPitch: splitPitch || bassPreset.splitPitch
    };
    pushBytes(output, sourceBytes, 0, offset);

    while (offset + 8 <= sourceBytes.length) {
        var chunkType = bytesToText(sourceBytes, offset, 4);
        var chunkLength = readUint32(sourceBytes, offset + 4);
        var chunkStart = offset + 8;
        var chunkEnd = chunkStart + chunkLength;
        if (chunkEnd > sourceBytes.length) {
            throw new Error("MIDI track chunk exceeds file length");
        }

        pushBytes(output, sourceBytes, offset, offset + 4);
        if (chunkType === "MTrk") {
            var trackBytes = bassMelodyTrackBytes(sourceBytes, chunkStart, chunkEnd, options, stats);
            appendUint32(output, trackBytes.length);
            pushBytes(output, trackBytes, 0, trackBytes.length);
        } else {
            appendUint32(output, chunkLength);
            pushBytes(output, sourceBytes, chunkStart, chunkEnd);
        }
        offset = chunkEnd;
    }

    return {
        bytes: new Uint8Array(output),
        stats: stats
    };
}

function cleanActiveMidi() {
    if (!activeMidiBytes) return;

    try {
        var options = cleanupOptions();
        var cleaned = cleanMidiBytes(activeMidiBytes, options);
        resetCleanedMidi();
        cleanedMidiBytes = new Uint8Array(cleaned.bytes);
        cleanedMidiUrl = URL.createObjectURL(new Blob([cleaned.bytes], { type: "audio/midi" }));
        downloadCleanedMidiLink.href = cleanedMidiUrl;
        downloadCleanedMidiLink.download = cleanedDownloadName();
        downloadCleanedMidiLink.hidden = false;
        loadCleanedMidiButton.hidden = false;
        cleanupStatus.textContent = "Cleaned " + formatCount(cleaned.stats.notesSeen, "note", "notes")
            + ": " + cleaned.stats.duplicateOverlapsRemoved + " overlaps, "
            + cleaned.stats.shortNotesRemoved + " short notes, "
            + cleaned.stats.velocitiesNormalized + " velocities.";
    } catch (error) {
        console.warn(error);
        resetCleanedMidi("Cleanup unavailable for this MIDI file.");
    }
}

function resetCleanupVariantOnOptionChange() {
    resetCleanedMidi("Cleanup settings changed. Run Clean MIDI again.");
}

function createPresetMidi() {
    if (!activeMidiBytes) return;

    var preset = arrangementPresets[arrangementPresetSelect.value] || arrangementPresets.piano;
    var melodyPreset = selectedMelodyPreset();
    var splitPoint = selectedBassMelodySplitPoint();
    try {
        var presetResult = preset.split
            ? createBassMelodyMidiBytes(activeMidiBytes, melodyPreset.program, splitPoint.pitch)
            : createPresetMidiBytes(activeMidiBytes, preset.program);
        var presetLabel = selectedPresetLabel(preset);
        resetPresetMidi();
        presetMidiBytes = new Uint8Array(presetResult.bytes);
        presetCreatedLabel = presetLabel;
        presetPlaybackOptions = preset.split
            ? { playbackPrograms: { 0: melodyPreset.program, 1: preset.bassProgram } }
            : { playbackProgram: preset.program };
        presetMidiUrl = URL.createObjectURL(new Blob([presetResult.bytes], { type: "audio/midi" }));
        downloadPresetMidiLink.href = presetMidiUrl;
        downloadPresetMidiLink.download = presetDownloadName(preset);
        downloadPresetMidiLink.hidden = false;
        loadPresetMidiButton.hidden = false;
        if (preset.split) {
            presetStatus.textContent = presetLabel + " ready: "
                + presetResult.stats.bassNotes + " bass notes, "
                + presetResult.stats.melodyNotes + " melody notes. Split point: " + splitPoint.label + ".";
        } else {
            presetStatus.textContent = preset.label + " preset ready: "
                + presetResult.stats.programChangesInserted + " inserted, "
                + presetResult.stats.programChangesRewritten + " rewritten. Browser playback uses the bundled "
                + preset.label + " soundfont.";
        }
    } catch (error) {
        console.warn(error);
        resetPresetMidi("Preset unavailable for this MIDI file.");
    }
}

function currentVariantPreserveOptions() {
    return {
        preserveCleaned: !!cleanedMidiBytes,
        preservePreset: !!presetMidiBytes,
        playbackProgram: activePlaybackProgram,
        playbackPrograms: activePlaybackPrograms
    };
}

function loadPresetMidi() {
    if (!presetMidiBytes || !midiReady) return;

    var fallbackPreset = arrangementPresets[arrangementPresetSelect.value] || arrangementPresets.piano;
    var presetLabel = presetCreatedLabel || fallbackPreset.label;
    if (presetPlaybackUrl && presetPlaybackUrl !== activeMidiUrl && presetPlaybackUrl.indexOf("blob:") === 0) {
        revokeObjectUrl(presetPlaybackUrl);
    }
    presetPlaybackUrl = midiBytesToDataUrl(presetMidiBytes);
    activeSongTitle.textContent = (sourceMidiTitle || activeSongTitle.textContent || "Score") + " (Preset: " + presetLabel + ")";
    setUploadStatus(presetLabel + " preset variant loaded");
    presetStatus.textContent = presetLabel + " preset variant loaded with bundled browser soundfont. Source MIDI stays unchanged.";
    var playbackOptions = presetPlaybackOptions || { playbackProgram: fallbackPreset.program };
    loadMidiFile(presetPlaybackUrl, false, {
        preserveCleaned: true,
        preservePreset: true,
        playbackProgram: playbackOptions.playbackProgram,
        playbackPrograms: playbackOptions.playbackPrograms
    });
}

function loadCleanedMidi() {
    if (!cleanedMidiBytes || !midiReady) return;

    if (cleanedPlaybackUrl && cleanedPlaybackUrl !== activeMidiUrl && cleanedPlaybackUrl.indexOf("blob:") === 0) {
        revokeObjectUrl(cleanedPlaybackUrl);
    }
    cleanedPlaybackUrl = midiBytesToDataUrl(cleanedMidiBytes);
    activeSongTitle.textContent = (sourceMidiTitle || activeSongTitle.textContent || "Score") + " (Cleaned)";
    setUploadStatus("Cleaned MIDI variant loaded");
    cleanupStatus.textContent = "Cleaned MIDI variant loaded. Source MIDI stays unchanged.";
    loadMidiFile(cleanedPlaybackUrl, false, {
        preserveCleaned: true,
        preservePreset: !!presetMidiBytes,
        playbackProgram: activePlaybackProgram,
        playbackPrograms: activePlaybackPrograms
    });
}

function objectKeyCount(object) {
    return Object.keys(object).length;
}

function formatTempoLabel(tempoEvents) {
    if (!tempoEvents.length) return "120 BPM";
    var bpms = tempoEvents.map(function (tempo) {
        return tempo.bpm;
    });
    var minBpm = Math.min.apply(null, bpms);
    var maxBpm = Math.max.apply(null, bpms);
    if (minBpm === maxBpm) return minBpm + " BPM";
    return minBpm + "-" + maxBpm + " BPM";
}

function parseMidiAnalysis(bytes) {
    if (bytesToText(bytes, 0, 4) !== "MThd") {
        throw new Error("Invalid MIDI header");
    }

    var headerLength = readUint32(bytes, 4);
    var declaredTrackCount = readUint16(bytes, 10);
    var division = readUint16(bytes, 12);
    var offset = 8 + headerLength;
    var summary = {
        trackCount: 0,
        channels: {},
        programs: {},
        channelPrograms: {},
        tempoEvents: [],
        timeSignature: null,
        polyphonyEvents: [],
        noteCount: 0,
        minPitch: 128,
        maxPitch: -1,
        maxTick: 0
    };

    while (offset + 8 <= bytes.length) {
        var chunkType = bytesToText(bytes, offset, 4);
        var chunkLength = readUint32(bytes, offset + 4);
        var chunkStart = offset + 8;
        var chunkEnd = chunkStart + chunkLength;
        if (chunkEnd > bytes.length) {
            throw new Error("MIDI track chunk exceeds file length");
        }
        if (chunkType === "MTrk") {
            summary.trackCount += 1;
            parseMidiTrack(bytes, chunkStart, chunkEnd, summary);
        }
        offset = chunkEnd;
    }

    var programCount = objectKeyCount(summary.programs);
    var channelProgramCount = objectKeyCount(summary.channelPrograms);
    var channelCount = objectKeyCount(summary.channels);
    var pitchRangeLabel = summary.noteCount
        ? midiNoteName(summary.minPitch) + "-" + midiNoteName(summary.maxPitch)
        : "--";

    return {
        durationSeconds: durationSecondsFromTempoEvents(summary.maxTick, division, summary.tempoEvents),
        tempoLabel: formatTempoLabel(summary.tempoEvents),
        primaryBpm: summary.tempoEvents.length ? summary.tempoEvents[0].bpm : 120,
        beatsPerBar: summary.timeSignature && summary.timeSignature.numerator ? summary.timeSignature.numerator : 4,
        trackCount: summary.trackCount || declaredTrackCount,
        channelCount: channelCount,
        programLabel: programCount
            ? formatCount(programCount, "program", "programs") + " / " + formatCount(channelProgramCount, "mapping", "mappings")
            : "Default piano",
        noteCount: summary.noteCount,
        pitchRangeLabel: pitchRangeLabel,
        maxPolyphony: maxPolyphony(summary.polyphonyEvents)
    };
}

function compactNoteSequence(notes, mode, maxItems) {
    var groupedNotes = {};
    notes.forEach(function (note) {
        var beatKey = Math.round(note.startBeat * 2) / 2;
        var key = String(beatKey);
        var existing = groupedNotes[key];
        if (!existing
            || (mode === "melody" && note.pitch > existing.pitch)
            || (mode === "bass" && note.pitch < existing.pitch)) {
            groupedNotes[key] = note;
        }
    });
    return Object.keys(groupedNotes).map(function (key) {
        return groupedNotes[key];
    }).sort(function (a, b) {
        return a.startTick - b.startTick || a.pitch - b.pitch;
    }).map(function (note) {
        return midiNoteName(note.pitch);
    }).filter(function (noteName, index, list) {
        return index === 0 || noteName !== list[index - 1];
    }).slice(0, maxItems);
}

function collectMidiSketchNotes(bytes, start, end, division, output) {
    var state = { offset: start };
    var runningStatus = null;
    var tick = 0;
    var activeNotes = {};

    while (state.offset < end) {
        tick += readVarLength(bytes, state, end);
        output.maxTick = Math.max(output.maxTick, tick);
        if (state.offset >= end) break;

        var status = bytes[state.offset];
        var dataOffset;
        if (status < 0x80) {
            if (runningStatus === null) {
                throw new Error("MIDI running status found before status byte");
            }
            status = runningStatus;
            dataOffset = state.offset;
        } else {
            state.offset += 1;
            dataOffset = state.offset;
            if (status < 0xf0) {
                runningStatus = status;
            }
        }

        if (status === 0xff) {
            var metaType = bytes[state.offset];
            state.offset += 1;
            var metaLength = readVarLength(bytes, state, end);
            if (metaType === 0x51 && metaLength === 3 && !output.bpm) {
                var microsecondsPerQuarter = (bytes[state.offset] << 16) + (bytes[state.offset + 1] << 8) + bytes[state.offset + 2];
                output.bpm = Math.round(60000000 / microsecondsPerQuarter);
            } else if (metaType === 0x58 && metaLength >= 2 && !output.beatsPerBar) {
                output.beatsPerBar = bytes[state.offset];
            }
            state.offset += metaLength;
            continue;
        }

        if (status === 0xf0 || status === 0xf7) {
            var sysexLength = readVarLength(bytes, state, end);
            state.offset += sysexLength;
            continue;
        }

        var dataLength = midiEventDataLength(status);
        state.offset = dataOffset + dataLength;
        var eventType = status & 0xf0;
        var channel = (status & 0x0f) + 1;
        var pitch = bytes[dataOffset];
        var velocity = dataLength > 1 ? bytes[dataOffset + 1] : 0;
        var key = channel + ":" + pitch;

        if (eventType === 0x90 && velocity > 0 && channel !== 10) {
            if (!activeNotes[key]) activeNotes[key] = [];
            activeNotes[key].push({ pitch: pitch, startTick: tick, velocity: velocity, channel: channel });
        } else if (eventType === 0x80 || (eventType === 0x90 && velocity === 0)) {
            if (!activeNotes[key] || !activeNotes[key].length) continue;
            var note = activeNotes[key].shift();
            if (tick <= note.startTick) continue;
            note.endTick = tick;
            note.startBeat = division > 0 ? note.startTick / division : 0;
            note.durationBeats = division > 0 ? (note.endTick - note.startTick) / division : 0;
            output.notes.push(note);
        }
    }
}

function midiSketchSummary(bytes, options) {
    options = options || {};
    if (bytesToText(bytes, 0, 4) !== "MThd") {
        throw new Error("Invalid MIDI header");
    }
    var headerLength = readUint32(bytes, 4);
    var division = readUint16(bytes, 12);
    if (division <= 0 || (division & 0x8000)) {
        throw new Error("MIDI-to-Strudel needs ticks-per-quarter timing.");
    }
    var offset = 8 + headerLength;
    var output = {
        notes: [],
        maxTick: 0,
        bpm: 0,
        beatsPerBar: 0
    };

    while (offset + 8 <= bytes.length) {
        var chunkType = bytesToText(bytes, offset, 4);
        var chunkLength = readUint32(bytes, offset + 4);
        var chunkStart = offset + 8;
        var chunkEnd = chunkStart + chunkLength;
        if (chunkEnd > bytes.length) {
            throw new Error("MIDI track chunk exceeds file length");
        }
        if (chunkType === "MTrk") {
            collectMidiSketchNotes(bytes, chunkStart, chunkEnd, division, output);
        }
        offset = chunkEnd;
    }

    if (!output.notes.length) {
        throw new Error("No MIDI notes available for Strudel sketching.");
    }

    var bars = Number(options.bars) === 4 || Number(options.bars) === 8 ? Number(options.bars) : 8;
    var beatsPerBar = output.beatsPerBar || 4;
    var maxBeat = bars * beatsPerBar;
    var notesInRange = output.notes.filter(function (note) {
        return note.startBeat < maxBeat;
    });
    if (!notesInRange.length) {
        notesInRange = output.notes.slice();
    }
    var pitches = notesInRange.map(function (note) {
        return note.pitch;
    });
    var minPitch = Math.min.apply(null, pitches);
    var maxPitch = Math.max.apply(null, pitches);
    var melodyNotes = compactNoteSequence(notesInRange.filter(function (note) {
        return note.pitch >= 55;
    }), "melody", 24);
    var bassNotes = compactNoteSequence(notesInRange.filter(function (note) {
        return note.pitch < 60;
    }), "bass", 12);
    if (!melodyNotes.length) {
        melodyNotes = compactNoteSequence(notesInRange, "melody", 16);
    }
    if (!bassNotes.length) {
        bassNotes = compactNoteSequence(notesInRange, "bass", 8);
    }

    var warnings = ["This is a simplified sketch summary, not an exact MIDI reconstruction."];
    if (output.notes.length > notesInRange.length) {
        warnings.push("Only the first " + bars + " bars were summarized.");
    }
    if (output.notes.length > 300) {
        warnings.push("Dense MIDI was reduced to representative melody and bass notes.");
    }

    return {
        title: sourceMidiTitle || activeSongTitle.textContent || "Current MIDI",
        bpm: output.bpm || options.bpm || 120,
        bars: bars,
        beatsPerBar: beatsPerBar,
        noteCount: output.notes.length,
        summarizedNoteCount: notesInRange.length,
        pitchRange: midiNoteName(minPitch) + "-" + midiNoteName(maxPitch),
        melodyNotes: melodyNotes,
        bassNotes: bassNotes,
        warnings: warnings
    };
}

function midiNoteActivity(bytes, options) {
    options = options || {};
    if (bytesToText(bytes, 0, 4) !== "MThd") {
        throw new Error("Invalid MIDI header");
    }
    var headerLength = readUint32(bytes, 4);
    var division = readUint16(bytes, 12);
    if (division <= 0 || (division & 0x8000)) {
        throw new Error("Note Activity needs ticks-per-quarter timing.");
    }
    var offset = 8 + headerLength;
    var output = {
        notes: [],
        maxTick: 0,
        bpm: 0,
        beatsPerBar: 0
    };

    while (offset + 8 <= bytes.length) {
        var chunkType = bytesToText(bytes, offset, 4);
        var chunkLength = readUint32(bytes, offset + 4);
        var chunkStart = offset + 8;
        var chunkEnd = chunkStart + chunkLength;
        if (chunkEnd > bytes.length) {
            throw new Error("MIDI track chunk exceeds file length");
        }
        if (chunkType === "MTrk") {
            collectMidiSketchNotes(bytes, chunkStart, chunkEnd, division, output);
        }
        offset = chunkEnd;
    }

    var bars = Number(options.bars) || Number(strudelBarsSelect.value) || 8;
    var beatsPerBar = output.beatsPerBar || 4;
    var maxNoteBeat = output.notes.reduce(function (maxBeat, note) {
        return Math.max(maxBeat, note.startBeat + note.durationBeats);
    }, 0);
    var totalBeats = Math.max(bars * beatsPerBar, maxNoteBeat, beatsPerBar);
    return {
        notes: output.notes,
        bars: Math.max(1, Math.ceil(totalBeats / beatsPerBar)),
        beatsPerBar: beatsPerBar,
        totalBeats: totalBeats
    };
}

function resetNoteActivity(message) {
    if (!noteActivityGrid || !noteActivitySummary) return;
    noteActivitySummary.textContent = message || "Generate MIDI to view note activity";
    noteActivityGrid.classList.add("is-empty");
    noteActivityGrid.innerHTML = "";
    var empty = document.createElement("span");
    empty.className = "note-activity-empty";
    empty.textContent = message || "Generate MIDI to view note activity";
    noteActivityGrid.appendChild(empty);
    resetNoteDensity(message);
}

function resetNoteDensity(message) {
    if (!noteDensityGrid || !noteDensitySummary) return;
    noteDensitySummary.textContent = message ? "Unavailable" : "Waiting for MIDI";
    noteDensityGrid.classList.add("is-empty");
    noteDensityGrid.innerHTML = "";
    var empty = document.createElement("span");
    empty.className = "note-density-empty";
    empty.textContent = message || "Generate MIDI";
    noteDensityGrid.appendChild(empty);
}

function renderNoteDensity(activity) {
    if (!noteDensityGrid || !noteDensitySummary) return;
    var barCount = Math.max(1, Math.min(activity.bars, 16));
    var buckets = [];
    for (var index = 0; index < barCount; index += 1) {
        buckets.push({ notes: 0, velocityTotal: 0 });
    }
    activity.notes.forEach(function (note) {
        var barIndex = Math.max(0, Math.min(barCount - 1, Math.floor(note.startBeat / activity.beatsPerBar)));
        buckets[barIndex].notes += 1;
        buckets[barIndex].velocityTotal += note.velocity || 64;
    });
    var maxNotes = buckets.reduce(function (maxValue, bucket) {
        return Math.max(maxValue, bucket.notes);
    }, 1);

    noteDensityGrid.classList.remove("is-empty");
    noteDensityGrid.innerHTML = "";
    noteDensityGrid.style.gridTemplateColumns = "repeat(" + barCount + ", minmax(0, 1fr))";
    buckets.forEach(function (bucket, index) {
        var bar = document.createElement("span");
        var averageVelocity = bucket.notes ? bucket.velocityTotal / bucket.notes : 0;
        var height = bucket.notes ? Math.max(14, Math.round((bucket.notes / maxNotes) * 100)) : 8;
        var alpha = bucket.notes ? Math.max(0.28, Math.min(0.95, averageVelocity / 127)) : 0.16;
        bar.className = "note-density-bar";
        bar.title = "Bar " + (index + 1) + " · " + formatCount(bucket.notes, "note", "notes")
            + (bucket.notes ? " · avg velocity " + Math.round(averageVelocity) : "");
        bar.style.height = height + "%";
        bar.style.opacity = String(alpha);
        noteDensityGrid.appendChild(bar);
    });
    noteDensitySummary.textContent = "Bars " + barCount + " · peak " + formatCount(maxNotes, "note", "notes");
}

function renderNoteActivity(bytes, options) {
    if (!noteActivityGrid || !noteActivitySummary) return;
    var activity = midiNoteActivity(bytes, options);
    if (!activity.notes.length) {
        resetNoteActivity("No notes found in generated MIDI");
        return;
    }

    var pitches = activity.notes.map(function (note) {
        return note.pitch;
    });
    var minPitch = Math.min.apply(null, pitches);
    var maxPitch = Math.max.apply(null, pitches);
    var pitchSpan = Math.max(1, maxPitch - minPitch);
    var visibleNotes = activity.notes.slice().sort(function (a, b) {
        return a.startBeat - b.startBeat || a.pitch - b.pitch;
    }).slice(0, 180);

    noteActivityGrid.classList.remove("is-empty");
    noteActivityGrid.innerHTML = "";
    noteActivityGrid.style.backgroundSize = "calc(100% / " + Math.min(activity.bars, 16) + ") 100%, 100% 18.75%";
    noteActivitySummary.textContent = formatCount(activity.notes.length, "note", "notes")
        + " · " + midiNoteName(minPitch) + "-" + midiNoteName(maxPitch)
        + " · " + formatCount(activity.bars, "bar", "bars");

    for (var barIndex = 1; barIndex <= Math.min(activity.bars, 16); barIndex += 1) {
        var label = document.createElement("span");
        label.className = "note-activity-bar-label";
        label.textContent = String(barIndex);
        label.style.left = ((barIndex - 1) / activity.bars * 100) + "%";
        noteActivityGrid.appendChild(label);
    }

    visibleNotes.forEach(function (note) {
        var block = document.createElement("span");
        var left = Math.max(0, Math.min(100, (note.startBeat / activity.totalBeats) * 100));
        var width = Math.max(0.7, Math.min(100 - left, (note.durationBeats / activity.totalBeats) * 100));
        var top = 12 + ((maxPitch - note.pitch) / pitchSpan) * 78;
        block.className = "note-block";
        block.title = midiNoteName(note.pitch) + " · beat " + note.startBeat.toFixed(2);
        block.style.left = left + "%";
        block.style.width = width + "%";
        block.style.top = top + "%";
        noteActivityGrid.appendChild(block);
    });
    renderNoteDensity(activity);
}

function noteNameForOffset(offset) {
    var absoluteNote = controls.octave * 12 + offset;
    return noteNames[absoluteNote % 12] + Math.floor(absoluteNote / 12);
}

function renderKeyboardMap() {
    keyCodeToOffset = {};
    keyboardLayoutRows.forEach(function (row) {
        row.element.innerHTML = "";
        row.keys.forEach(function (key) {
            keyCodeToOffset[key.code] = key.offset;

            var keyLabel = document.createElement("span");
            keyLabel.textContent = key.label;

            var noteLabel = document.createElement("small");
            noteLabel.textContent = noteNameForOffset(key.offset);

            var keyElement = document.createElement("kbd");
            keyElement.appendChild(keyLabel);
            keyElement.appendChild(noteLabel);
            row.element.appendChild(keyElement);
        });
    });
}

function downloadNameFromSongName(songName) {
    return songName + ".mid";
}

function loadMidiFile(url, start, options) {
    options = options || {};
    activePlaybackIsPreview = false;
    previewRestoreState = null;
    analyzeMidiUrl(url, options);
    loadMidiPlayback(url, start, options);
}

function loadMidiPreview(url, start, options) {
    options = options || {};
    activePlaybackIsPreview = true;
    loadMidiPlayback(url, start, options);
}

function loadMidiPlayback(url, start, options) {
    options = options || {};
    activeMidiUrl = url;
    MIDI.Player.stop();
    if (options.playbackPrograms) {
        setPlaybackPrograms(options.playbackPrograms);
    } else {
        setPlaybackProgram(typeof options.playbackProgram === "number" ? options.playbackProgram : arrangementPresets.piano.program);
    }
    syncPlayerSeekTime(0);
    releaseKeyboardNotes();
    playbackClockStartMs = 0;
    playbackClockBaseSeconds = 0;
    setPlaybackState(false);
    updateTimelinePosition(0);
    MIDI.Player.timeWarp = 1 / controls.playbackSpeed;
    MIDI.Player.loadFile(url, function () {
        syncPlayerSeekTime(0);
        setTimelineDuration(MIDI.Player.endTime / 1000);
        updateTimelinePosition(0);
        if (start) {
            startPlayback();
        }
    });
}

function setPlaybackProgram(program) {
    activePlaybackProgram = program;
    activePlaybackPrograms = null;
    if (!midiReady || !MIDI.programChange) return;
    for (var channel = 0; channel < 16; channel += 1) {
        if (channel !== 9) {
            MIDI.programChange(channel, program);
        }
    }
}

function setPlaybackPrograms(programs) {
    activePlaybackPrograms = {};
    Object.keys(programs).forEach(function (channel) {
        activePlaybackPrograms[channel] = programs[channel];
    });
    activePlaybackProgram = typeof programs[0] === "number" ? programs[0] : arrangementPresets.piano.program;
    if (!midiReady || !MIDI.programChange) return;
    for (var channel = 0; channel < 16; channel += 1) {
        if (channel !== 9) {
            MIDI.programChange(channel, arrangementPresets.piano.program);
        }
    }
    Object.keys(programs).forEach(function (channel) {
        MIDI.programChange(parseInt(channel, 10), programs[channel]);
    });
}

function loadConvertedMidi(blob, downloadName, title, options) {
    options = options || {};
    if (convertedMidiUrl) {
        revokeObjectUrl(convertedMidiUrl);
    }
    convertedMidiUrl = URL.createObjectURL(blob);
    loadMidiFile(convertedMidiUrl, options.start !== false, {
        storeAsSource: true,
        sourceDownloadName: downloadName,
        sourceTitle: title
    });
}

function reloadActiveMidi() {
    if (activeMidiUrl) {
        loadMidiFile(activeMidiUrl, true, currentVariantPreserveOptions());
    }
}

function setPlaybackState(isPlaying) {
    playButton.textContent = isPlaying ? "Pause" : "Play";
    playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
}

function startPlayback() {
    if (!activeMidiUrl || !midiReady) return;
    playbackClockBaseSeconds = currentTimelineSeekSeconds();
    if (loopEnabled && hasLoopRange()
            && (playbackClockBaseSeconds < loopRangeStartSeconds || playbackClockBaseSeconds >= loopRangeEndSeconds)) {
        playbackClockBaseSeconds = loopRangeStartSeconds;
        updateTimelinePosition(playbackClockBaseSeconds);
    }
    playbackClockStartMs = Date.now();
    syncPlayerSeekTime(playbackClockBaseSeconds);
    MIDI.Player.resume();
    setPlaybackState(true);
}

function pausePlayback() {
    var pausedSeconds = currentPlaybackSeconds();
    syncPlayerSeekTime(pausedSeconds);
    updateTimelinePosition(pausedSeconds);
    MIDI.Player.pause();
    playbackClockStartMs = 0;
    playbackClockBaseSeconds = pausedSeconds;
    setPlaybackState(false);
}

function playPausePlayback() {
    if (MIDI.Player.playing) {
        pausePlayback();
    } else {
        startPlayback();
    }
}

function stopPlayback() {
    MIDI.Player.stop();
    releaseKeyboardNotes();
    playbackClockStartMs = 0;
    playbackClockBaseSeconds = 0;
    setPlaybackState(false);
    updateTimelinePosition(0);
}

function restartPlayback() {
    if (!activeMidiUrl || !midiReady) return;
    loopRestartQueued = false;
    var restartSeconds = loopEnabled && hasLoopRange() ? loopRangeStartSeconds : 0;
    updateTimelinePosition(restartSeconds);
    syncPlayerSeekTime(restartSeconds);
    if (activePlaybackIsPreview) {
        loadMidiPreview(activeMidiUrl, true, currentVariantPreserveOptions());
    } else {
        loadMidiFile(activeMidiUrl, true, currentVariantPreserveOptions());
    }
}

function setLoopEnabled(enabled) {
    loopEnabled = enabled;
    loopButton.classList.toggle("is-active", loopEnabled);
    loopButton.setAttribute("aria-pressed", loopEnabled ? "true" : "false");
    updateLoopRangeStatus();
}

function beginTimelineSeek() {
    if (timelineSlider.disabled) return;
    isSeekingTimeline = true;
    wasPlayingBeforeSeek = MIDI.Player.playing;
    if (wasPlayingBeforeSeek) {
        MIDI.Player.pause();
    }
}

function previewTimelineSeek() {
    if (timelineSlider.disabled) return;
    updateTimelinePosition(currentTimelineSeekSeconds());
}

function commitTimelineSeek() {
    if (timelineSlider.disabled) return;
    var seekSeconds = currentTimelineSeekSeconds();
    var shouldResumeAfterSeek = wasPlayingBeforeSeek || MIDI.Player.playing;

    isSeekingTimeline = false;
    loopRestartQueued = false;
    releaseKeyboardNotes();
    MIDI.Player.pause();
    syncPlayerSeekTime(seekSeconds);
    playbackClockStartMs = 0;
    playbackClockBaseSeconds = seekSeconds;
    updateTimelinePosition(seekSeconds);

    if (shouldResumeAfterSeek) {
        startPlayback();
    } else {
        setPlaybackState(false);
    }
    wasPlayingBeforeSeek = false;
}

function resetCameraView() {
    camera.position.set(-3.35, 5.0, 11.5);
    cameraControls.target.set(4.5, 0, 0);
    cameraControls.update(0);
}

function setupPlaybackAnimation() {
    MIDI.Player.setAnimation({
        interval: 100,
        callback: function (data) {
            if (!data.end) return;

            if (!isSeekingTimeline) {
                if (timelineDurationSeconds <= 0) {
                    setTimelineDuration(data.end);
                }
                updateTimelinePosition(MIDI.Player.playing ? currentPlaybackSeconds() : data.now);
            }

            if (!MIDI.Player.playing) return;

            var currentSeconds = currentPlaybackSeconds();
            var loopEndSeconds = activeLoopEndSeconds(data.end);
            var reachedEnd = currentSeconds >= loopEndSeconds;
            if (!reachedEnd) {
                loopRestartQueued = false;
                return;
            }

            if (loopEnabled && !loopRestartQueued) {
                loopRestartQueued = true;
                window.setTimeout(function () {
                    loopRestartQueued = false;
                    playbackClockBaseSeconds = activeLoopStartSeconds();
                    playbackClockStartMs = Date.now();
                    syncPlayerSeekTime(playbackClockBaseSeconds);
                    updateTimelinePosition(playbackClockBaseSeconds);
                    MIDI.Player.resume();
                    setPlaybackState(true);
                }, 0);
            } else if (!loopEnabled) {
                stopPlayback();
            }
        }
    });
}

function responseError(response) {
    return response.text().then(function (message) {
        message = message || response.statusText || "Request failed";
        throw new Error("HTTP " + response.status + ": " + message);
    });
}

function waitForConversionPoll() {
    return new Promise(function (resolve) {
        window.setTimeout(resolve, conversionPollDelayMs);
    });
}

function asyncEndpointUnavailableError() {
    var error = new Error("Async conversion endpoint unavailable.");
    error.fallbackToSync = true;
    return error;
}

function resolveJobUrl(url) {
    if (!url) return "";
    return new URL(url, transcriptionJobsApiUrl).href;
}

function conversionJobUrl(id) {
    return transcriptionJobsApiUrl.replace(/\/$/, "") + "/" + encodeURIComponent(id);
}

function conversionJobStatusMessage(job) {
    var status = job && job.status ? job.status : "";
    var message = job && job.message ? job.message : "";
    if (status === "queued") return "Queued conversion...";
    if (status === "running") return "Running conversion...";
    if (status === "succeeded") return "Converted and loaded";
    if (status === "failed") return "Conversion failed: " + (message || "Backend conversion failed.");
    return message || "Waiting for conversion...";
}

function conversionElapsedText(job) {
    var message = job && job.message ? job.message : "";
    var match = message.match(/in\s+([0-9]+(?:\.[0-9]+)?s)/i);
    return match ? match[1] : "";
}

function conversionLoadedStatusMessage(job) {
    var elapsedText = conversionElapsedText(job);
    return elapsedText ? "Converted and loaded in " + elapsedText : "Converted and loaded";
}

function conversionSucceededLoadingMessage(job) {
    var elapsedText = conversionElapsedText(job);
    return elapsedText ? "Conversion succeeded in " + elapsedText + ". Loading MIDI..." : "Conversion succeeded. Loading MIDI...";
}

function loadConvertedMidiFromJob(job, songName) {
    var downloadUrl = resolveJobUrl(job.downloadUrl);
    if (!downloadUrl) {
        throw new Error("Conversion job did not provide a MIDI download URL.");
    }
    return fetch(downloadUrl).then(function (response) {
        if (!response.ok) {
            return responseError(response);
        }
        return response.blob();
    }).then(function (blob) {
        var downloadName = downloadNameFromSongName(songName);
        var title = job.engineLabel ? songName + " · " + job.engineLabel : songName;
        loadConvertedMidi(blob, downloadName, title);
        setUploadStatus(conversionLoadedStatusMessage(job));
        showConversionResult(downloadName, blob);
        activeSongTitle.textContent = title;
    });
}

function fetchConvertedMidiBlob(job) {
    var downloadUrl = resolveJobUrl(job.downloadUrl);
    if (!downloadUrl) {
        return Promise.reject(new Error("Conversion job did not provide a MIDI download URL."));
    }
    return fetch(downloadUrl).then(function (response) {
        if (!response.ok) {
            return responseError(response);
        }
        return response.blob();
    });
}

function pollConversionJobStatus(jobUrl, onUpdate, attempt) {
    attempt = attempt || 1;
    if (attempt > maxConversionPollAttempts) {
        return Promise.reject(new Error("Conversion polling timed out. Retry the conversion or check Docker logs."));
    }
    return fetch(jobUrl).then(function (response) {
        if (!response.ok) {
            return responseError(response);
        }
        return response.json();
    }).then(function (job) {
        if (job.status === "succeeded") {
            return job;
        }
        if (onUpdate) {
            onUpdate(job);
        }
        if (job.status === "failed") {
            throw new Error(job.message || "Backend conversion failed.");
        }
        return waitForConversionPoll().then(function () {
            return pollConversionJobStatus(jobUrl, onUpdate, attempt + 1);
        });
    });
}

function pollConversionJob(jobUrl, songName) {
    return pollConversionJobStatus(jobUrl, function (job) {
        setUploadStatus(conversionJobStatusMessage(job));
    }).then(function (job) {
        setUploadStatus(conversionSucceededLoadingMessage(job));
        return loadConvertedMidiFromJob(job, songName);
    });
}

function createConversionJob(formData) {
    if (!transcriptionJobsApiUrl) {
        return Promise.reject(asyncEndpointUnavailableError());
    }
    return fetch(transcriptionJobsApiUrl, {
        method: "POST",
        body: formData
    }).then(function (response) {
        if (response.status === 404 || response.status === 405) {
            throw asyncEndpointUnavailableError();
        }
        if (!response.ok) {
            return responseError(response);
        }
        return response.json();
    });
}

function runAsyncConversion(formData, songName) {
    setUploadStatus("Queued conversion...");
    return createConversionJob(formData).then(function (job) {
        if (!job || !job.id) {
            throw new Error("Conversion job response did not include a job id.");
        }
        setUploadStatus(conversionJobStatusMessage(job));
        if (job.status === "failed") {
            throw new Error(job.message || "Backend conversion failed.");
        }
        return pollConversionJob(conversionJobUrl(job.id), songName);
    });
}

function runCompareEngine(file, songName, engine) {
    updateCompareCard(engine, "Queued", "Waiting for backend");
    return createConversionJob(createConversionFormData(file, songName, engine)).then(function (job) {
        if (!job || !job.id) {
            throw new Error("Conversion job response did not include a job id.");
        }
        updateCompareCard(engine, conversionJobStatusMessage(job), job.engineLabel || conversionEngines[engine].label);
        if (job.status === "failed") {
            throw new Error(job.message || "Backend conversion failed.");
        }
        return pollConversionJobStatus(conversionJobUrl(job.id), function (updatedJob) {
            updateCompareCard(engine, conversionJobStatusMessage(updatedJob), updatedJob.engineLabel || conversionEngines[engine].label);
        });
    }).then(function (job) {
        updateCompareCard(engine, conversionSucceededLoadingMessage(job), job.engineLabel || conversionEngines[engine].label);
        return fetchConvertedMidiBlob(job).then(function (blob) {
            showCompareResult(engine, job, blob, songName);
            return job;
        });
    }).catch(function (error) {
        updateCompareCard(engine, "Failed", conversionErrorMessage(error));
        throw error;
    });
}

function runCompareConversion(file, songName) {
    if (!transcriptionJobsApiUrl) {
        return Promise.reject(new Error("Compare mode needs local Docker backend."));
    }
    showCompareResults();
    setUploadStatus("Comparing engines...");
    var engines = ["piano-onnx", "basic-pitch"];
    return Promise.allSettled(engines.map(function (engine) {
        return runCompareEngine(file, songName, engine);
    })).then(function (results) {
        var succeeded = results.filter(function (result) {
            return result.status === "fulfilled";
        }).length;
        if (succeeded === 0) {
            throw new Error("Both transcription engines failed.");
        }
        setUploadStatus("Compare ready. Preview or load the version you prefer.");
    });
}

function runSynchronousConversion(formData, songName) {
    if (!transcriptionApiUrl) {
        return Promise.reject(new Error("Needs local Docker backend"));
    }
    setUploadStatus("Converting. This may take a minute.");
    return fetch(transcriptionApiUrl, {
        method: "POST",
        body: formData
    }).then(function (response) {
        if (!response.ok) {
            return responseError(response);
        }
        return response.blob();
    }).then(function (blob) {
        var downloadName = downloadNameFromSongName(songName);
        loadConvertedMidi(blob, downloadName, songName);
        setUploadStatus("Converted and loaded");
        showConversionResult(downloadName, blob);
        activeSongTitle.textContent = songName;
    });
}

uploadFileInput.onchange = function () {
    var file = uploadFileInput.files[0];
    fileName.textContent = file ? file.name : "No file selected";
    setSourceAudioPreview(file || null);
    hideConversionResult();
    hideCompareResults();
    setUploadStatus(conversionWaitingStatus());
    updateUploadButton();
};

midiFileInput.onchange = function () {
    var file = midiFileInput.files[0];
    midiFileName.textContent = file ? file.name : "No MIDI selected";
    if (!file) return;

    if (!midiReady) {
        setUploadStatus("Wait for soundfont, then open MIDI again.");
        return;
    }

    if (localMidiUrl) {
        revokeObjectUrl(localMidiUrl);
    }
    localMidiUrl = URL.createObjectURL(file);
    hideConversionResult();
    hideCompareResults();
    setUploadStatus("Local MIDI loaded");
    activeSongTitle.textContent = songNameFromFile(file);
    loadMidiFile(localMidiUrl, true, {
        storeAsSource: true,
        sourceDownloadName: file.name,
        sourceTitle: songNameFromFile(file)
    });
};

retryConvertButton.onclick = function () {
    if (!convertButton.disabled) {
        convertButton.click();
    }
};

convertButton.onclick = function () {
    var file = uploadFileInput.files[0];
    if (!file) return;
    if (!transcriptionApiUrl && !transcriptionJobsApiUrl) {
        setUploadStatus("Static preview: audio conversion requires local Docker backend.");
        return;
    }

    var songName = songNameFromFile(file);
    var mode = currentConversionMode();

    convertButton.disabled = true;
    hideConversionResult();
    if (mode === "compare") {
        runCompareConversion(file, songName).catch(function (error) {
            console.error(error);
            setUploadStatus(conversionErrorMessage(error));
        }).finally(updateUploadButton);
        return;
    }

    hideCompareResults();
    runAsyncConversion(createConversionFormData(file, songName, mode), songName).catch(function (error) {
        if (error && error.fallbackToSync) {
            if (mode !== "piano-onnx") {
                throw new Error("This engine needs the async Docker backend.");
            }
            setUploadStatus("Async endpoint unavailable. Trying direct conversion.");
            return runSynchronousConversion(createConversionFormData(file, songName, null), songName);
        }
        throw error;
    }).catch(function (error) {
        console.error(error);
        setUploadStatus(conversionErrorMessage(error));
    }).finally(updateUploadButton);
};

function conversionErrorMessage(error) {
    var message = error && error.message ? error.message : "";
    if (message.indexOf("Failed to fetch") >= 0 || message.indexOf("NetworkError") >= 0) {
        return "Backend unavailable. Start Docker and retry.";
    }
    if (message.indexOf("Unsupported audio format") >= 0) {
        return "Unsupported file. Upload MP3 or WAV.";
    }
    if (message.indexOf("ONNX model not found") >= 0 || message.indexOf("missing model") >= 0) {
        return "Backend model missing. Check .isolation/models/transcription.onnx.";
    }
    if (message.indexOf("ffmpeg") >= 0 || message.indexOf("audio decode") >= 0) {
        return "Audio decode failed. Try another MP3/WAV file.";
    }
    if (message.indexOf("HTTP 500") >= 0) {
        return "Backend conversion failed. Check Docker logs.";
    }
    return message || "Conversion failed.";
}

function strudelErrorMessage(error) {
    var message = error && error.message ? error.message : "";
    if (message.indexOf("Failed to fetch") >= 0 || message.indexOf("NetworkError") >= 0) {
        return "Strudel service unavailable. Start Docker and retry.";
    }
    if (message.indexOf("No MIDI note events") >= 0) {
        return "No MIDI notes found in this sketch.";
    }
    if (message.indexOf("timed out") >= 0) {
        return "Sketch generation timed out.";
    }
    return message || "Sketch generation failed.";
}

function aiSketchErrorMessage(error) {
    var message = error && error.message ? error.message : "";
    if (message.indexOf("Failed to fetch") >= 0 || message.indexOf("NetworkError") >= 0) {
        return "AI sketch service unavailable. Run docker compose up -d ai-sketch-service and retry.";
    }
    if (message.indexOf("API key is not configured") >= 0) {
        return "Model key not configured in Docker environment.";
    }
    if (message.indexOf("not valid JSON") >= 0 || message.indexOf("JSON") >= 0) {
        return "AI response was not valid JSON. Try again or switch model.";
    }
    if (message.indexOf("unsupported") >= 0 || message.indexOf("missing") >= 0) {
        return "AI generated unsupported Strudel code. Try a simpler prompt.";
    }
    if (message.indexOf("mimo-v2.5-pro is still thinking") >= 0) {
        return "MiMo timed out before final JSON. Try again or use a shorter prompt.";
    }
    if (message.indexOf("timed out") >= 0 || message.indexOf("still thinking") >= 0) {
        return "AI sketch request timed out.";
    }
    return message || "AI sketch generation failed.";
}

conversionModeInputs.forEach(function (input) {
    input.onchange = function () {
        hideConversionResult();
        hideCompareResults();
        updateUploadButton();
        setUploadStatus(conversionWaitingStatus());
    };
});

workspaceModeInputs.forEach(function (input) {
    input.onchange = function () {
        setWorkspaceMode(input.value);
    };
});

compareCards.forEach(function (card) {
    var engine = card.getAttribute("data-engine");
    var previewButton = card.querySelector(".compare-preview-button");
    var loadButton = card.querySelector(".compare-load-button");
    previewButton.onclick = function () {
        var result = compareResults[engine];
        if (!result) return;
        if (!activePlaybackIsPreview) {
            previewRestoreState = {
                url: activeMidiUrl,
                title: activeSongTitle.textContent,
                playbackProgram: activePlaybackProgram,
                playbackPrograms: activePlaybackPrograms
            };
        }
        loadMidiPreview(result.url, true, { playbackProgram: arrangementPresets.piano.program });
        setUploadStatus("Previewing " + conversionEngines[engine].label + " result");
        activeSongTitle.textContent = result.title;
    };
    loadButton.onclick = function () {
        var result = compareResults[engine];
        if (!result) return;
        loadConvertedMidi(result.blob, result.downloadName, result.title, { start: false });
        showConversionResult(result.downloadName, result.blob);
        setUploadStatus("Loaded " + conversionEngines[engine].label + " result as source");
        activeSongTitle.textContent = result.title;
    };
});

if (clearCompareResultsButton) {
    clearCompareResultsButton.onclick = clearCompareResults;
}

window.addEventListener("beforeunload", function () {
    revokeObjectUrl(sourceAudioUrl);
    revokeObjectUrl(convertedMidiUrl);
    revokeObjectUrl(localMidiUrl);
    revokeObjectUrl(cleanedMidiUrl);
    revokeObjectUrl(cleanedPlaybackUrl);
    revokeObjectUrl(presetMidiUrl);
    revokeObjectUrl(presetPlaybackUrl);
    revokeObjectUrl(strudelMidiUrl);
    revokeObjectUrl(sourceMidiDownloadUrl);
    revokeCompareResultUrls();
});
    
var scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x08090b, 12, 34);
    
var camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 2.0, 5000);
camera.position.x = -3.35;
camera.position.z = 11.5;
camera.position.y = 5.0;
    
floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshPhongMaterial({ color: 0x121315, shininess: 16 }));
floor.rotation.x = - 90 * (Math.PI / 180); //桌面与钢琴的夹角，默认为垂直
floor.position.y = -0.52; //桌面的纵坐标
floor.receiveShadow = true; //接受钢琴投影在桌面上
scene.add(floor); //添加到场景中  
    
var spotlight = new THREE.DirectionalLight(0xfff2d6); //平行光强度
spotlight.position.set(1.5, 4.2, -6.5); //光源位置
spotlight.target.position.set(5.2, -5, 6.2); //光源指向
spotlight.shadowDarkness = 0.58; //影子深度
spotlight.intensity = 1.18; //光照强度
spotlight.castShadow = true; //是否产生阴影
//决定有多少像素用来构成阴影
spotlight.shadowMapWidth = 2048;
spotlight.shadowMapHeight = 2048;
//投影相机
spotlight.shadowCameraNear = 5.0; //表示到距离光源的哪一个位置开始生成阴影
spotlight.shadowCameraFar = 20.0; //表示到距离光源的哪一个位置可以生成阴影
spotlight.shadowBias = 0.0025; //解决自遮挡阴影瑕疵(shadow acne)
//投影边界
spotlight.shadowCameraLeft = -8.85;
spotlight.shadowCameraRight = 5.5;
spotlight.shadowCameraTop = 4;
spotlight.shadowCameraBottom = 0;
scene.add(spotlight);
var fillLight = new THREE.DirectionalLight(0x7ce7df, 0.34);
fillLight.position.set(1, 1, 1).normalize();
scene.add(fillLight);
var rimLight = new THREE.DirectionalLight(0xf0b35a, 0.38);
rimLight.position.set(-1, -1, -1).normalize();
scene.add(rimLight);
var ambientLight = new THREE.AmbientLight(0x303236);
scene.add(ambientLight);
    
var controls = new function () {
    this.key_attack_time = 9.0; //按键时间，小的时候有变化感
    this.key_max_rotation = 0.72; //琴键旋转角
    this.octave = 2; //八度
    this.song = "game_of_thrones.mid"; //选择一个预览
    this.playbackSpeed = 1.0;
    this.noteOnColor = [240, 179, 90, 1.0]; //颜色数组
    this.play = function ()//播放
    {
        playPausePlayback();
    };
    this.stop = function ()//停止至开始
    {
        stopPlayback();
    }
};
var songsToFiles = {
    "Game Of Thrones Theme, Ramin Djawadi": "game_of_thrones.mid",
    "Mario Overworld Theme (Super Mario Bros 3), Koji Kondo": "mario_-_overworld_theme.mid",
    "He's a Pirate (Pirates of the Caribbean), Klaus Badelt": "hes_a_pirate.mid",
    "Hedwigs Theme (Harry Potter), John Williams": "hedwigs_theme.mid",
    "Something There (Beauty and the Beast), Alan Menken": "something_there.mid",
    "Cruel Angel Thesis (Neon Genesis Evangelion)": "cruel_angel__s_thesis.mid",
    "Me cuesta tanto olvidarte (Mecano)": "me_cuesta.mid",
    "Sonata No. 14 C# minor (Moonlight), Beethoven": "mond_1.mid",
    "For Elise, Beethoven": "for_elise_by_beethoven.mid",
    "Asturias (Leyenda), Albeniz": "alb_se5_format0.mid",
    "Aragon (Fantasia), Albeniz": "alb_se6.mid",
    "Prelude and Fugue in C major BWV 846, Bach": "bach_846.mid",
    "Fantasia C major, Schubert": "schub_d760_1.mid",
    "Sonata No. 16 C major, Mozart": "mz_545_1.mid",
    "Sonata No. 11 A major (K331, First Movement), Mozart": "mz_331_1.mid",
    "March - Song of the Lark, Tchaikovsky": "ty_maerz.mid",
    "Piano Sonata in C major, Hoboken, Haydn": "haydn_35_1.mid",
    "Etudes, Opus 25, Chopin": "chpn_op25_e1.mid",
    "Polonaise Ab major, Opus 53, Chopin": "chpn_op53.mid",
    "No. 2 - Oriental, Granados": "gra_esp_2.mid",
    "Bohemian Rhapsody, Queen": "bohemian1.mid",
};

function songTitleFromFile(fileName) {
    for (var title in songsToFiles) {
        if (songsToFiles[title] === fileName) {
            return title;
        }
    }
    return fileName;
}

function populateSongSelect() {
    for (var title in songsToFiles) {
        var option = document.createElement("option");
        option.value = songsToFiles[title];
        option.textContent = title;
        songSelect.appendChild(option);
    }
    songSelect.value = controls.song;
}

function releaseKeyboardNotes() {
    if (!keys_down) return;
    for (keyCode in keys_down) {
        if (typeof keys_down[keyCode] === "number") {
            releasePianoKey(keys_down[keyCode], "keyboard:" + keyCode);
        }
    }
    keys_down = [];
}

function setNoteColorFromHex(hex) {
    var color = new THREE.Color(hex);
    controls.noteOnColor = [
        Math.round(color.r * 255),
        Math.round(color.g * 255),
        Math.round(color.b * 255),
        1.0
    ];
    noteOnColor = color;
}

var keyState = Object.freeze({ unpressed: {}, note_on: {}, pressed: {}, note_off: {} }); //冻结四个要素，不能被修改
    
var renderer = new THREE.WebGLRenderer({ antialias: true }); //开启反锯齿
renderer.setSize(window.innerWidth, window.innerHeight); //设置渲染区域尺寸         
renderer.setClearColor(0x08090b, 1);
renderer.shadowMapEnabled = true;  //阴影效果
renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.physicallyBasedShading = true;
renderer.domElement.className = "stage-canvas";
document.body.appendChild(renderer.domElement);
     
var material = new THREE.MeshLambertMaterial({ color: 0x606060 }); //颜色没什么关系
    
noteOnColor = new THREE.Color().setRGB(controls.noteOnColor[0] / 256.0, controls.noteOnColor[1] / 256.0, controls.noteOnColor[2] / 256.0);
    
var loader = new THREE.ColladaLoader();
loader.load('./vendor/obj/piano.dae', prepare_scene);
    
var cameraControls = new THREE.OrbitAndPanControls(camera, renderer.domElement); //实现鼠标和键盘控制
cameraControls.target.set(4.5, 0, 0); //三维旋转中心
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
var pianoKeyMeshes = [];
var activeKeyHolds = {};
var activePointerKey = null;
    
var clock = new THREE.Clock();

function stageViewportWidth() {
    if (document.body.classList.contains("sketch-mode") && sketchPanel && !sketchPanel.hidden) {
        updateSketchLayoutMetrics();
        var leftWidth = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sketch-left-width"));
        return Math.max(320, Math.round(leftWidth || (window.innerWidth - sketchPanel.getBoundingClientRect().width)));
    }
    return window.innerWidth;
}

function on_window_resize() //设置大小
{
    var stageWidth = stageViewportWidth();
    camera.aspect = stageWidth / window.innerHeight;
    camera.updateProjectionMatrix(); //每渲染一次重新计算一次
    
    renderer.setSize(stageWidth, window.innerHeight); //渲染区域大小
}
//场景准备
function prepare_scene(collada) {
    collada.scene.traverse(initialize_keys);
    scene.add(collada.scene);
}
var keys_down = [];
var keys_obj = [];
    
function initialize_keys(obj) {
    keys_obj.push(obj);
    obj.rotation.x = -Math.PI / 4.0; //旋转度
    obj.rotation.y = 0;
    obj.rotation.z = 0;
    obj.keyState = keyState.unpressed; //未按状态
    obj.clock = new THREE.Clock(false); //设置时钟
    obj.castShadow = true; //阴影
    obj.receiveShadow = true;
    
    // only add meshes in the material redefinition (to make keys change their color when pressed)
    //按键颜色改变
    if (obj instanceof THREE.Mesh) {
        old_material = obj.material; //材质不变
        obj.material = new THREE.MeshPhongMaterial({ color: old_material.color }); //
        obj.material.shininess = 35.0;
        obj.material.specular = new THREE.Color().setRGB(0.25, 0.25, 0.25);
        obj.material.note_off = obj.material.color.clone();
        if (pianoKeyIndexFromObject(obj) !== null) {
            pianoKeyMeshes.push(obj);
        }
    
    }
    
}
//琴键状态
function key_status(keyName, status) {
    var obj = scene.getObjectByName(keyName, true);
    if (obj != undefined) {
        obj.clock.start();
        obj.clock.elapsedTime = 0;
        obj.keyState = status;
    }
}

function pianoKeyName(keyIndex) {
    return "_" + keyIndex;
}

function midiNoteFromPianoKey(keyIndex) {
    return keyIndex + 21;
}

function pianoKeyIndexFromObject(obj) {
    var current = obj;
    while (current) {
        if (/^_\d+$/.test(current.name)) {
            return parseInt(current.name.substring(1), 10);
        }
        current = current.parent;
    }
    return null;
}

function pressPianoKey(keyIndex, holdId) {
    if (typeof keyIndex !== "number") return;
    if (!activeKeyHolds[keyIndex]) {
        activeKeyHolds[keyIndex] = {};
    }
    if (activeKeyHolds[keyIndex][holdId]) return;

    var firstHold = Object.keys(activeKeyHolds[keyIndex]).length === 0;
    activeKeyHolds[keyIndex][holdId] = true;
    if (firstHold) {
        key_status(pianoKeyName(keyIndex), keyState.note_on);
        if (midiReady) {
            MIDI.setVolume(0, 127);
            MIDI.noteOn(0, midiNoteFromPianoKey(keyIndex), 127, 0);
        }
    }
}

function releasePianoKey(keyIndex, holdId) {
    if (typeof keyIndex !== "number" || !activeKeyHolds[keyIndex]) return;
    delete activeKeyHolds[keyIndex][holdId];
    if (Object.keys(activeKeyHolds[keyIndex]).length === 0) {
        delete activeKeyHolds[keyIndex];
        key_status(pianoKeyName(keyIndex), keyState.note_off);
        if (midiReady) {
            MIDI.setVolume(0, 127);
            MIDI.noteOff(0, midiNoteFromPianoKey(keyIndex), 0.08);
        }
    }
}

function keyIndexFromClientPoint(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    var intersections = raycaster.intersectObjects(pianoKeyMeshes, true);
    for (var i = 0; i < intersections.length; i++) {
        var keyIndex = pianoKeyIndexFromObject(intersections[i].object);
        if (keyIndex !== null) {
            return keyIndex;
        }
    }
    return null;
}

function onPianoMouseDown(event) {
    if (event.button !== 0) return;
    var keyIndex = keyIndexFromClientPoint(event.clientX, event.clientY);
    if (keyIndex === null) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    activePointerKey = keyIndex;
    pressPianoKey(keyIndex, "pointer");
    document.addEventListener("mouseup", onPianoMouseUp, true);
}

function onPianoMouseUp() {
    if (activePointerKey !== null) {
        releasePianoKey(activePointerKey, "pointer");
        activePointerKey = null;
    }
    document.removeEventListener("mouseup", onPianoMouseUp, true);
}

function onPianoTouchStart(event) {
    if (!event.changedTouches.length) return;
    var touch = event.changedTouches[0];
    var keyIndex = keyIndexFromClientPoint(touch.clientX, touch.clientY);
    if (keyIndex === null) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    activePointerKey = keyIndex;
    pressPianoKey(keyIndex, "pointer");
}

function onPianoTouchMove(event) {
    if (activePointerKey !== null) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

function onPianoTouchEnd(event) {
    if (activePointerKey !== null) {
        event.preventDefault();
        event.stopImmediatePropagation();
        releasePianoKey(activePointerKey, "pointer");
        activePointerKey = null;
    }
}

function frame() {
    requestAnimationFrame(frame);
    
    var delta = clock.getDelta();
    
    update(delta);
    
    render(delta);
    
}
function smoothstep(a, b, x) {
    if (x < a) return 0.0;
    if (x > b) return 1.0;
    var y = (x - a) / (b - a);
    return y * y * (3.0 - 2.0 * y);
}
    
function mix(a, b, x) {
    return a + (b - a) * Math.min(Math.max(x, 0.0), 1.0);
}
//更新琴键状态***********
function update_key(obj, delta) {
    if (obj.keyState == keyState.note_on) { //按下
        obj.rotation.x = mix(-Math.PI / 4.0, -controls.key_max_rotation, smoothstep(0.0, 1.0, controls.key_attack_time * obj.clock.getElapsedTime())); //根据时间变化
        if (obj.rotation.x >= -controls.key_max_rotation) {
            obj.keyState = keyState.pressed;
            obj.clock.elapsedTime = 0;
        }
        obj.material.color = noteOnColor;
    }
    else if (obj.keyState == keyState.note_off) {
        obj.rotation.x = mix(-controls.key_max_rotation, -Math.PI / 4.0, smoothstep(0.0, 1.0, controls.key_attack_time * obj.clock.getElapsedTime()));
        if (obj.rotation.x <= -Math.PI / 4.0) {
            obj.keyState = keyState.unpressed;
            obj.clock.elapsedTime = 0;
        }
        obj.material.color = obj.material.note_off;
    }
}
//*************
function update(delta) {
    cameraControls.update(delta);
    for (i in keys_obj) {
        update_key(keys_obj[i], delta);
    }
    
}
//渲染
function render(delta) {
    renderer.render(scene, camera);
};
    
frame();
//******************
function keyCode_to_keyIndex(keyCode) {
    if (typeof keyCodeToOffset[keyCode] !== "number") return -1;
    return keyCodeToOffset[keyCode] + controls.octave * 12;
    
}

function keyCode_to_note(keyCode) {
    var keyIndex = keyCode_to_keyIndex(keyCode);
    if (keyIndex == -1) return -1;
    return pianoKeyName(keyIndex);
}

function isKeyboardInputTarget(target) {
    if (!target || !target.tagName) return false;
    var tagName = target.tagName.toLowerCase();
    return tagName === "input" || tagName === "select" || tagName === "button" || tagName === "textarea";
}
    
window.onkeydown = function (ev) {
    if (ev.key === "Escape" && stageTipsPopover && !stageTipsPopover.hidden) {
        setStageTipsOpen(false);
        return;
    }
    if (isKeyboardInputTarget(ev.target)) return;
    if (typeof keys_down[ev.keyCode] !== "number") {
        var keyIndex = keyCode_to_keyIndex(ev.keyCode);
        if (keyIndex != -1) {
            keys_down[ev.keyCode] = keyIndex;
            pressPianoKey(keyIndex, "keyboard:" + ev.keyCode);
            ev.preventDefault();
        }
    }
}
    
window.onkeyup = function (ev) {
    if (typeof keys_down[ev.keyCode] === "number") {
        releasePianoKey(keys_down[ev.keyCode], "keyboard:" + ev.keyCode);
        delete keys_down[ev.keyCode];
        ev.preventDefault();
    }
    
}

renderer.domElement.addEventListener("mousedown", onPianoMouseDown, true);
renderer.domElement.addEventListener("touchstart", onPianoTouchStart, true);
renderer.domElement.addEventListener("touchmove", onPianoTouchMove, true);
renderer.domElement.addEventListener("touchend", onPianoTouchEnd, true);
renderer.domElement.addEventListener("touchcancel", onPianoTouchEnd, true);
    
window.onload = function () {
    loadStrudelExample(defaultStrudelExample, "Ready to sketch");
    renderStrudelDrafts();
    resetNoteActivity();
    restoreSketchIdeWidth();
    setWorkspaceMode("transcribe");
    updateFloatingChromeOffsets();
    populateSongSelect();
    renderKeyboardMap();
    updatePresetFields();
    songSelect.onchange = function () {
        controls.song = songSelect.value;
        activeSongTitle.textContent = songTitleFromFile(controls.song);
        if (midiReady) {
            loadMidiFile("./vendor/MIDI/midi/" + controls.song, true, {
                storeAsSource: true,
                sourceDownloadName: controls.song,
                sourceTitle: songTitleFromFile(controls.song)
            });
        }
    };
    playButton.onclick = controls.play;
    stopButton.onclick = controls.stop;
    restartButton.onclick = restartPlayback;
    cleanMidiButton.onclick = cleanActiveMidi;
    cleanupShortNoteSelect.onchange = resetCleanupVariantOnOptionChange;
    cleanupDuplicatesInput.onchange = resetCleanupVariantOnOptionChange;
    cleanupVelocitySelect.onchange = resetCleanupVariantOnOptionChange;
    loadCleanedMidiButton.onclick = loadCleanedMidi;
    createPresetMidiButton.onclick = createPresetMidi;
    loadPresetMidiButton.onclick = loadPresetMidi;
    generateAiSketchButton.onclick = generateAiStrudelPattern;
    midiToStrudelButton.onclick = generateStrudelFromCurrentMidi;
    explainAiSketchButton.onclick = explainAiStrudelPattern;
    applyAiEditButton.onclick = editAiStrudelPattern;
    generateStrudelButton.onclick = generateStrudelSketch;
    previewStrudelButton.onclick = previewStrudelSketch;
    loadStrudelButton.onclick = loadStrudelSketchAsSource;
    strudelExampleSelect.onchange = function () {
        loadStrudelExample(selectedStrudelExample());
    };
    resetStrudelExampleButton.onclick = function () {
        loadStrudelExample(selectedStrudelExample());
    };
    saveStrudelDraftButton.onclick = saveStrudelDraft;
    loadStrudelDraftButton.onclick = loadStrudelDraft;
    duplicateStrudelDraftButton.onclick = duplicateStrudelDraft;
    tidyStrudelButton.onclick = tidyStrudelSource;
    clearStrudelButton.onclick = clearStrudelSource;
    sketchResizer.onpointerdown = beginSketchResize;
    window.addEventListener("pointermove", resizeSketchIde);
    window.addEventListener("pointerup", endSketchResize);
    window.addEventListener("resize", restoreSketchIdeWidth);
    window.addEventListener("resize", updateFloatingChromeOffsets);
    arrangementPresetSelect.onchange = function () {
        updatePresetFields();
        resetPresetMidi();
    };
    melodySoundSelect.onchange = function () {
        resetPresetMidi();
    };
    bassSplitPointSelect.onchange = function () {
        resetPresetMidi();
    };
    timelineSlider.onpointerdown = beginTimelineSeek;
    timelineSlider.onkeydown = beginTimelineSeek;
    timelineSlider.oninput = previewTimelineSeek;
    timelineSlider.onchange = commitTimelineSeek;
    loopButton.onclick = function () {
        setLoopEnabled(!loopEnabled);
    };
    loopStartButton.onclick = setLoopRangeStart;
    loopEndButton.onclick = setLoopRangeEnd;
    loopClearButton.onclick = clearLoopRange;
    resetViewButton.onclick = resetCameraView;
    stageTipsButton.onclick = toggleStageTips;
    speedSlider.oninput = function () {
        controls.playbackSpeed = parseFloat(speedSlider.value);
        speedValue.textContent = controls.playbackSpeed.toFixed(1) + "x";
    };
    speedSlider.onchange = reloadActiveMidi;
    octaveSlider.oninput = function () {
        controls.octave = parseInt(octaveSlider.value, 10);
        octaveValue.textContent = controls.octave;
        keyboardOctaveValue.textContent = controls.octave;
        releaseKeyboardNotes();
        renderKeyboardMap();
    };
    noteColorInput.oninput = function () {
        setNoteColorFromHex(noteColorInput.value);
    };
    applyRuntimeModeMessaging();
    MIDI.loadPlugin({
        instruments: presetSoundfontInstruments,
        callback: function () {
            //MIDI.Player.loadFile(song[0], MIDI.Player.start);
            midiReady = true;
            setMidiStatus("Ready", "status-ready");
            updateUploadButton();
            activeSongTitle.textContent = songTitleFromFile(controls.song);
            loadMidiFile("./vendor/MIDI/midi/" + controls.song, false, {
                storeAsSource: true,
                sourceDownloadName: controls.song,
                sourceTitle: songTitleFromFile(controls.song)
            });

            MIDI.Player.addListener(function (data) {
                var pianoKey = data.note - MIDI.pianoKeyOffset - 3;
                if (data.message === 144) {
                    key_status("_" + pianoKey, keyState.note_on);
                }
                else {
                    key_status("_" + pianoKey, keyState.note_off);
                }
            });
            setupPlaybackAnimation();

            // Close the MIDI loader widget once the custom controls are ready.
            MIDI.loader.stop();
        }
    });
};
    
window.addEventListener('resize', on_window_resize, false);
