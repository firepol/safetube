# Remotely Accessible Parent Access in SafeTube

This document outlines the approach, considerations, and best practices for adding a remotely accessible parent/admin area to SafeTube, potentially reusing existing styles and components from the current parent access page.

---

## Overview

The goal is to allow parents to access SafeTube's admin/parent area from another device on the same local network (e.g., a phone or laptop), to manage settings such as watch time, sources, etc.

---

## Approach

- **Embed a webserver** (e.g., Express) inside the Electron main process.
- The webserver listens on a configurable port (set in `.env`).
- Serve a minimal web admin UI, reusing styles/components from the existing parent access page where possible.
- Protect access with a password (as in the current implementation).

---

## Reusing Existing Components

- If the current parent access area is built with React and does not depend on Electron/Node APIs, it can be reused with minimal changes.
- If it uses Electron/Node features, refactor those parts to use HTTP API endpoints exposed by the embedded webserver.
- Maintain the same minimalistic style for consistency.

---

## SSL (HTTPS) Considerations

- **Optional for LAN:** On a trusted local network, SSL is not strictly required, but is still recommended for privacy (prevents snooping on passwords/settings).
- **Self-signed certificates** can be generated easily for local use. Browsers will show a warning, but it can be bypassed on trusted devices.
- If not using SSL, ensure the admin port is only accessible from the local network (not exposed to the internet).

---

## Best Practices for Embedded Webserver

1. **Authentication:**
   - Require a password to access the admin area.
   - Consider session timeouts or rate limiting to prevent brute-force attacks.
2. **Network Binding:**
   - Bind the server to `0.0.0.0` or the local IP to allow LAN access, but never expose to the public internet.
   - Optionally, allow configuration of allowed IPs/subnets.
3. **API Security:**
   - Only expose endpoints needed for admin features.
   - Validate and sanitize all input.
4. **Reuse UI:**
   - Use the same React components/styles for a consistent experience.
   - Decouple UI from Electron/Node APIs; use HTTP requests to interact with the backend.
5. **SSL:**
   - Use HTTPS with a self-signed certificate if possible, even on LAN.
   - Document how to generate and trust the certificate for users.
6. **Port Configuration:**
   - Allow the admin port to be set in `.env` or via settings.
7. **Logging:**
   - Log access attempts for audit and troubleshooting.

---

## Example: Enabling SSL with Express

```js
const fs = require('fs');
const https = require('https');
const express = require('express');
const app = express();

const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
};

https.createServer(options, app).listen(process.env.ADMIN_PORT || 3001, () => {
  console.log('Admin server running with SSL');
});
```

---

## Summary

- Embedding a webserver in SafeTube allows remote parent/admin access on the local network.
- Reuse existing React components/styles where possible.
- Secure the admin area with a password and (optionally) SSL.
- Follow best practices to minimize security risks and ensure a good user experience.

---

For implementation details or code examples, see the SafeTube documentation or ask a maintainer.
