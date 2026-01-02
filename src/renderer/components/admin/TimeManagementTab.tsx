import React from 'react';
import { QuickTimeExtension } from './QuickTimeExtension';
import { DailyTimeLimitsForm } from './DailyTimeLimitsForm';
import { ExtensionRequestsList } from './ExtensionRequestsList';

export const TimeManagementTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <ExtensionRequestsList />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickTimeExtension />
        <DailyTimeLimitsForm />
      </div>
    </div>
  );
};
