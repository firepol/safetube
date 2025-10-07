import React, { useState } from 'react';
import { VideoCardBase, VideoCardBaseProps } from './VideoCardBase';
import { WishlistItem } from '../../../shared/types';

interface WishlistVideoCardAction {
  label: string;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
}

interface WishlistVideoCardProps extends VideoCardBaseProps {
  wishlistItem: WishlistItem;
  actions: WishlistVideoCardAction[];
  onViewReason?: (reason: string) => void;
}

export const WishlistVideoCard: React.FC<WishlistVideoCardProps> = ({
  wishlistItem,
  actions,
  onViewReason,
  ...videoProps
}) => {
  const [showReason, setShowReason] = useState(false);

  const handleViewReason = () => {
    if (wishlistItem.denial_reason) {
      if (onViewReason) {
        onViewReason(wishlistItem.denial_reason);
      } else {
        setShowReason(!showReason);
      }
    }
  };

  return (
    <div className="relative group w-full h-full">
      <VideoCardBase {...videoProps} />
      
      {/* Action Buttons Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex space-x-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                action.className || 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
          
          {/* View Reason Button for Denied Videos */}
          {wishlistItem.status === 'denied' && wishlistItem.denial_reason && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewReason();
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center"
              title="View denial reason"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why?
            </button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="absolute top-2 right-2">
        {wishlistItem.status === 'pending' && (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            Pending
          </span>
        )}
        {wishlistItem.status === 'approved' && (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            Approved
          </span>
        )}
        {wishlistItem.status === 'denied' && (
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            Denied
          </span>
        )}
      </div>

      {/* Denial Reason Tooltip/Modal */}
      {showReason && wishlistItem.denial_reason && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Why this video was denied:</h4>
              <p className="text-sm text-gray-700">{wishlistItem.denial_reason}</p>
            </div>
            <button
              onClick={() => setShowReason(false)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WishlistVideoCard;