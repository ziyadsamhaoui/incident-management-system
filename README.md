# Incident Management System — ICGLMA

Full-stack incident management for factory floor teams: **Next.js (App Router) + TypeScript + Tailwind** frontend, **Spring Boot 4 / Java 17 + PostgreSQL** backend, Flyway migrations, JWT auth, and **self-hosted multi-media attachments** (photos / video / voice clips) streamed to the server's local disk — no cloud object storage.

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | Next.js App Router, TypeScript, React, Tailwind CSS, Framer Motion, Axios |
| Backend   | Spring Boot, Spring Security (JWT), Spring Data JPA, Flyway |
| Database  | PostgreSQL 15 |
| Storage   | **Self-hosted local disk** (`app.media.storage-path`, default `/data/incident-media`) — streamed multipart uploads, Range-capable serving |
| Deployment| Railway (frontend + backend + Postgres) + Nginx (optional `X-Accel-Redirect` media delivery) |

## Quick start (dev)

```bash
# Backend (PostgreSQL on 5432, db `icglma_local`)
cd backend && ./mvnw spring-boot:run

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Environment variables

### Backend (`backend/src/main/resources/application.properties`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/icglma_local` | PostgreSQL connection |
| `JWT_SECRET` *(not env-wired yet)* | committed dev secret | change in prod |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | committed Gmail app password | password-reset emails (Track B) |
| `MEDIA_STORAGE_PATH` | `/data/incident-media` | root dir for media files — **must be outside the deployment directory** (mount a host volume in Docker, see below) |
| `MEDIA_RETENTION_DAYS` | `90` | terminal-incident media older than this is purged by the daily retention job |
| `MEDIA_SIGNING_SECRET` | *(empty → dev default, warned)* | HMAC secret for short-lived media read URLs — set in production |
| `MEDIA_READ_TOKEN_TTL_MINUTES` | `15` | validity of signed media read URLs |
| `MULTIPART_MAX_FILE_SIZE` | `30MB` | `spring.servlet.multipart.max-file-size` (per-file cap) |
| `MULTIPART_MAX_REQUEST_SIZE` | `35MB` | `spring.servlet.multipart.max-request-size` |
| `MULTIPART_LOCATION` | `${java.io.tmpdir}/icglma-media-uploads` | dedicated temp dir for multipart buffering |
| `APP_FRONTEND_URL` | `http://localhost:3000` | reset-email deep-link origin |

> **Media storage is self-hosted.** Without a writable `MEDIA_STORAGE_PATH` the app still boots; uploads answer `503` and the UI degrades gracefully. The directory must be writable by the app process user.

## Self-hosted media pipeline (local disk)

Media bytes are streamed **straight from the browser to the server's local filesystem** and **never buffered in the JVM heap** — the multipart handler persists files via `MultipartFile.transferTo(Path)`. Files live at `{app.media.storage-path}/{incidentId}/{uuid}.{ext}` (server-generated UUID names; original filenames are display-only DB columns — no path-traversal surface).

### Flow

1. **Client → backend:** `POST /api/incidents/{id}/attachments` — single `multipart/form-data` request (`file` + optional `fileType`) with upload progress.
   - Guardrails enforced server-side: incident must not be terminal (`RESOLVED`/`NON_RESOLVED` → `409`), max **5 attachments/incident**, per-type size caps (**image ≤ 5 Mo, video ≤ 25 Mo, audio ≤ 5 Mo**), MIME allow-list.
2. **Backend → disk:** `LocalFileStorageService` streams the file via `transferTo()` and a **16-byte magic-byte sniff** (JPEG/PNG/GIF/WebP/HEIC, MP4/WebM/AVI, WebM/Ogg/MP3/WAV/M4A) validates the payload before the `incident_attachments` row is persisted; spoofed payloads are deleted (`400`).
3. **Client-side preprocessing:** images are compressed first (`browser-image-compression`: long edge ≤ 1280 px, JPEG ~75 %); video capture is capped in-browser at **30 s / 720p** (MediaRecorder); voice clips at **60 s** (`audio/webm` or `audio/mp4`).

### Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/incidents/{id}/attachments` | multipart upload (streamed to disk) |
| `GET` | `/api/incidents/{id}/attachments` | list (fresh signed read URLs) |
| `GET` | `/api/incidents/{id}/attachments/{attId}?token=…` | streamed file bytes — `Accept-Ranges: bytes` for video seeking |
| `GET` | `/api/incidents/attachments/storage-status` | Admin metrics: DB `SUM(file_size_bytes)` + host disk headroom |

Access rules mirror incident scoping: `ADMIN` everything, `CHEF_ATELIER` own department, `SOUS_CHEF` own declared incidents. Media reads are authorized by a short-lived HMAC signed token (for `<img>`/`<video>` tags) or the JWT session — the storage directory is **never** exposed as a public static path.

### Host directory setup (one-time)

1. **Docker:** attach the `media-data` named volume (declared in `compose.yaml`) to the backend service at `/data/incident-media` — media must live outside the container so redeploys never wipe it.
2. **Native systemd:** create `/data/incident-media` and grant read/write to the app process user (`sudo mkdir -p /data/incident-media && sudo chown <appuser>:<appuser> /data/incident-media`).
3. **Nginx (optional, production zero-copy):** serve media via `X-Accel-Redirect` — Spring authorizes, Nginx `sendfile`s from disk with byte ranges:
   ```nginx
   location /protected-media/ {
       alias /data/incident-media/;
       internal;                      # 404 for direct external access
       add_header Accept-Ranges bytes;
   }
   ```
4. **Retention:** the daily `@Scheduled` job purges local files + rows of terminal-incident media older than `MEDIA_RETENTION_DAYS` (90).

### Railway deployment env vars

Set `MEDIA_STORAGE_PATH` on the backend service to a persistent volume path (Railway volume mounted outside the app directory), plus `MEDIA_SIGNING_SECRET` in production. Note: local disk has **no multi-region replication** — arrange host-level backups (nightly snapshots / `rsync` to an off-box target).

## Project docs

- `docs/WORKFLOW.md` — implementation workflow & conventions (incidents workspace, logs archive, auth hardening, reset flows, media pipeline).
- `docs/PROJECT_STATUS.md` — completed phases & status.
- `docs/HR_ROSTER_IMPL.md` — HR roster seeding.

## Tests

```bash
# Backend (unit/web tests; repository tests use Testcontainers → need Docker)
cd backend && ./mvnw test

# Frontend
cd frontend && npx tsc --noEmit && npm run lint
```
