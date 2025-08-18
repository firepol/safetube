# Test Videos Directory

This directory contains sample video files used for testing the SafeTube application in CI/CD environments.

## Purpose

- Provide sample video files for integration tests
- Ensure tests can run in CI environments without external dependencies
- Test local video file handling functionality

## File Requirements

- **Format**: MP4, MKV, or WEBM files
- **Size**: Keep files small (< 1MB) for CI performance
- **Duration**: Short clips (30 seconds to 2 minutes) are sufficient
- **Content**: Use royalty-free or public domain content

## Current Sample Files

- `sample-local.mp4` - Sample local video file for testing

## Notes

- These files are used only for testing purposes
- They should not contain copyrighted content
- Files are included in source control for CI reliability
- **One test video is sufficient** - DLNA functionality is tested separately via mocking 