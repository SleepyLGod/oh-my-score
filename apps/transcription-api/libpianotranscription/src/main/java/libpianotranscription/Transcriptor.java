package libpianotranscription;

import ai.onnxruntime.*;
import libpianotranscription.midi.NoteEvent;
import libpianotranscription.midi.PedalEvent;

import javax.sound.midi.*;
import java.io.IOException;
import java.nio.FloatBuffer;
import java.util.*;

import static libpianotranscription.midi.MidiWriter.writeEventsToMidi;

public class Transcriptor implements AutoCloseable {
    private final OrtEnvironment _env;
    private final OrtSession _session;
    private final int segment_samples = 16000 * 10;
    private final int frames_per_second = 100;//帧频
    private final int classes_num = 88;
    private final float onset_threshold = 0.3f; //起始阈值
    private final float offset_threshold = 0.3f;//终止阈值
    private final float frame_threshold = 0.1f;//帧阈值
    private final float pedal_offset_threshold = 0.2f;//踏板偏移阈值

    public Transcriptor(String modulePath) throws OrtException {
        this._env = OrtEnvironment.getEnvironment();//OrtEnvironment型变量是onnx运行时系统的主机对象。可以创建封装的 OrtSessions 特定型号。
        this._session = this._env.createSession(modulePath);//使用默认的OrtSession.SessionOptions、模型和默认内存分配器创建会话。
    }

    @Override
    public void close() throws OrtException {
        this._session.close();
    }

    public byte[] transcript(float[] pcm_data) throws InvalidMidiDataException, IOException, OrtException {
        if (pcm_data.length == 0) {
            throw new IllegalArgumentException("PCM data is empty");
        }
        int pad_len = (int) (Math.ceil((double) pcm_data.length / segment_samples)) * segment_samples - pcm_data.length;
        if (pad_len != 0)
            pcm_data = Arrays.copyOf(pcm_data, pcm_data.length + pad_len);
        /*复制指定的数组，用零截断或填充（如有必要），以便副本具有指定的长度。
        对于在原始数组和副本中都有效的所有索引，这两个数组将包含相同的值。
        对于在副本中有效但不是原始索引的任何索引，副本将包含 0f。
        当且仅当指定长度大于原始数组的长度时，此类索引才会存在。         */
        var segments = enframe(pcm_data, segment_samples);
        //将pcm_data按segment_samples进行划分形成框架
        var output_dict = forward(segments);
        var new_output_dict = new HashMap<String, float[][]>();
        for (String key : output_dict.keySet()) {
            new_output_dict.put(key, deframe(output_dict.get(key)));
        }
        var post_processor = new RegressionPostProcessor(frames_per_second, classes_num, onset_threshold, offset_threshold, frame_threshold, pedal_offset_threshold);
        var out = post_processor.outputDictToMidiEvents(new_output_dict);
        List<NoteEvent> est_note_events = (List<NoteEvent>) out.get(0);
        List<PedalEvent> est_pedal_events = (List<PedalEvent>) out.get(1);

        // write midi file here
        return writeEventsToMidi(0, est_note_events, est_pedal_events);
    }

    private List<float[]> enframe(float[] data, int segment_samples) {//将data数组按照每segment_samples
        //个元素一组，赋值给batch，并且是一半冗余地赋值，即若data为1 2 3 4 5 6 7 8且若segment_samples=4,
        // 则传为1 2 3 4;3 4 5 6;5 6 7 8
        int pointer = 0;
        var batch = new ArrayList<float[]>();
        while (pointer + segment_samples <= data.length) {
            batch.add(Arrays.copyOfRange(data, pointer, pointer + segment_samples));
            pointer += segment_samples / 2;
        }
        return batch;
    }

