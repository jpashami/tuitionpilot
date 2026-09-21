#!/usr/bin/env bash
# Assemble the TuitionPilot demo video from slide frames, a screen capture and AI narration.
#
#   scripts/assemble-video.sh <narration-dir> <demo.mp4> [out.mp4]
#
# narration-dir holds 01.mp3 .. 10.mp3, one per segment of docs/video-production.md.
# Needs a normal ffmpeg build (brew install ffmpeg / apt install ffmpeg). The ffmpeg
# bundled with Playwright is stripped to VP8-only and will not work.

set -euo pipefail

NARR=${1:?usage: assemble-video.sh <narration-dir> <demo.mp4> [out.mp4]}
DEMO=${2:?usage: assemble-video.sh <narration-dir> <demo.mp4> [out.mp4]}
OUT=${3:-tuitionpilot-demo.mp4}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRAMES="$ROOT/docs/deck/frames"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

command -v ffmpeg >/dev/null || { echo "ffmpeg not found. brew install ffmpeg"; exit 1; }
[ -d "$FRAMES" ] || { echo "missing $FRAMES"; exit 1; }
[ -f "$DEMO" ]   || { echo "missing demo capture: $DEMO"; exit 1; }

for n in 01 02 03 04 05 06 07 08 09 10; do
  [ -f "$NARR/$n.mp3" ] || { echo "missing $NARR/$n.mp3 — see docs/video-production.md"; exit 1; }
done

# Slide segments before the demo, and the closing slide. Seconds match docs/video-script.md.
# The demo occupies 2:05-3:35 and comes from the screen capture instead of a frame.
SEGMENTS=(
  "slide-01-title.png:20"
  "slide-02-problem.png:35"
  "slide-03-value-proposition.png:20"
  "slide-04-how-it-works.png:20"
  "slide-05-architecture.png:30"
)
CLOSING="slide-12-thanks.png:15"
DEMO_WINDOW=90

echo "==> building slide segments"
i=0
: > "$WORK/parts.txt"
for spec in "${SEGMENTS[@]}"; do
  img="${spec%%:*}"; secs="${spec##*:}"
  ffmpeg -loglevel error -y -loop 1 -t "$secs" -i "$FRAMES/$img" \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -vf "scale=1920:1080" \
    "$WORK/part$i.mp4"
  echo "file '$WORK/part$i.mp4'" >> "$WORK/parts.txt"
  i=$((i+1))
done

echo "==> fitting the demo capture into the ${DEMO_WINDOW}s window"
DEMO_LEN=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$DEMO")
SPEED=$(python3 -c "print(max(1.0, $DEMO_LEN / $DEMO_WINDOW))")
printf '    capture is %.0fs; ' "$DEMO_LEN"
if [ "$(python3 -c "print(1 if $SPEED > 1.001 else 0)")" = "1" ]; then
  printf 'speeding it %.2fx to fit\n' "$SPEED"
  [ "$(python3 -c "print(1 if $SPEED > 2.0 else 0)")" = "1" ] && \
    echo "    WARNING: over 2x. Re-record a tighter capture rather than shipping this."
  ffmpeg -loglevel error -y -i "$DEMO" \
    -filter:v "setpts=PTS/$SPEED,scale=1920:1080,fps=30" -an \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "$WORK/part$i.mp4"
else
  echo "using it as is"
  ffmpeg -loglevel error -y -i "$DEMO" -t "$DEMO_WINDOW" \
    -vf "scale=1920:1080,fps=30" -an \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "$WORK/part$i.mp4"
fi
echo "file '$WORK/part$i.mp4'" >> "$WORK/parts.txt"
i=$((i+1))

img="${CLOSING%%:*}"; secs="${CLOSING##*:}"
ffmpeg -loglevel error -y -loop 1 -t "$secs" -i "$FRAMES/$img" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -vf "scale=1920:1080" \
  "$WORK/part$i.mp4"
echo "file '$WORK/part$i.mp4'" >> "$WORK/parts.txt"

echo "==> joining picture"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$WORK/parts.txt" -c copy "$WORK/picture.mp4"

echo "==> joining narration"
: > "$WORK/audio.txt"
for n in 01 02 03 04 05 06 07 08 09 10; do
  echo "file '$(cd "$(dirname "$NARR/$n.mp3")" && pwd)/$n.mp3'" >> "$WORK/audio.txt"
done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$WORK/audio.txt" \
  -c:a aac -b:a 192k "$WORK/narration.m4a"

echo "==> muxing"
ffmpeg -loglevel error -y -i "$WORK/picture.mp4" -i "$WORK/narration.m4a" \
  -map 0:v -map 1:a -c:v copy -c:a copy -shortest "$OUT"

LEN=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
printf '\ndone: %s (%.0fs)\n' "$OUT" "$LEN"
echo "Check that the status flip to \"paid\" is not in a sped-up stretch before you submit."
