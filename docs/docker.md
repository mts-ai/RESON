# Docker

The Dockerfile at the repository root uses Python 3.11, Node 20, and a prebuilt frontend.

## Build the image

```bash
docker build -t reson .
```

The image includes:

- RESON (base install)
- prebuilt frontends for `single_report`, `compare_report`, and `leaderboard_report`

`artifacts/` and `datasets/` are not copied into the image. Mount them at run time (see `.dockerignore`).

## Environment variables in the image

| Variable | Value | Purpose |
|----------|-------|---------|
| `RESON_INLINE_HTML` | `1` | Single-bundle frontend for HTML reports |
| `PYTHONUNBUFFERED` | `1` | Unbuffered Python logs |

## Example run

```bash
docker build -t reson .
docker run --rm -it -v "$PWD:/data" reson bash

# inside the container
reson --help
reson pipeline single /data/tutorials/data/candidate.json -o /data/out.html
```

Tests are not run inside the image. For a local pytest run, see [testing.md](testing.md).
