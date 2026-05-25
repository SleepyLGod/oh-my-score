package com.pianotranscriptioncli.service.impl;

import com.pianotranscriptioncli.common.api.CommonResult;
import com.pianotranscriptioncli.dto.Mp3ImportDTO;
import com.pianotranscriptioncli.dto.TranscriptionJobResponse;
import com.pianotranscriptioncli.service.TranscriptionService;
import com.pianotranscriptioncli.utils.Utils;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import libpianotranscription.Transcriptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

@Service
public class TranscriptionServiceImpl implements TranscriptionService {
    private static final long JOB_RETENTION_MS = TimeUnit.HOURS.toMillis(24);

    @Value("${omg.transcription.work-dir}")
    private String workDir;

    @Value("${omg.transcription.model-path}")
    private String modelPath;

    private final ConcurrentHashMap<String, TranscriptionJob> jobs = new ConcurrentHashMap<>();
    private final Object transcriptorLock = new Object();
    private final ExecutorService conversionExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "omg-transcription-worker");
        return thread;
    });
    private final ScheduledExecutorService cleanupExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "omg-transcription-cleanup");
        thread.setDaemon(true);
        return thread;
    });
    private Transcriptor sharedTranscriptor;
    private Path sharedTranscriptorModelPath;

    @PostConstruct
    public void startCleanup() {
        cleanupExecutor.scheduleAtFixedRate(this::cleanupOldJobs, 5, 5, TimeUnit.MINUTES);
    }

    @Override
    public CommonResult Mp3TOMidiUpload(Mp3ImportDTO mp3ImportDTO) throws Exception {
        Path resourcePath;
        if (mp3ImportDTO.isAbsolute()) {
            resourcePath = normalizePath(mp3ImportDTO.getResourcePath());
        } else {
            System.out.println(System.getProperty("user.dir"));
            resourcePath = Path.of(System.getProperty("user.dir")).resolve(normalizeRelativePath(mp3ImportDTO.getResourcePath()));
        }
        Path outPath = normalizePath(mp3ImportDTO.getOutPath()).resolve(mp3ImportDTO.getSongName() + ".mid");
        String ans = Utils.ConvertorRedirect(resourcePath.toString(), mp3ImportDTO.getSongName(), outPath.toString());
        if (ans != null) {
            return CommonResult.success(ans, "mp3转换成功");
        } else {
            return CommonResult.failed("mp3转换失败");
        }
    }

    /**
     * 上传文件
     * @param file 上传的音频文件
     * @param songName 歌曲名
     * @return Path
     * @throws Exception
     */
    @Override
    public Path Mp3TOMidiUploadWithFile(MultipartFile file, String songName) throws Exception {
        return AudioTOMidiUploadWithFile(file, songName);
    }

    @Override
    public Path AudioTOMidiUploadWithFile(MultipartFile file, String songName) throws Exception {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("音频文件不能为空");
        }

        String safeSongName = sanitizeSongName(songName);
        String extension = audioExtension(file);
        Path root = Path.of(workDir);
        Path inputDir = root.resolve("input");
        Path outputDir = root.resolve("output");
        Path tmpDir = root.resolve("tmp");
        Files.createDirectories(inputDir);
        Files.createDirectories(outputDir);

        Path inputFile = inputDir.resolve(safeSongName + "." + extension);
        Path outputFile = outputDir.resolve(safeSongName + ".mid");
        long uploadStoreStart = System.nanoTime();
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, inputFile, StandardCopyOption.REPLACE_EXISTING);
        }
        long uploadStoreMs = elapsedMs(uploadStoreStart);
        System.out.println("音频文件存入成功!");

        return convertSavedAudioToMidi(inputFile, outputFile, tmpDir, uploadStoreMs).getOutputPath();
    }

    @Override
    public TranscriptionJobResponse createAudioToMidiJob(MultipartFile file, String songName) throws Exception {
        cleanupOldJobs();
        String jobId = UUID.randomUUID().toString();
        String safeSongName = sanitizeSongName(songName);
        TranscriptionJob job = new TranscriptionJob(jobId);
        jobs.put(jobId, job);

        if (file.isEmpty()) {
            job.fail("Audio file is empty.");
            return toResponse(job);
        }

        String extension;
        try {
            extension = audioExtension(file);
        } catch (IllegalArgumentException exception) {
            job.fail(exception.getMessage());
            return toResponse(job);
        }

        Path jobDir = Path.of(workDir).resolve("jobs").resolve(jobId);
        Path tmpDir = jobDir.resolve("tmp");
        Files.createDirectories(jobDir);
        job.jobDir = jobDir;
        Path inputFile = jobDir.resolve("input." + extension);
        Path outputFile = jobDir.resolve(safeSongName + ".mid");
        long uploadStoreStart = System.nanoTime();
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, inputFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            job.fail("Failed to store uploaded audio: " + exception.getMessage());
            return toResponse(job);
        }
        job.uploadStoreMs = elapsedMs(uploadStoreStart);

        job.inputPath = inputFile;
        job.outputPath = outputFile;
        job.status = "queued";
        job.message = "Queued conversion.";
        if (conversionExecutor.isShutdown()) {
            job.fail("Backend is shutting down. Retry conversion after restart.");
            return toResponse(job);
        }
        try {
            conversionExecutor.submit(() -> runConversionJob(job, tmpDir));
        } catch (RejectedExecutionException exception) {
            job.fail("Backend is shutting down. Retry conversion after restart.");
        }
        return toResponse(job);
    }

    @Override
    public TranscriptionJobResponse getTranscriptionJob(String id) {
        TranscriptionJob job = jobs.get(id);
        if (job == null) {
            return null;
        }
        return toResponse(job);
    }

    @Override
    public Path getTranscriptionJobMidi(String id) {
        TranscriptionJob job = jobs.get(id);
        if (job == null || !"succeeded".equals(job.status)) {
            return null;
        }
        return job.outputPath;
    }

    @Override
    public String WavToMidiUpload() {
        return "null";
    }

    @PreDestroy
    public void shutdown() {
        cleanupExecutor.shutdownNow();
        conversionExecutor.shutdown();
        try {
            if (!conversionExecutor.awaitTermination(10, TimeUnit.SECONDS)) {
                conversionExecutor.shutdownNow();
            }
        } catch (InterruptedException exception) {
            conversionExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }
        closeSharedTranscriptor();
    }

    private void runConversionJob(TranscriptionJob job, Path tmpDir) {
        job.status = "running";
        job.message = "Running conversion.";
        try {
            Utils.ConversionResult result = convertSavedAudioToMidi(job.inputPath, job.outputPath, tmpDir, job.uploadStoreMs);
            job.outputPath = result.getOutputPath();
            job.status = "succeeded";
            job.message = "Conversion succeeded in "
                    + formatSeconds(job.uploadStoreMs + result.getTiming().getTotalMs()) + ".";
            job.completedAtMs = System.currentTimeMillis();
        } catch (Exception exception) {
            job.fail(userFacingConversionMessage(exception));
        }
    }

    private Utils.ConversionResult convertSavedAudioToMidi(Path inputFile, Path outputFile, Path tmpDir,
                                                           long uploadStoreMs) throws Exception {
        Path model = Path.of(modelPath);
        if (!Files.exists(model)) {
            throw new FileNotFoundException("ONNX model not found: " + model);
        }

        Utils.ConversionResult result = convertWithSharedTranscriptor(inputFile, outputFile, model, tmpDir);
        if (result.getOutputPath() == null) {
            throw new IOException("Audio conversion failed.");
        }
        System.out.println(result.getTiming().toLogLine(uploadStoreMs, inputFile, outputFile));
        return result;
    }

    private Utils.ConversionResult convertWithSharedTranscriptor(Path inputFile, Path outputFile, Path model,
                                                                 Path tmpDir) throws Exception {
        synchronized (transcriptorLock) {
            long sessionCreateMs = ensureSharedTranscriptor(model);
            return Utils.convertAudioToMidiWithTiming(inputFile, outputFile, sharedTranscriptor, sessionCreateMs, tmpDir);
        }
    }

    private long ensureSharedTranscriptor(Path model) throws Exception {
        Path normalizedModel = model.toAbsolutePath().normalize();
        if (sharedTranscriptor != null && normalizedModel.equals(sharedTranscriptorModelPath)) {
            return 0;
        }

        closeSharedTranscriptor();
        long sessionStart = System.nanoTime();
        sharedTranscriptor = new Transcriptor(normalizedModel.toString());
        sharedTranscriptorModelPath = normalizedModel;
        return elapsedMs(sessionStart);
    }

    private void closeSharedTranscriptor() {
        synchronized (transcriptorLock) {
            if (sharedTranscriptor == null) {
                return;
            }
            try {
                sharedTranscriptor.close();
            } catch (Exception exception) {
                System.err.println("Failed to close shared transcriptor: " + exception.getMessage());
            } finally {
                sharedTranscriptor = null;
                sharedTranscriptorModelPath = null;
            }
        }
    }

    private TranscriptionJobResponse toResponse(TranscriptionJob job) {
        String downloadUrl = "succeeded".equals(job.status) ? "/transcription/jobs/" + job.id + "/midi" : null;
        Path midiPath = "succeeded".equals(job.status) ? job.outputPath : null;
        return new TranscriptionJobResponse(job.id, job.status, job.message, downloadUrl, midiPath);
    }

    private String userFacingConversionMessage(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return "Backend conversion failed.";
        }
        return message;
    }

    private long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private String formatSeconds(long milliseconds) {
        return String.format(Locale.ROOT, "%.2fs", milliseconds / 1000.0);
    }

    private void cleanupOldJobs() {
        long cutoffMs = System.currentTimeMillis() - JOB_RETENTION_MS;
        jobs.entrySet().removeIf(entry -> {
            TranscriptionJob job = entry.getValue();
            if (job.completedAtMs == null || job.completedAtMs >= cutoffMs) {
                return false;
            }
            deleteJobDirectory(job);
            return true;
        });
    }

    private void deleteJobDirectory(TranscriptionJob job) {
        if (job.jobDir == null || !Files.exists(job.jobDir)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(job.jobDir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    System.err.println("Failed to delete job artifact: " + path + " (" + exception.getMessage() + ")");
                }
            });
        } catch (IOException exception) {
            System.err.println("Failed to clean transcription job directory: " + exception.getMessage());
        }
    }

    private Path normalizePath(String path) {
        return Path.of(path.replace("\\", "/"));
    }

    private Path normalizeRelativePath(String path) {
        String normalized = path.replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        return Path.of(normalized);
    }

    private String sanitizeSongName(String songName) {
        String safeSongName = songName == null ? "" : songName.strip();
        safeSongName = safeSongName.replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
        if (safeSongName.isEmpty()) {
            return "upload";
        }
        return safeSongName;
    }

    private String audioExtension(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null) {
            int dotIndex = originalFilename.lastIndexOf('.');
            if (dotIndex >= 0 && dotIndex < originalFilename.length() - 1) {
                extension = originalFilename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
            }
        }
        if (extension.isEmpty()) {
            extension = extensionFromContentType(file.getContentType());
        }
        if (!extension.equals("mp3") && !extension.equals("wav")) {
            String format = extension.isEmpty() ? "unknown" : extension;
            throw new IllegalArgumentException("Unsupported audio format: " + format + ". Please upload mp3 or wav.");
        }
        return extension;
    }

    private String extensionFromContentType(String contentType) {
        if (contentType == null) {
            return "";
        }
        String normalized = contentType.toLowerCase(Locale.ROOT);
        if (normalized.equals("audio/mpeg") || normalized.equals("audio/mp3")) {
            return "mp3";
        }
        if (normalized.equals("audio/wav") || normalized.equals("audio/x-wav") || normalized.equals("audio/wave")) {
            return "wav";
        }
        return "";
    }

    private static class TranscriptionJob {
        private final String id;
        private volatile String status = "queued";
        private volatile String message = "Queued conversion.";
        private volatile Path inputPath;
        private volatile Path outputPath;
        private volatile Path jobDir;
        private volatile Long completedAtMs;
        private volatile long uploadStoreMs;

        private TranscriptionJob(String id) {
            this.id = id;
        }

        private void fail(String message) {
            this.status = "failed";
            this.message = message;
            this.completedAtMs = System.currentTimeMillis();
        }
    }
}
