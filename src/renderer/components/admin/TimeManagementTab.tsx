/**
 * TimeManagementTab Component
 *
 * Main tab for time management features.
 * Combines quick time extension and daily limits form.
 */

import React from 'react';
import { QuickTimeExtension } from './QuickTimeExtension';
import { DailyTimeLimitsForm } from './DailyTimeLimitsForm';

export const TimeManagementTab: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <QuickTimeExtension />
      <DailyTimeLimitsForm />
    </div>
  );
};
