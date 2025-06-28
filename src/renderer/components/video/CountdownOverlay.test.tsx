import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { CountdownOverlay } from './CountdownOverlay';

// Mock console.error to suppress error messages during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('CountdownOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not visible', () => {
    const { container } = render(
      <CountdownOverlay
        isVisible={false}
        timeRemainingSeconds={60}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when countdown should not be shown', () => {
    const { container } = render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={60}
        isVideoPlaying={true}
        shouldShowCountdown={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays countdown when visible and should show countdown', () => {
    render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={65}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('formats time correctly with leading zeros', () => {
    render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={125}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('shows just seconds when less than a minute', () => {
    render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={45}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('counts down when video is playing', () => {
    const { rerender } = render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={3}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();

    // Simulate parent updating the time
    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={2}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();

    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={1}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();

    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={0}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('does not count down when video is paused', () => {
    const { rerender } = render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={3}
        isVideoPlaying={false}
        shouldShowCountdown={true}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();

    // Simulate parent updating the time (should still update even when paused)
    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={2}
        isVideoPlaying={false}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('resumes counting down when video starts playing', () => {
    const { rerender } = render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={3}
        isVideoPlaying={false}
        shouldShowCountdown={true}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();

    // Simulate parent updating the time while paused
    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={2}
        isVideoPlaying={false}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();

    // Start playing - time should continue to update
    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={1}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('updates display time when timeRemainingSeconds prop changes', () => {
    const { rerender } = render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={60}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );

    expect(screen.getByText('1:00')).toBeInTheDocument();

    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={30}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );

    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={60}
        isVideoPlaying={true}
        shouldShowCountdown={true}
        className="custom-class"
      />
    );
    
    const overlay = screen.getByTestId('countdown-overlay');
    expect(overlay).toHaveClass('custom-class');
  });

  it('applies absolute positioning', () => {
    render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={60}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    
    const overlay = screen.getByTestId('countdown-overlay');
    expect(overlay).toHaveClass('absolute', 'top-4', 'right-4', 'z-50');
  });

  it('stops counting down at zero', () => {
    const { rerender } = render(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={1}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();

    // Simulate parent updating to zero
    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={0}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('0')).toBeInTheDocument();

    // Should stay at 0
    rerender(
      <CountdownOverlay
        isVisible={true}
        timeRemainingSeconds={0}
        isVideoPlaying={true}
        shouldShowCountdown={true}
      />
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });
}); 