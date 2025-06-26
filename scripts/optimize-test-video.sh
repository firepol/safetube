#!/bin/bash

# Script to optimize test videos for SafeTube testing
# Usage: ./optimize-test-video.sh input.mp4 output.mp4

if [ $# -ne 2 ]; then
    echo "Usage: $0 <input_file> <output_file>"
    echo "Example: $0 raw-recording.mp4 test-videos/optimized-test.mp4"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

echo "Optimizing video for testing..."
echo "Input: $INPUT_FILE"
echo "Output: $OUTPUT_FILE"

ffmpeg -i "$INPUT_FILE" \
    -c:v libx264 \
    -preset fast \
    -crf 23 \
    -c:a aac \
    -b:a 128k \
    -movflags +faststart \
    -y \
    "$OUTPUT_FILE"

echo "Optimization complete!"
echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)" 