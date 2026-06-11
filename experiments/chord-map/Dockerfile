FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    XDG_CACHE_HOME=/workspace/cache \
    PIP_CACHE_DIR=/workspace/cache/pip \
    WHISPER_CPP_MODEL=/workspace/cache/whisper/ggml-base.bin

RUN python -c "import urllib.request; packages={'/tmp/libatomic1.deb':'http://deb.debian.org/debian/pool/main/g/gcc-14/libatomic1_14.2.0-19_amd64.deb','/tmp/libgomp1.deb':'http://deb.debian.org/debian/pool/main/g/gcc-14/libgomp1_14.2.0-19_amd64.deb'}; [urllib.request.urlretrieve(url, path) for path, url in packages.items()]" \
    && dpkg -i /tmp/libatomic1.deb /tmp/libgomp1.deb \
    && rm -f /tmp/libatomic1.deb /tmp/libgomp1.deb

RUN python -m pip install --upgrade pip \
    && python -m pip install essentia==2.1b6.dev1438

WORKDIR /workspace

COPY experiments/chord-map/run-chord-map.py /usr/local/bin/run-chord-map
RUN chmod +x /usr/local/bin/run-chord-map

ENTRYPOINT ["run-chord-map"]
