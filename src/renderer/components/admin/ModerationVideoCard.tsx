import React from 'react';
import { WishlistItem, WishlistStatus } from '@/shared/types';
import { VideoCardBase, VideoCardBaseProps } from '@/renderer/components/video/VideoCardBase';

interface ModerationAction {
  label: string;
  onClick: () => void;
  className: string;
}

interface ModerationVideoCardProps {
  item: WishlistItem;
  onWatch: (item: WishlistItem) => void;
  onApprove: (videoId: string) => void;
  onDeny: (item: WishlistItem) => void;
  // Selection support
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (videoId: string, selected: boolean) => void;
}

export const ModerationVideoCard: React.FC<ModerationVideoCardProps> = ({
  item,
  onWatch,
  onApprove,
  onDeny,
  isSelectable = false,
  isSelected = false,
  onSelectionChange
}) => {
  // Convert WishlistItem to VideoCardBaseProps
  const videoCardProps: VideoCardBaseProps = {
    id: item.video_id,
    title: item.title,
    thumbnail: item.thumbnail || '',
    duration: item.duration || 0,
    type: 'youtube' as const,
    isWatched: false,
    progress: 0,
    showFavoriteIcon: false,
    isInWishlist: true,
    wishlistStatus: item.status,
    onWishlistAdd: undefined,
    description: item.description || undefined,
    channelId: item.channel_id || undefined,
    channelName: item.channel_name || undefined,
    url: item.url,
    // Custom click handler for moderation
    onVideoClick: () => onWatch(item),
    // Selection support
    isSelectable,
    isSelected,
    onSelectionChange
  };

  // Get action buttons based on status
  const getActions = (): ModerationAction[] => {
    const actions: ModerationAction[] = [];

    // Watch button - available for all statuses
    actions.push({
      label: 'Watch',
      onClick: () => onWatch(item),
      className: 'bg-blue-600 hover:bg-blue-700 text-white'
    });

    if (item.status === 'pending') {
      actions.push({
        label: 'Approve',
        onClick: () => onApprove(item.video_id),
        className: 'bg-green-600 hover:bg-green-700 text-white'
      });
      actions.push({
        label: 'Deny',
        onClick: () => onDeny(item),
        className: 'bg-red-600 hover:bg-red-700 text-white'
      });
    } else {
      // For approved/denied items, show reverse action
      actions.push({
        label: item.status === 'approved' ? 'Deny' : 'Approve',
        onClick: () => item.status === 'approved' 
          ? onDeny(item) 
          : onApprove(item.video_id),
        className: item.status === 'approved' 
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-green-600 hover:bg-green-700 text-white'
      });
    }

    return actions;
  };

  const actions = getActions();

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="relative group">
      {/* Base Video Card */}
      <VideoCardBase {...videoCardProps} />
      
      {/* Status Badge */}
      <div className="absolute top-2 right-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          item.status === 'approved' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
      </div>

      {/* Action Buttons Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${action.className}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metadata Footer */}
      <div className="mt-2 text-xs text-gray-500 space-y-1">
        <div>Requested: {formatDate(item.requested_at)}</div>
        {item.reviewed_at && (
          <div>Reviewed: {formatDate(item.reviewed_at)}</div>
        )}
        {item.denial_reason && (
          <div className="text-red-600 truncate" title={item.denial_reason}>
            Reason: {item.denial_reason}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModerationVideoCard;