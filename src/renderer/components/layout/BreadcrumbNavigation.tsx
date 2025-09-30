import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logVerbose } from '../../lib/logging';

export interface BreadcrumbItem {
  label: string;
  path?: string; // If path is provided, item is clickable
  isActive?: boolean; // Current location
}

interface BreadcrumbNavigationProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  items,
  className = ''
}) => {
  const navigate = useNavigate();

  const handleItemClick = (item: BreadcrumbItem) => {
    if (item.path && !item.isActive) {
      navigate(item.path);
    } else {
      logVerbose('[BreadcrumbNavigation] Click ignored - no path or item is active:', { path: item.path, isActive: item.isActive });
    }
  };

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-gray-400 select-none">›</span>
          )}
          {item.path && !item.isActive ? (
            <button
              onClick={() => handleItemClick(item)}
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium"
            >
              {item.label}
            </button>
          ) : (
            <span
              className={`${
                item.isActive
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-600'
              }`}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};