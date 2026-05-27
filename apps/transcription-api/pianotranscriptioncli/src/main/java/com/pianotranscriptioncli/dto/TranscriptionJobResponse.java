package com.pianotranscriptioncli.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.nio.file.Path;

public class TranscriptionJobResponse {
    private String id;
    private String status;
    private String message;
    private String downloadUrl;
    private String engine;
    private String engineLabel;
    @JsonIgnore
    private Path midiPath;

    public TranscriptionJobResponse() {
    }

    public TranscriptionJobResponse(String id, String status, String message, String downloadUrl, String engine,
                                    String engineLabel, Path midiPath) {
        this.id = id;
        this.status = status;
        this.message = message;
        this.downloadUrl = downloadUrl;
        this.engine = engine;
        this.engineLabel = engineLabel;
        this.midiPath = midiPath;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }

    public String getEngine() {
        return engine;
    }

    public void setEngine(String engine) {
        this.engine = engine;
    }

    public String getEngineLabel() {
        return engineLabel;
    }

    public void setEngineLabel(String engineLabel) {
        this.engineLabel = engineLabel;
    }

    public Path getMidiPath() {
        return midiPath;
    }

    public void setMidiPath(Path midiPath) {
        this.midiPath = midiPath;
    }
}
