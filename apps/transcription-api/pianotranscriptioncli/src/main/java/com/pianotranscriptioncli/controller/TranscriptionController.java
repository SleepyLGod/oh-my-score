package com.pianotranscriptioncli.controller;

import com.pianotranscriptioncli.common.api.CommonResult;
import com.pianotranscriptioncli.dto.Mp3ImportDTO;
import com.pianotranscriptioncli.dto.TranscriptionJobResponse;
import com.pianotranscriptioncli.service.TranscriptionService;
import com.pianotranscriptioncli.vo.Mp3ImportVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
// @CrossOrigin(origins = "*", maxAge = 360000) // 不能和CorsConfig同时使用
@RequestMapping("/transcription")
public class TranscriptionController {

    @Autowired
    TranscriptionService transcriptionService;

    @GetMapping(value = "/health")
    public String health() {
        return "ok";
    }

    @PostMapping(value = "/mp3ToMidi", consumes = {"application/json"})
    @ResponseBody
    public Mp3ImportVO Mp3ToMidi(@RequestBody Mp3ImportDTO mp3ImportDTO) throws Exception {
        try {
            CommonResult commonResult = transcriptionService.Mp3TOMidiUpload(mp3ImportDTO);
            if (commonResult.getCode() == 1) {
                return new Mp3ImportVO(true, commonResult.getData().toString(), null);
            } else {
                return new Mp3ImportVO(false, null, commonResult.getMessage());
            }
        } catch (NullPointerException e) {
            return new Mp3ImportVO(false, null, "请检查是否传入了正确的参数");
        }
    }


    @ResponseBody
    @PostMapping(value = {"/audioToMidiWithFile", "/mp3ToMidiWithFile"}, consumes = {"multipart/form-data"})
    public ResponseEntity<Resource> AudioToMidiWithFile(@RequestParam("file") MultipartFile file,
                                                        @RequestParam("songName") String songName) throws Exception {
        Path midiPath = transcriptionService.AudioTOMidiUploadWithFile(file, songName);
        String downloadName = songName + ".mid";
        return midiResponse(midiPath, downloadName);
    }

    @ResponseBody
    @PostMapping(value = "/jobs", consumes = {"multipart/form-data"})
    public TranscriptionJobResponse createJob(@RequestParam("file") MultipartFile file,
                                              @RequestParam("songName") String songName,
                                              @RequestParam(value = "engine", required = false) String engine) throws Exception {
        return transcriptionService.createAudioToMidiJob(file, songName, engine);
    }

    @GetMapping(value = "/jobs/{id}")
    public ResponseEntity<TranscriptionJobResponse> getJob(@PathVariable("id") String id) {
        TranscriptionJobResponse job = transcriptionService.getTranscriptionJob(id);
        if (job == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(job);
    }

    @GetMapping(value = "/jobs/{id}/midi")
    public ResponseEntity<?> getJobMidi(@PathVariable("id") String id) throws Exception {
        TranscriptionJobResponse job = transcriptionService.getTranscriptionJob(id);
        if (job == null) {
            return ResponseEntity.notFound().build();
        }
        if (!"succeeded".equals(job.getStatus())) {
            return ResponseEntity.status(409).body(job);
        }
        Path midiPath = job.getMidiPath();
        if (midiPath == null) {
            return ResponseEntity.notFound().build();
        }
        return midiResponse(midiPath, midiPath.getFileName().toString());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> badRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(exception.getMessage());
    }

    private ResponseEntity<Resource> midiResponse(Path midiPath, String downloadName) throws Exception {
        InputStreamResource resource = new InputStreamResource(Files.newInputStream(midiPath));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/midi"))
                .contentLength(Files.size(midiPath))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(downloadName, StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(resource);
    }

}
