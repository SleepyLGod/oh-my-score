package com.pianotranscriptioncli.utils;

import libpianotranscription.Transcriptor;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

public class Utils {
    public static class ConversionResult {
        private final Path outputPath;
        private final ConversionTiming timing;

        public ConversionResult(Path outputPath, ConversionTiming timing) {
            this.outputPath = outputPath;
            this.timing = timing;
        }

        public Path getOutputPath() {
            return outputPath;
        }

        public ConversionTiming getTiming() {
            return timing;
        }
    }

    public static class ConversionTiming {
        private final long ffmpegPreprocessMs;
        private final long pcmReadNormalizeMs;
        private final long sessionCreateMs;
        private final long transcriptionMs;
        private final long totalMs;

        public ConversionTiming(long ffmpegPreprocessMs, long pcmReadNormalizeMs, long sessionCreateMs,
                                long transcriptionMs, long totalMs) {
            this.ffmpegPreprocessMs = ffmpegPreprocessMs;
            this.pcmReadNormalizeMs = pcmReadNormalizeMs;
            this.sessionCreateMs = sessionCreateMs;
            this.transcriptionMs = transcriptionMs;
            this.totalMs = totalMs;
        }

        public long getTotalMs() {
            return totalMs;
        }

        public String totalSecondsText() {
            return formatSeconds(totalMs);
        }

        public String toLogLine(long uploadStoreMs, Path inputFile, Path outputFile) {
            return "[conversion-timing] input=" + inputFile.getFileName()
                    + " output=" + outputFile.getFileName()
                    + " uploadStoreMs=" + uploadStoreMs
                    + " ffmpegPreprocessMs=" + ffmpegPreprocessMs
                    + " pcmReadNormalizeMs=" + pcmReadNormalizeMs
                    + " sessionCreateMs=" + sessionCreateMs
                    + " transcriptionMs=" + transcriptionMs
                    + " totalMs=" + totalMs;
        }
    }

    public static short[] toShortLE(byte[] bytes) {
        short[] output = new short[bytes.length / 2];
        for (int i = 0; i < bytes.length; i += 2) {
            var x = ((bytes[i + 1]) & 0xff) << 8;
            var y = bytes[i] & 0xff;
            output[i / 2] = (short) (x | y);
        }
        return output;
    }

    public static float[] normalizeShort(short[] shorts) {
        var output = new float[shorts.length];
        for (int i = 0; i < shorts.length; i++) {
            output[i] = (float) shorts[i] / 32767;
        }
        return output;
    }

    public static String Convertor(String resourcePath, String songName) throws Exception {
        Path root = Path.of(resourcePath);
        Path inputFilePath = root.resolve("input").resolve(songName + ".mp3");
        Path outPutFilePath = root.resolve("output").resolve(songName + ".mid");
        return convertMp3ToMidi(inputFilePath, outPutFilePath, root.resolve("transcription.onnx"), root);
    }

    public static String ConvertorRedirect(String resourcePath, String songName, String outputPath) throws Exception {
        Path root = Path.of(resourcePath);
        Path inputFilePath = root.resolve("input").resolve(songName + ".mp3");
        return convertMp3ToMidi(inputFilePath, Path.of(outputPath), root.resolve("transcription.onnx"), root);
    }

    public static String convertMp3ToMidi(Path inputFile, Path outputFile, Path modelPath, Path workDir) throws Exception {
        return convertAudioToMidi(inputFile, outputFile, modelPath, workDir);
    }

    public static String convertAudioToMidi(Path inputFile, Path outputFile, Path modelPath, Path workDir) throws Exception {
        return convertAudioToMidiWithTiming(inputFile, outputFile, modelPath, workDir).getOutputPath().toString();
    }

    public static ConversionResult convertAudioToMidiWithTiming(Path inputFile, Path outputFile, Path modelPath, Path workDir) throws Exception {
        long sessionStart = System.nanoTime();
        try (Transcriptor transcriptor = new Transcriptor(modelPath.toString())) {
            return convertAudioToMidiWithTiming(inputFile, outputFile, transcriptor, elapsedMs(sessionStart), workDir);
        }
    }

    public static ConversionResult convertAudioToMidiWithTiming(Path inputFile, Path outputFile, Transcriptor transcriptor,
                                                               long sessionCreateMs, Path workDir) throws Exception {
        long totalStart = System.nanoTime();
        Files.createDirectories(workDir);
        Path pcmPath = Files.createTempFile(workDir, "omg-transcription-", ".pcm");
        try {
            long ffmpegStart = System.nanoTime();
            preProcessFile(inputFile, pcmPath);
            long ffmpegPreprocessMs = elapsedMs(ffmpegStart);

            long pcmStart = System.nanoTime();
            byte[] pcmBytes = Files.readAllBytes(pcmPath);
            float[] pcmData = Utils.normalizeShort(Utils.toShortLE(pcmBytes));
            long pcmReadNormalizeMs = elapsedMs(pcmStart);

            long transcriptionStart = System.nanoTime();
            byte[] midiBytes = transcriptor.transcript(pcmData);
            if (outputFile.getParent() != null) {
                Files.createDirectories(outputFile.getParent());
            }
            try (var file = new FileOutputStream(outputFile.toFile())) {
                file.write(midiBytes);
                System.out.println("OK");
            }
            long transcriptionMs = elapsedMs(transcriptionStart);

            ConversionTiming timing = new ConversionTiming(
                    ffmpegPreprocessMs,
                    pcmReadNormalizeMs,
                    sessionCreateMs,
                    transcriptionMs,
                    sessionCreateMs + elapsedMs(totalStart));
            return new ConversionResult(outputFile, timing);
        } finally {
            Files.deleteIfExists(pcmPath);
        }
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private static String formatSeconds(long milliseconds) {
        return String.format(Locale.ROOT, "%.2fs", milliseconds / 1000.0);
    }

    private static void preProcessFile(Path fileName, Path pcmPath) throws Exception {
        String[] cmd = {"ffmpeg", "-i", fileName.toString(), "-ac", "1", "-ar", "16000", "-f", "s16le", pcmPath.toString(), "-y"};
        var process = new ProcessBuilder(cmd).redirectErrorStream(true).start();
        var is = process.getInputStream();
        var isr = new InputStreamReader(is);
        var br = new BufferedReader(isr);
        String line = br.readLine();
        while (line != null) {
            System.out.println(line);
            line = br.readLine();
        }
        int exitCode = process.waitFor();
        if (exitCode != 0 || !Files.exists(pcmPath)) {
            throw new Exception("ffmpeg execute failed, check if the input file does not exist");
        }
    }
}
