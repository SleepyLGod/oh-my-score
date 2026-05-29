FROM node:22-alpine

WORKDIR /workspace/experiment

COPY experiments/strudel-sketch/package*.json ./
RUN npm ci --omit=dev

COPY experiments/strudel-sketch/src ./src
COPY experiments/strudel-sketch/patterns ./patterns
COPY apps/strudel-sketch-service/server.mjs ./server.mjs

EXPOSE 8091

CMD ["node", "server.mjs"]
