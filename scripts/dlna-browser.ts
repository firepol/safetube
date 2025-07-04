// @ts-nocheck
// dlna-browser.ts
//
// Script to check accessibility of specific video files on a DLNA server by making HTTP requests.
// Usage: Run with `npx ts-node scripts/dlna-browser.ts`.
// This script is for debugging and manual exploration, not for production use.
//
// It attempts to GET and HEAD video files at hardcoded paths and logs the results.
//
// For a more complete DLNA/UPnP browse, use the Bash script in scripts/explore-dlna.sh.

import { logVerbose } from "../src/shared/logging";

const http = require('http');

const server = '192.168.1.100'; // Replace with your DLNA server IP
const port = 8200;

async function browseDlnaServer() {
  logVerbose('Browsing DLNA server...');

  // Try to browse the series directory
  const options = {
    hostname: server,
    port: port,
    path: '/series/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    logVerbose('Server response:', res.statusCode);
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      logVerbose('Server content:', data);
      
      // Try to access the videos directly
      const videoPaths = [
        '/MediaItems/1472.mp4',
        '/MediaItems/1473.mkv'
      ];

      videoPaths.forEach(path => {
        const videoOptions = {
          hostname: server,
          port: port,
          path: path,
          method: 'HEAD'
        };

        const videoReq = http.request(videoOptions, (videoRes) => {
          logVerbose(`Video ${path} response:`, videoRes.statusCode);
          if (videoRes.statusCode === 200) {
            logVerbose(`Video ${path} is accessible at: http://${server}:${port}${path}`);
          }
        });

        videoReq.on('error', (error) => {
          console.error(`Error checking video ${path}:`, error);
        });

        videoReq.end();
      });
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.end();
}

// Run the browser
browseDlnaServer(); 