    private Map<String, List<float[][]>> forward(List<float[]> data) throws OrtException {
        int batch_size = 1;
        Map<String, List<float[][]>> output_dic = new HashMap<>();
        output_dic.put("reg_onset_output", new ArrayList<>());
        output_dic.put("reg_offset_output", new ArrayList<>());
        output_dic.put("frame_output", new ArrayList<>());
        output_dic.put("velocity_output", new ArrayList<>());
        output_dic.put("reg_pedal_onset_output", new ArrayList<>());
        output_dic.put("reg_pedal_offset_output", new ArrayList<>());
        output_dic.put("pedal_frame_output", new ArrayList<>());

        int pointer = 0;
        var total_segments = (int) (Math.ceil(data.size() / batch_size));//获取data中的float数组个数
        while (true) {
            System.out.println("Segment " + pointer + " / " + total_segments);
            if (pointer >= data.size()) break;//已经遍历完，循环结束
            //var tensor = Tensor.fromBlob(data.get(pointer), new long[]{1, segment_samples});
            try (var tensor = OnnxTensor.createTensor(_env, FloatBuffer.wrap(data.get(pointer)), new long[]{1, segment_samples})) {
                //var batch_output_dict = this._module.forward(IValue.from(tensor));
                var inputs = Map.of("input", tensor);
                try (var output = _session.run(inputs)) {
                    for (var i :
                            output) {
                        var value = (float[][][]) i.getValue().getValue();
                        output_dic.get(i.getKey()).add(value[0]);
                    }
                }
            }
            pointer += batch_size;
        }
        return output_dic;
    }

    private float[][] deframe(List<float[][]> x) {
        if (x.size() == 1)
            return x.get(0);//返回第一个元素(元素是二维数组，不是数字)即可
        else {
            int segment_samples = x.get(0).length - 1;
            int length = x.get(0)[0].length;
            var y = new float[(int) (segment_samples * 0.75) * 2 + (int) (segment_samples * 0.5) * (x.size() - 2)][length];
            write2DArray(
                    read2DArray(x.get(0), 0, (int) (segment_samples * 0.75), 0, length),
                    y, 0, (int) (segment_samples * 0.75), 0, length);
            for (int i = 1; i < x.size() - 1; i++) {
                write2DArray(
                        read2DArray(x.get(i), (int) (segment_samples * 0.25), (int) (segment_samples * 0.75), 0, length),
                        y, (int) (segment_samples * 0.75) + (i - 1) * (int) (segment_samples * 0.5), (int) (segment_samples * 0.75) + i * (int) (segment_samples * 0.5), 0, length);
            }
            write2DArray(
                    read2DArray(x.get(x.size() - 1), (int) (segment_samples * 0.25), segment_samples, 0, length),
                    y, (int) (segment_samples * 0.75) + (x.size() - 2) * (int) (segment_samples * 0.5), y.length, 0, length
            );
            return y;
        }
    }

    private float[][] read2DArray(float[][] x, int start1, int end1, int start2, int end2) {
        //读数组，与write2DArray相反的操作
        var output = new float[end1 - start1][end2 - start2];
        for (int i = 0; i < end1 - start1; i++) {
            for (int j = 0; j < end2 - start2; j++) {
                output[i][j] = x[start1 + i][start2 + j];
            }
        }
        return output;
    }

    private void write2DArray(float[][] source, float[][] des, int start1, int end1, int start2, int end2) {
        //把source的0到end1 - start1-1行，0到end2 - start2-1列的元素赋值给
        //des的start1到end1-1行，start2到end2-1列的元素

        for (int i = 0; i < end1 - start1; i++) {
            for (int j = 0; j < end2 - start2; j++) {
                des[i + start1][j + start2] = source[i][j];
            }
        }
    }
}

class RegressionPostProcessor {//回归处理器
    private final int frames_per_second;
    private final int classes_num;
    private final float onset_threshold;
    private final float offset_threshold;
    private final float frame_threshold;
    private final float pedal_offset_threshold;
    private final int begin_note;
    private final int velocity_scale;

    public RegressionPostProcessor(int frames_per_second, int classes_num, float onset_threshold, float offset_threshold, float frame_threshold, float pedal_offset_threshold) {
        //构造函数
        this.frames_per_second = frames_per_second;
        this.classes_num = classes_num;
        this.onset_threshold = onset_threshold;
        this.offset_threshold = offset_threshold;
        this.frame_threshold = frame_threshold;
        this.pedal_offset_threshold = pedal_offset_threshold;
        this.begin_note = 21;
        this.velocity_scale = 128;
    }

    private float[][] read2DArray(float[][] x, int start1, int end1, int start2, int end2) {//和上面的类的同名函数功能相同
        var output = new float[end1 - start1][end2 - start2];
        for (int i = 0; i < end1 - start1; i++) {
            for (int j = 0; j < end2 - start2; j++) {
                output[i][j] = x[start1 + i][start2 + j];
            }
        }
        return output;
    }

