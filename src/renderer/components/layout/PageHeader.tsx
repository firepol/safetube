import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBackClick: () => void;
  backButtonText?: string;
  rightContent?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBackClick,
  backButtonText = "← Back",
  rightContent
}) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center space-x-4">
      <button
        onClick={onBackClick}
        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors"
      >
        {backButtonText}
      </button>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
    </div>
    {rightContent && (
      <div className="flex items-center">
        {rightContent}
      </div>
    )}
  </div>
);