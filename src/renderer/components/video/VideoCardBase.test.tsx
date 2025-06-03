import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoCardBase } from './VideoCardBase';

describe('VideoCardBase', () => {
  const defaultProps = {
    thumbnail: 'https://example.com/thumbnail.jpg',
    title: 'Test Video',
    duration: 125, // 2:05
    resumeAt: null,
    watched: false,
    type: 'youtube' as const,
    progress: 0,
  };

  it('renders with all required props', () => {
    render(<VideoCardBase {...defaultProps} />);
    
    expect(screen.getByAltText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();
    expect(screen.getByText('youtube')).toBeInTheDocument();
  });

  it('shows resume indicator when resumeAt is provided', () => {
    render(<VideoCardBase {...defaultProps} resumeAt={60} />);
    expect(screen.getByText('Resume at 1:00')).toBeInTheDocument();
  });

  it('shows progress bar when progress is greater than 0', () => {
    render(<VideoCardBase {...defaultProps} progress={50} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('applies watched styles when watched is true', () => {
    render(<VideoCardBase {...defaultProps} watched={true} />);
    const card = screen.getByRole('img').parentElement?.parentElement;
    expect(card).toHaveClass('opacity-75');
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    render(<VideoCardBase {...defaultProps} onClick={onClick} />);
    screen.getByRole('img').parentElement?.parentElement?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('formats duration correctly for videos over an hour', () => {
    render(<VideoCardBase {...defaultProps} duration={3665} />); // 1:01:05
    expect(screen.getByText('1:01:05')).toBeInTheDocument();
  });
}); 