    private void write2DArray(float[][] source, float[][] des, int start1, int end1, int start2, int end2) {//和上面的类的同名函数功能相同
        for (int i = 0; i < end1 - start1; i++) {
            for (int j = 0; j < end2 - start2; j++) {
                des[i + start1][j + start2] = source[i][j];
            }
        }
    }

    public List<Object> outputDictToMidiEvents(Map<String, float[][]> dict) {
        var out1 = outputDictToNotePedalArrays(dict);
        var est_on_off_note_vels = out1.get(0);
        var est_pedal_on_offs = out1.get(1);

        var output = new ArrayList<>();

        var est_note_events = detectedNotesToEvents(est_on_off_note_vels);
        output.add(est_note_events);

        if (est_pedal_on_offs.size() != 0) {
            var est_pedal_events = detectedPedalsToEvents(est_pedal_on_offs);
            output.add(est_pedal_events);
        } else {
            output.add(new ArrayList<PedalEvent>());
        }

        return output;
    }

    private List<NoteEvent> detectedNotesToEvents(List<float[]> est_on_off_note_vels) {
        //将est_on_off_note_vels的数据传输给NoteEvent
        var output = new ArrayList<NoteEvent>();
        for (var i :
                est_on_off_note_vels) {
            output.add(new NoteEvent(i[0], i[1], (int) i[2], (int) (i[3] * velocity_scale)));
        }
        return output;
    }

    private List<PedalEvent> detectedPedalsToEvents(List<float[]> est_pedal_on_offs) {
        var output = new ArrayList<PedalEvent>();
        for (var i :
                est_pedal_on_offs) {
            output.add(new PedalEvent(i[0], i[1]));
        }
        return output;
    }

    private List<List<float[]>> outputDictToNotePedalArrays(Map<String, float[][]> dict) {
        var out1 = getBinarizedOutputFromRegression(dict.get("reg_onset_output"), onset_threshold, 2);
        var onset_output = out1.get(0);
        var onset_shift_output = out1.get(1);
        dict.put("onset_output", onset_output);
        dict.put("onset_shift_output", onset_shift_output);

        var out2 = getBinarizedOutputFromRegression(dict.get("reg_offset_output"), offset_threshold, 4);
        var offset_output = out2.get(0);
        var offset_shift_output = out2.get(1);
        dict.put("offset_output", offset_output);
        dict.put("offset_shift_output", offset_shift_output);

        if (dict.containsKey("reg_pedal_offset_output")) {
            var out3 = getBinarizedOutputFromRegression(dict.get("reg_pedal_offset_output"), pedal_offset_threshold, 4);
            var pedal_offset_output = out3.get(0);
            var pedal_offset_shift_output = out3.get(1);
            dict.put("pedal_offset_output", pedal_offset_output);
            dict.put("pedal_offset_shift_output", pedal_offset_shift_output);
        }

        var output = new ArrayList<List<float[]>>();

        var est_on_off_note_vels = outputDictToDetectedNotes(dict);
        output.add(est_on_off_note_vels);

        if (dict.containsKey("reg_pedal_onset_output")) {
            var est_pedal_on_offs = outputDictToDetectedPedals(dict);
            output.add(est_pedal_on_offs);
        } else {
            output.add(new ArrayList<>());
        }

        return output;
    }


    private List<float[][]> getBinarizedOutputFromRegression(float[][] reg_output, float threshold, int neighbour) {
        var binary_output = new float[reg_output.length][reg_output[0].length];
        var shift_output = new float[reg_output.length][reg_output[0].length];
        var frames_num = reg_output.length;
        var classes_num = reg_output[0].length;
        for (int k = 0; k < classes_num; k++) {
            var x = extract2DElementsOf2DArray(reg_output, k);
            for (int n = neighbour; n < frames_num - neighbour; n++) {
                if (x[n] > threshold && is_monotonic_neighbour(x, n, neighbour)) {
                    binary_output[n][k] = 1;
                    float shift;
                    if (x[n - 1] > x[n + 1])
                        shift = (x[n + 1] - x[n - 1]) / (x[n] - x[n + 1]) / 2;
                    else
                        shift = (x[n + 1] - x[n - 1]) / (x[n] - x[n - 1]) / 2;
                    shift_output[n][k] = shift;
                }
            }
        }
        var output = new ArrayList<float[][]>();
        output.add(binary_output);
        output.add(shift_output);
        return output;
    }

