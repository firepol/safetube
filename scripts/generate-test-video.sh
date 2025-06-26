#!/bin/bash

# Generate a simple test video using FFmpeg
# Usage: ./generate-test-video.sh output.mp4 [duration_in_seconds]

OUTPUT_FILE="${1:-test-videos/generated-test.mp4}"
DURATION="${2:-30}"

echo "Generating test video..."
echo "Output: $OUTPUT_FILE"
echo "Duration: ${DURATION}s"

# Create a simple test pattern with audio tone
ffmpeg -f lavfi -i "testsrc=duration=${DURATION}:size=1280x720:rate=15" \
    -f lavfi -i "sine=frequency=440:duration=${DURATION}" \
    -c:v libx264 \
    -preset fast \
    -crf 23 \
    -c:a aac \
    -b:a 128k \
    -movflags +faststart \
    -y \
    "$OUTPUT_FILE"

echo "Test video generated!"
echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)" 