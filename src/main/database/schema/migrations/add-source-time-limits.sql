-- Migration: Add daily_time_limit_minutes column to sources table
-- This enables per-source daily time limit configuration
-- Version: 1.1
-- Description: Adds support for setting and enforcing daily time limits on individual video sources

-- Add daily_time_limit_minutes column to sources table
-- NULL means no limit (unlimited), value in minutes (0-1440)
ALTER TABLE sources ADD COLUMN daily_time_limit_minutes INTEGER DEFAULT NULL;

-- Create index for efficient queries on sources with time limits
CREATE INDEX IF NOT EXISTS idx_sources_daily_time_limit ON sources(daily_time_limit_minutes);