    private boolean is_monotonic_neighbour(float[] x, int n, int neighbour) {
        //检测是否是递增或递减的相邻项
        var monotonic = true;
        for (int i = 0; i < neighbour; i++) {
            if (x[n - i] < x[n - i - 1])
                monotonic = false;
            if (x[n + i] < x[n + i + 1])
                monotonic = false;
        }
        return monotonic;
    }

    private List<float[]> outputDictToDetectedNotes(Map<String, float[][]> dict) {
        var est_tuples = new ArrayList<float[]>();
        var est_midi_notes = new ArrayList<Float>();
        var classes_num = dict.get("frame_output")[0].length;
        for (int piano_note = 0; piano_note < classes_num; piano_note++) {
            var est_tuples_per_note = noteDetectionWithOnsetOffsetRegress(
                    extract2DElementsOf2DArray(dict.get("frame_output"), piano_note),
                    extract2DElementsOf2DArray(dict.get("onset_output"), piano_note),
                    extract2DElementsOf2DArray(dict.get("onset_shift_output"), piano_note),
                    extract2DElementsOf2DArray(dict.get("offset_output"), piano_note),
                    extract2DElementsOf2DArray(dict.get("offset_shift_output"), piano_note),
                    extract2DElementsOf2DArray(dict.get("velocity_output"), piano_note),
                    frame_threshold
            );
            est_tuples.addAll(est_tuples_per_note);
            for (int i = 0; i < est_tuples_per_note.size(); i++) {
                est_midi_notes.add((float) (piano_note + begin_note));
            }
        }
        // (notes, 5), the five columns are onset, offset, onset_shift,
        //        offset_shift and normalized_velocity
        if (est_tuples.size() == 0)
            return new ArrayList<>();
        else {
            var onset_times = add2ArraysAndDivide(
                    extract2DElementsOf2DArray(listToArray(est_tuples), 0),
                    extract2DElementsOf2DArray(listToArray(est_tuples), 2),
                    frames_per_second
            );
            var offset_times = add2ArraysAndDivide(
                    extract2DElementsOf2DArray(listToArray(est_tuples), 1),
                    extract2DElementsOf2DArray(listToArray(est_tuples), 3),
                    frames_per_second
            );
            var velocities = extract2DElementsOf2DArray(listToArray(est_tuples), 4);

            var est_on_off_note_vels = stack4ArraysToList(onset_times, offset_times, listToArray2(est_midi_notes), velocities);
            // (notes, 3), the three columns are onset_times, offset_times and velocity.
            return est_on_off_note_vels;
        }
    }

    private List<float[]> outputDictToDetectedPedals(Map<String, float[][]> dict) {
        var frames_num = dict.get("pedal_frame_output").length;

        var est_tuples = pedalDetectionWithOnsetOffsetRegress(
                extract2DElementsOf2DArray(dict.get("pedal_frame_output"), 0),
                extract2DElementsOf2DArray(dict.get("pedal_offset_output"), 0),
                extract2DElementsOf2DArray(dict.get("pedal_offset_shift_output"), 0),
                0.5
        );
        if (est_tuples.size() == 0)
            return new ArrayList<>();
        else {
            var onset_times = add2ArraysAndDivide(
                    extract2DElementsOf2DArray(listToArray(est_tuples), 0),
                    extract2DElementsOf2DArray(listToArray(est_tuples), 2),
                    frames_per_second
            );
            var offset_times = add2ArraysAndDivide(
                    extract2DElementsOf2DArray(listToArray(est_tuples), 1),
                    extract2DElementsOf2DArray(listToArray(est_tuples), 3),
                    frames_per_second
            );
            var est_on_off = stack2ArraysToList(onset_times, offset_times);
            return est_on_off;
        }
    }


    private float[] extract2DElementsOf2DArray(float[][] source, int index2d) {
        var output = new float[source.length];
        for (int i = 0; i < source.length; i++) {
            output[i] = source[i][index2d];
        }
        return output;
    }

    private float[][] listToArray(List<float[]> l) {
        var output = new float[l.size()][l.get(0).length];
        for (int i = 0; i < l.size(); i++) {
            for (int j = 0; j < l.get(0).length; j++) {
                output[i][j] = l.get(i)[j];
            }
        }
        return output;
    }

    private float[] listToArray2(List<Float> l) {
        var output = new float[l.size()];
        for (int i = 0; i < l.size(); i++) {
            output[i] = l.get(i);
        }
        return output;
    }

