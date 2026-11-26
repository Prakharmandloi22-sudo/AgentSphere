import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';

const PORT = process.env.PORT || 4000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[AgentSphere Core API] Server listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[AgentSphere Core API] SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('[AgentSphere Core API] HTTP server closed gracefully');
  });
});
