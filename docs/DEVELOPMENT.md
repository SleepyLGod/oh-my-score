# Development Checklist

Use Docker Compose for local development so Java, Maven, Node, FFmpeg, runtime
caches, and the transcription model stay isolated from the host environment.

## Before Committing

Run the checks that match the files you changed:

```bash
node --check apps/piano-player/scripts/player.js
npm --prefix packages/midi-player test
docker compose config
docker compose build frontend
docker compose run --rm backend mvn -pl pianotranscriptioncli -am -DskipTests install
docker compose build backend
```

Run CodeRabbit on the uncommitted diff before creating a commit when the CLI is
authenticated:

```bash
coderabbit auth status --agent
coderabbit review --agent -t uncommitted
```

If authentication is missing, start the agent login flow first:

```bash
coderabbit auth login --agent
```

If CodeRabbit cannot run because authentication or the service is unavailable,
state that explicitly in the commit notes or final handoff instead of treating
the review as completed.
