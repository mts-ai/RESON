FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RESON_INLINE_HTML=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        libsndfile1 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml setup.py MANIFEST.in README.md ./
COPY reson ./reson
COPY tutorials ./tutorials

RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install -e .

RUN cd reson/resources/single_report \
    && npm ci \
    && npm run build \
    && cd ../compare_report \
    && npm ci \
    && npm run build \
    && cd ../leaderboard_report \
    && npm ci \
    && npm run build

WORKDIR /app

CMD ["/bin/bash"]
