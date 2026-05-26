FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    XDG_CACHE_HOME=/workspace/cache \
    MPLCONFIGDIR=/workspace/cache/matplotlib \
    NUMBA_CACHE_DIR=/workspace/cache/numba

RUN echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir basic-pitch==0.4.0

WORKDIR /workspace

COPY experiments/basic-pitch/run-basic-pitch.py /usr/local/bin/run-basic-pitch
RUN chmod +x /usr/local/bin/run-basic-pitch

ENTRYPOINT ["run-basic-pitch"]
