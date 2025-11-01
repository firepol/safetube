/**
 * HTTP Admin Entry Point
 *
 * This is the entry point for the HTTP admin interface.
 * It renders the same AdminApp component used in Electron mode,
 * which automatically detects HTTP mode and uses HTTPAdminDataAccess.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from '@/renderer/components/admin/AdminApp';
import '@/renderer/index.css';

// Render the AdminApp - it will automatically detect HTTP mode
// and use HTTPAdminDataAccess for all API calls
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<AdminApp />);
