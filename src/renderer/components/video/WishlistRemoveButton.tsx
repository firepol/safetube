import React from 'react';
import { cn } from '@/lib/utils';

interface WishlistRemoveButtonProps {
  onRemove: () => void;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const WishlistRemoveButton: React.FC<WishlistRemoveButtonProps> = ({
  onRemove,
  size = 'medium',
  className
}) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-10 h-10',
    large: 'w-12 h-12'
  };

  const iconSizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  return (
    <button
      onClick={onRemove}
      className={cn(
        'flex items-center justify-center rounded-full',
        'bg-red-100 hover:bg-red-200 text-red-600',
        'transition-colors duration-200',
        'border-2 border-red-300 hover:border-red-400',
        sizeClasses[size],
        className
      )}
      title="Remove from wishlist"
      aria-label="Remove from wishlist"
    >
      <svg
        className={iconSizeClasses[size]}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
};

export default WishlistRemoveButton;