    private List<float[]> stack4ArraysToList(float[] a, float[] b, float[] c, float[] d) {
        var output = new ArrayList<float[]>();
        for (int i = 0; i < a.length; i++) {
            output.add(new float[]{a[i], b[i], c[i], d[i]});
        }
        return output;
    }

    private List<float[]> stack2ArraysToList(float[] a, float[] b) {
        var output = new ArrayList<float[]>();
        for (int i = 0; i < a.length; i++) {
            output.add(new float[]{a[i], b[i]});
        }
        return output;
    }

    private float[] add2ArraysAndDivide(float[] a, float[] b, int divide) {
        var output = new float[a.length];
        for (int i = 0; i < a.length; i++) {
            output[i] = (a[i] + b[i]) / divide;
        }
        return output;
    }

    private List<float[]> noteDetectionWithOnsetOffsetRegress(float[] frame_outputs, float[] onset_outputs, float[] onset_shift_outputs, float[] offset_outputs, float[] offset_shift_outputs, float[] velocity_outputs, float frame_threshold) {
        var bgn = 0;
        var frame_disappear = 0;
        var offset_occur = 0;
        var fin = 0;
        var output_tuples = new ArrayList<float[]>();

        for (int i = 0; i < onset_outputs.length; i++) {
            if (onset_outputs[i] == 1) {
                if (bgn != 0) {
                    fin = Math.max(i - 1, 0);
                    output_tuples.add(new float[]{bgn, fin, onset_shift_outputs[bgn],
                            0, velocity_outputs[bgn]});
                    frame_disappear = offset_occur = 0;
                }
                bgn = i;
            }

            if (bgn != 0 && i > bgn) {
                if (frame_outputs[i] <= frame_threshold && frame_disappear == 0) {
                    frame_disappear = i;
                }
                if (offset_outputs[i] == 1 && offset_occur == 0) {
                    offset_occur = i;
                }
                if (frame_disappear != 0) {
                    if (offset_occur != 0 && offset_occur - bgn > frame_disappear - offset_occur) {
                        fin = offset_occur;
                    } else {
                        fin = frame_disappear;
                    }
                    output_tuples.add(new float[]{bgn, fin, onset_shift_outputs[bgn],
                            offset_shift_outputs[fin], velocity_outputs[bgn]});
                    bgn = frame_disappear = offset_occur = 0;
                }
                if (bgn != 0 && (i - bgn >= 600 || i == onset_outputs.length - 1)) {
                    fin = i;
                    output_tuples.add(new float[]{bgn, fin, onset_shift_outputs[bgn],
                            offset_shift_outputs[fin], velocity_outputs[bgn]});
                    bgn = frame_disappear = offset_occur = 0;
                }
            }
        }
        output_tuples.sort(Comparator.comparing(x -> x[0]));
        return output_tuples;
    }

    private List<float[]> pedalDetectionWithOnsetOffsetRegress(float[] frame_outputs, float[] offset_outputs, float[] offset_shift_outputs, double frame_threshold) {
        //pedal:持续音
        //返回一个output
        var bgn = 0;
        var frame_disappear = 0;
        var offset_occur = 0;
        var fin = 0;
        var output = new ArrayList<float[]>();

        for (int i = 1; i < frame_outputs.length; i++) {
            if (frame_outputs[i] >= frame_threshold && frame_outputs[i] > frame_outputs[i - 1]) {
                if (bgn == 0) {
                    bgn = i;
                }
            }
            if (bgn != 0 && i > bgn) {
                if (frame_outputs[i] <= frame_threshold && frame_disappear == 0) {
                    frame_disappear = i;
                }
                if (offset_outputs[i] == 1 && offset_occur == 0) {
                    offset_occur = i;
                }
                if (offset_occur != 0) {
                    fin = offset_occur;
                    output.add(new float[]{bgn, fin, 0, offset_shift_outputs[fin]});
                    bgn = frame_disappear = offset_occur = 0;
                }
                if (frame_disappear != 0 && i - frame_disappear >= 10) {
                    fin = frame_disappear;
                    output.add(new float[]{bgn, fin, 0, offset_shift_outputs[fin]});
                    bgn = frame_disappear = offset_occur = 0;
                }
            }
        }
        output.sort(Comparator.comparing(x -> x[0]));
        return output;
    }
}
