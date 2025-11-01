/**
 * MessageBanner Component
 *
 * Displays messages (success, error, warning) from admin operations.
 * Auto-dismisses messages based on configured duration.
 */

import React, { useEffect } from 'react';
import { useAdminContext } from '@/renderer/contexts/AdminContext';

export const MessageBanner: React.FC = () => {
  const { messages, removeMessage } = useAdminContext();

  return (
    <div className="fixed top-20 left-0 right-0 z-50 px-4 py-4">
      <div className="max-w-6xl mx-auto space-y-2">
        {messages.map(message => (
          <MessageItem key={message.id} message={message} onDismiss={() => removeMessage(message.id)} />
        ))}
      </div>
    </div>
  );
};

interface MessageItemProps {
  message: { id: string; text: string; type: 'success' | 'error' | 'warning'; duration?: number };
  onDismiss: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    if (message.duration && message.duration > 0) {
      const timer = setTimeout(onDismiss, message.duration);
      return () => clearTimeout(timer);
    }
  }, [message.duration, onDismiss]);

  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
  }[message.type];

  const textColor = {
    success: 'text-green-800',
    error: 'text-red-800',
    warning: 'text-yellow-800',
  }[message.type];

  const accentColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
  }[message.type];

  return (
    <div className={`${bgColor} border-l-4 ${accentColor} rounded-lg p-4 flex items-center justify-between animate-slideIn`}>
      <p className={textColor}>{message.text}</p>
      <button
        onClick={onDismiss}
        className={`${textColor} hover:opacity-70 font-bold ml-4`}
      >
        ✕
      </button>
    </div>
  );
};
