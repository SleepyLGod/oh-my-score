#!/usr/bin/env bash
set -u

CACHE_DIR="${WHISPER_CACHE_DIR:-/workspace/cache/whisper}"
TAG="${WHISPER_CPP_TAG:-v1.8.6}"
MODEL_URL="${WHISPER_CPP_MODEL_URL:-https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin}"
JOBS="${JOBS:-2}"
SOURCE_DIR="${CACHE_DIR}/src"
BUILD_DIR="${SOURCE_DIR}/build"
CLI_PATH="${CACHE_DIR}/whisper-cli"
PLATFORM_PATH="${CACHE_DIR}/whisper-cli.platform"
MODEL_PATH="${CACHE_DIR}/ggml-base.bin"
BLOCKER_PATH="${CACHE_DIR}/SETUP-BLOCKER.md"

mkdir -p "${CACHE_DIR}"
rm -f "${BLOCKER_PATH}"

write_blocker() {
  local message="$1"
  {
    printf '# whisper.cpp setup blocker\n\n'
    printf '%s\n' "${message}"
  } > "${BLOCKER_PATH}"
}

retry() {
  local attempts="$1"
  shift
  local count=1
  while true; do
    if "$@"; then
      return 0
    fi
    if [ "${count}" -ge "${attempts}" ]; then
      return 1
    fi
    count=$((count + 1))
    sleep 3
  done
}

current_platform() {
  printf '%s-%s\n' "$(uname -s)" "$(uname -m)"
}

cli_platform_matches() {
  [ -f "${PLATFORM_PATH}" ] && [ "$(cat "${PLATFORM_PATH}")" = "$(current_platform)" ]
}

cli_runs() {
  [ -x "${CLI_PATH}" ] && "${CLI_PATH}" --help >/dev/null 2>&1
}

NEEDS_BUILD=0
if [ ! -x "${CLI_PATH}" ]; then
  NEEDS_BUILD=1
elif ! cli_platform_matches; then
  NEEDS_BUILD=1
elif ! cli_runs; then
  NEEDS_BUILD=1
fi

if [ "${NEEDS_BUILD}" -eq 1 ]; then
  rm -rf "${SOURCE_DIR}"
  rm -f "${CLI_PATH}" "${PLATFORM_PATH}"
  if ! retry 3 git clone --depth 1 --branch "${TAG}" https://github.com/ggml-org/whisper.cpp.git "${SOURCE_DIR}"; then
    write_blocker "Failed to clone whisper.cpp tag ${TAG}."
    exit 1
  fi
  if ! cmake -S "${SOURCE_DIR}" -B "${BUILD_DIR}" -DWHISPER_BUILD_TESTS=OFF; then
    write_blocker "Failed to configure whisper.cpp with CMake."
    exit 1
  fi
  if ! cmake --build "${BUILD_DIR}" --target whisper-cli -j "${JOBS}"; then
    write_blocker "Failed to build whisper-cli."
    exit 1
  fi
  if [ ! -x "${BUILD_DIR}/bin/whisper-cli" ]; then
    write_blocker "Build completed without ${BUILD_DIR}/bin/whisper-cli."
    exit 1
  fi
  cp "${BUILD_DIR}/bin/whisper-cli" "${CLI_PATH}"
  chmod +x "${CLI_PATH}"
  if ! cli_runs; then
    write_blocker "Built whisper-cli, but it does not execute in $(current_platform)."
    exit 1
  fi
  current_platform > "${PLATFORM_PATH}"
fi

if [ ! -s "${MODEL_PATH}" ]; then
  if ! curl --fail --location --retry 5 --retry-delay 3 --retry-connrefused "${MODEL_URL}" -o "${MODEL_PATH}.tmp"; then
    rm -f "${MODEL_PATH}.tmp"
    write_blocker "Failed to download whisper model from ${MODEL_URL}."
    exit 1
  fi
  mv "${MODEL_PATH}.tmp" "${MODEL_PATH}"
fi

printf 'whisper-cli: %s\n' "${CLI_PATH}"
printf 'model: %s\n' "${MODEL_PATH}"
