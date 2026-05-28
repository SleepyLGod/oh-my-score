<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com/?font=Roboto+Mono&size=25&width=300&color=46BEA3&duration=1600&lines=Oh-My-Score" height="80" alt="Oh-My-Score"/>
  <br>
  <strong>本地优先的音乐工作室：音频转 MIDI、浏览器播放和 Smart Score 工具。</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> | 简体中文
</p>

<p align="center">
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/blank.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/blank.yml/badge.svg" alt="Node.js CI"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/backend.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/backend.yml/badge.svg" alt="Backend CI"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/pages.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/commits/main"><img src="https://img.shields.io/github/last-commit/SleepyLGod/oh-my-score" alt="Last commit"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="License: MPL 2.0"></a>
</p>

<p align="center">
  <img src="./docs/assets/demo.png" alt="OMG Score piano player demo">
</p>

## 概览

OMG Score 可以把钢琴录音和 MIDI 文件接入一个可播放、可检查的浏览器工作流。它把本地音频转 MIDI、3D 钢琴播放器、MIDI 分析、清理/导出工具和轻量编配草稿整合在一起。

这个项目面向本地优先的音乐实验：完整栈通过 Docker 运行；静态前端也可以发布到 GitHub Pages，用于 MIDI 播放和界面体验。

## 你可以做什么

- 将 MP3/WAV 音频转换成标准 MIDI 文件。
- 在 Piano ONNX、Basic Pitch 和 Compare mode 之间选择转换方式。
- 试听、加载并下载生成的 MIDI 结果。
- 查看 MIDI 的 duration、tempo、tracks、channels、programs、notes、pitch range 和 rough polyphony。
- 导出 source MIDI、保守清理后的 cleaned MIDI，以及 General MIDI preset 变体。
- 创建轻量的 Piano、Strings、Soft Synth 和 Bass + Melody 编配草稿。
- 在 3D 钢琴工作室中播放 MIDI，支持琴键动画、timeline seek、loop、speed control、鼠标/触摸输入和键盘演奏。

## 为什么选择 OMG Score

- 本地优先：音频转换在你的机器上运行，不依赖托管服务。
- Docker 隔离：不需要在宿主机安装 Node、Java、Maven 或 FFmpeg。
- 透明可控：转换后的 MIDI 可以下载，并继续放进 MuseScore、DAW 或其他 MIDI 编辑器。
- 用户自己选择：Compare mode 用于试听和检查；OMG Score 不会给引擎排名，也不会自动替你选择结果。

## GitHub Pages Demo

```text
https://sleepylgod.github.io/oh-my-score/
```

Pages workflow 会发布 [`apps/piano-player`](./apps/piano-player/)。
静态托管支持 MIDI 播放和 3D 钢琴 UI。音频转 MIDI 需要本地 Docker backend。

## 隔离本地运行

运行缓存、ONNX 模型和生成文件都会放在 `.isolation/` 下。

```bash
mkdir -p .isolation/models
curl -L -o .isolation/models/transcription.onnx \
  https://github.com/EveElseIf/pianotranscription_java/releases/download/blob/transcription.onnx
docker compose up --build
```

打开前端：

```text
http://localhost:8080
```

后端 API 地址：

```text
http://localhost:8084
```

停止服务：

```bash
docker compose down
```

如果转换时报缺少模型，请先确认 `.isolation/models/transcription.onnx` 存在，再启动 Compose。

## 当前状态

- 音频转录：已支持 MP3/WAV 上传、异步任务、Piano ONNX、Basic Pitch 和 Compare mode。
- 浏览器播放：已支持打开本地 MIDI、3D 钢琴动画、timeline seek、loop、speed control 和交互式演奏输入。
- Smart Score 工具：已支持 MIDI 分析、source export、保守 cleanup、preset variants 和 Bass + Melody sketches。
- 开发工作流：已配置 Docker 隔离、frontend CI、backend CI 和 GitHub Pages deploy。

详见 [`docs/TODO.md`](./docs/TODO.md) 中的 Smart Score roadmap 和可选后续 backlog。开发验证和提交前检查见 [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md)。

## 仓库结构

```text
apps/
  piano-player/       静态 3D 钢琴前端
  transcription-api/  Spring Boot 音频转 MIDI 后端
  basic-pitch-service Docker 内部 Basic Pitch sidecar
packages/
  midi-player/        JavaScript MIDI parser/player package
docs/
  assets/             README 和文档图片
experiments/
  basic-pitch/        Docker-only Basic Pitch prototype
  engine-eval/        本地 engine comparison 工具
```

## API

- `GET /transcription/health` 返回后端健康状态。
- `POST /transcription/audioToMidiWithFile` 接收带有 MP3 或 WAV `file` 字段的 `multipart/form-data`，并返回生成的 `.mid` 文件。
- `POST /transcription/mp3ToMidiWithFile` 保留为兼容别名。
- `POST /transcription/jobs` 启动异步 MP3/WAV 转换任务。可选 `engine` 值为 `piano-onnx` 和 `basic-pitch`；省略时使用 `piano-onnx`。
- `GET /transcription/jobs/{id}` 返回转换任务的 queued、running、succeeded 或 failed 状态。
- `GET /transcription/jobs/{id}/midi` 下载 succeeded 状态任务生成的 MIDI。

## 技术栈

- Three.js
- MIDI.js
- Spring Boot
- Maven
- FFmpeg
- ONNX Runtime
- Basic Pitch sidecar service

## Attribution

Preset browser playback 使用来自 [`gleitz/midi-js-soundfonts`](https://github.com/gleitz/midi-js-soundfonts) 的 selected FluidR3 General MIDI soundfont assets。
详见 [`docs/ATTRIBUTIONS.md`](./docs/ATTRIBUTIONS.md)。
