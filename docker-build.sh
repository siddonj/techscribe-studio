#!/usr/bin/env bash
# Build, tag, and optionally push the TechScribe Studio container image.
#
# Usage:
#   ./docker-build.sh                            # build for local arch, load into Docker daemon
#   ./docker-build.sh --push                     # build linux/amd64 + linux/arm64, push to registry
#   ./docker-build.sh --push --tag 1.2.3         # override the image tag
#   ./docker-build.sh --push --registry docker.io --repo myorg/techscribe-studio
#
# Environment variables (override via env or .env):
#   REGISTRY           — default: ghcr.io
#   GITHUB_REPOSITORY  — default: siddonj/techscribe-studio
#   IMAGE_TAG          — default: version from package.json
set -euo pipefail

# ── Load .env if present (but don't override already-set shell vars) ──────────
if [[ -f .env ]]; then
  set -o allexport
  # shellcheck source=/dev/null
  source .env
  set +o allexport
fi

# ── Defaults ──────────────────────────────────────────────────────────────────
REGISTRY="${REGISTRY:-ghcr.io}"
REPO="${GITHUB_REPOSITORY:-siddonj/techscribe-studio}"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
TAG="${IMAGE_TAG:-${VERSION}}"
PUSH=false
MULTI_PLATFORM="linux/amd64,linux/arm64"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --push)       PUSH=true; shift ;;
    --tag)        TAG="$2"; shift 2 ;;
    --registry)   REGISTRY="$2"; shift 2 ;;
    --repo)       REPO="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

IMAGE="${REGISTRY}/${REPO}"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "------------------------------------------------------------"
echo "  Image    : ${IMAGE}:${TAG}"
echo "  Also tag : ${IMAGE}:latest"
echo "  Commit   : ${GIT_SHA}"
echo "  Push     : ${PUSH}"
echo "------------------------------------------------------------"

# ── Ensure a multi-platform buildx builder exists ─────────────────────────────
if ! docker buildx inspect multiplatform &>/dev/null; then
  echo "Creating buildx builder 'multiplatform'..."
  docker buildx create --name multiplatform --driver docker-container --bootstrap
fi
docker buildx use multiplatform

# ── Common build arguments ─────────────────────────────────────────────────────
COMMON_LABELS=(
  --label "org.opencontainers.image.created=${BUILD_DATE}"
  --label "org.opencontainers.image.version=${TAG}"
  --label "org.opencontainers.image.revision=${GIT_SHA}"
  --label "org.opencontainers.image.source=https://github.com/${REPO}"
)

if [[ "$PUSH" == "true" ]]; then
  # Multi-arch push: builds amd64 + arm64 and streams directly to the registry.
  # Registry-side layer cache keeps subsequent pushes fast.
  docker buildx build \
    --platform "${MULTI_PLATFORM}" \
    --tag "${IMAGE}:${TAG}" \
    --tag "${IMAGE}:latest" \
    --cache-from "type=registry,ref=${IMAGE}:buildcache" \
    --cache-to   "type=registry,ref=${IMAGE}:buildcache,mode=max" \
    --push \
    "${COMMON_LABELS[@]}" \
    --file Dockerfile \
    .

  echo ""
  echo "Pushed:"
  echo "  ${IMAGE}:${TAG}"
  echo "  ${IMAGE}:latest"
else
  # Local build: --load requires a single platform.
  LOCAL_ARCH=$(docker info --format '{{.Architecture}}' 2>/dev/null || uname -m)
  if [[ "$LOCAL_ARCH" == "aarch64" || "$LOCAL_ARCH" == "arm64" ]]; then
    LOCAL_PLATFORM="linux/arm64"
  else
    LOCAL_PLATFORM="linux/amd64"
  fi

  docker buildx build \
    --platform "${LOCAL_PLATFORM}" \
    --tag "${IMAGE}:${TAG}" \
    --tag "${IMAGE}:latest" \
    --load \
    "${COMMON_LABELS[@]}" \
    --file Dockerfile \
    .

  echo ""
  echo "Loaded into local Docker daemon (${LOCAL_PLATFORM}):"
  echo "  ${IMAGE}:${TAG}"
  echo "  ${IMAGE}:latest"
  echo ""
  echo "Run locally:"
  echo "  docker compose up -d"
  echo ""
  echo "Push to registry:"
  echo "  ./docker-build.sh --push"
fi
