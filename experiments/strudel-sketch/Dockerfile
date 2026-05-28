FROM node:22-alpine

WORKDIR /workspace/experiment

COPY experiments/strudel-sketch/package*.json ./
RUN npm ci --omit=dev

COPY experiments/strudel-sketch/ ./

ENTRYPOINT ["node", "src/export-strudel-midi.mjs"]
CMD ["--pattern", "patterns/default.mjs", "--output", "/workspace/output", "--bars", "8"]
