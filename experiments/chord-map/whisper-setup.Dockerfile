FROM python:3.14-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
        ca-certificates \
        cmake \
        curl \
        g++ \
        git \
        make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY experiments/chord-map/setup-whisper-cpp.sh /usr/local/bin/setup-whisper-cpp
RUN chmod +x /usr/local/bin/setup-whisper-cpp

ENTRYPOINT ["setup-whisper-cpp"]
