// This file contains only types and interfaces that can be shared between main and renderer processes
// All Node.js-specific functionality has been moved to src/main/fileUtils.ts

import { TimeLimits, UsageLog, WatchedVideo, TimeExtra } from './types';

// These are just type exports - the actual implementations are in src/main/fileUtils.ts
export type {
  TimeLimits,
  UsageLog,
  WatchedVideo,
  TimeExtra
};

// Time tracking business logic (pure functions, no Node.js dependencies)
export function calculateTimeUsedToday(usageLog: UsageLog, currentDate: string): number {
  return usageLog[currentDate] || 0;
}

export function calculateTimeRemaining(timeLimit: number, timeUsed: number): number {
  return Math.max(0, timeLimit - timeUsed);
}

export function isTimeLimitReached(timeUsed: number, timeLimit: number): boolean {
  return timeUsed >= timeLimit;
}

export function getTimeLimitForDay(timeLimits: TimeLimits, dayOfWeek: string): number {
  return (timeLimits[dayOfWeek as keyof TimeLimits] as number) || 0;
}

export function convertMinutesToSeconds(minutes: number): number {
  return minutes * 60;
}

export function convertSecondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

// Business logic for time tracking state
export interface TimeTrackingState {
  currentDate: string;
  timeUsedToday: number; // seconds
  timeLimitToday: number; // seconds (converted from minutes)
  timeRemaining: number; // seconds
  isLimitReached: boolean;
  extraTimeToday?: number; // minutes added today
}

export function calculateTimeTrackingState(
  timeLimits: TimeLimits,
  usageLog: UsageLog,
  timeExtra: TimeExtra,
  currentDate: string,
  dayOfWeek: string
): TimeTrackingState {
  const timeLimitMinutes = getTimeLimitForDay(timeLimits, dayOfWeek);
  const timeLimitSeconds = convertMinutesToSeconds(timeLimitMinutes);
  const timeUsedToday = calculateTimeUsedToday(usageLog, currentDate);
  const timeRemaining = calculateTimeRemaining(timeLimitSeconds, timeUsedToday);
  const isLimitReached = isTimeLimitReached(timeUsedToday, timeLimitSeconds);
  const extraTimeToday = timeExtra[currentDate];

  return {
    currentDate,
    timeUsedToday,
    timeLimitToday: timeLimitSeconds,
    timeRemaining,
    isLimitReached,
    extraTimeToday
  };
}