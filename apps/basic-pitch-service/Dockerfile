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

RUN mkdir -p "$XDG_CACHE_HOME" "$MPLCONFIGDIR" "$NUMBA_CACHE_DIR" \
    && groupadd --system --gid 10001 basicpitch \
    && useradd --system --uid 10001 --gid basicpitch --home-dir /workspace --shell /usr/sbin/nologin basicpitch \
    && chown -R basicpitch:basicpitch /workspace/cache

COPY apps/basic-pitch-service/server.py /usr/local/bin/basic-pitch-service
RUN chmod +x /usr/local/bin/basic-pitch-service \
    && chown basicpitch:basicpitch /usr/local/bin/basic-pitch-service

USER basicpitch

EXPOSE 8090

CMD ["basic-pitch-service"]
