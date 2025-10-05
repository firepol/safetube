import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoPreviewModal } from './VideoPreviewModal';
import { WishlistItem } from '@/shared/types';

const mockWishlistItem: WishlistItem = {
  id: 1,
  video_id: 'dQw4w9WgXcQ',
  title: 'Test Video Title',
  thumbnail: 'https://example.com/thumbnail.jpg',
  description: 'This is a test video description',
  channel_id: 'UC123456789',
  channel_name: 'Test Channel',
  duration: 180, // 3 minutes
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  status: 'pending',
  requested_at: '2024-01-15T10:30:00.000Z',
  reviewed_at: null,
  reviewed_by: null,
  denial_reason: null,
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2024-01-15T10:30:00.000Z'
};

describe('VideoPreviewModal', () => {
  it('should not render when closed', () => {
    render(
      <VideoPreviewModal
        isOpen={false}
        onClose={vi.fn()}
        video={mockWishlistItem}
      />
    );

    expect(screen.queryByText('Video Preview')).not.toBeInTheDocument();
  });

  it('should not render when video is null', () => {
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={null}
      />
    );

    expect(screen.queryByText('Video Preview')).not.toBeInTheDocument();
  });

  it('should render video preview modal when open with video', () => {
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={mockWishlistItem}
      />
    );

    expect(screen.getByText('Video Preview')).toBeInTheDocument();
    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    expect(screen.getByText('This is a test video description')).toBeInTheDocument();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
    expect(screen.getByText('3:00')).toBeInTheDocument(); // Duration formatted
  });

  it('should show approve and deny buttons for pending videos', () => {
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={mockWishlistItem}
      />
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
  });

  it('should not show approve/deny buttons for non-pending videos', () => {
    const approvedVideo = { ...mockWishlistItem, status: 'approved' as const };
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={approvedVideo}
      />
    );

    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Deny')).not.toBeInTheDocument();
    expect(screen.getByText('This video has already been approved.')).toBeInTheDocument();
  });

  it('should call onApprove when approve button is clicked', () => {
    const onApprove = vi.fn();
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={mockWishlistItem}
        onApprove={onApprove}
      />
    );

    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledWith('dQw4w9WgXcQ');
  });

  it('should call onDeny when deny button is clicked', () => {
    const onDeny = vi.fn();
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={mockWishlistItem}
        onDeny={onDeny}
      />
    );

    fireEvent.click(screen.getByText('Deny'));
    expect(onDeny).toHaveBeenCalledWith('dQw4w9WgXcQ');
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={onClose}
        video={mockWishlistItem}
      />
    );

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={onClose}
        video={mockWishlistItem}
      />
    );

    // Click the backdrop (first div with fixed positioning)
    const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should display time tracking warning message', () => {
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={mockWishlistItem}
      />
    );

    expect(screen.getByText(/This preview does not count toward your child's screen time limits/)).toBeInTheDocument();
  });

  it('should render YouTube iframe with correct video ID', () => {
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={mockWishlistItem}
      />
    );

    const iframe = screen.getByTitle('Test Video Title');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1');
  });

  it('should show error message for invalid YouTube URL', () => {
    const invalidVideo = { ...mockWishlistItem, url: 'https://invalid-url.com' };
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={invalidVideo}
      />
    );

    expect(screen.getByText('Unable to load video player')).toBeInTheDocument();
    expect(screen.getByText('Invalid YouTube URL')).toBeInTheDocument();
  });

  it('should display denial reason for denied videos', () => {
    const deniedVideo = {
      ...mockWishlistItem,
      status: 'denied' as const,
      denial_reason: 'Content not appropriate for children',
      reviewed_at: '2024-01-15T11:00:00.000Z'
    };
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={deniedVideo}
      />
    );

    expect(screen.getByText('Denial Reason:')).toBeInTheDocument();
    expect(screen.getByText('Content not appropriate for children')).toBeInTheDocument();
  });

  it('should format duration correctly', () => {
    const longVideo = { ...mockWishlistItem, duration: 3661 }; // 1h 1m 1s
    
    render(
      <VideoPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        video={longVideo}
      />
    );

    expect(screen.getByText('1:01:01')).toBeInTheDocument();
  });
});