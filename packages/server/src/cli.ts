#!/usr/bin/env node

/**
 * CLI for running the collaboration server
 */

import { config } from 'dotenv';
import { CollaborationServer } from './server.js';
import { ServerConfig } from './types/server-types.js';

// Load environment variables
config();

/**
 * Parse command line arguments
 */
function parseArgs(): {
  port: number;
  host: string;
  authRequired: boolean;
  corsOrigin: string;
  logLevel: string;
} {
  const args = process.argv.slice(2);
  const result = {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    authRequired: process.env.AUTH_REQUIRED === 'true',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    logLevel: process.env.LOG_LEVEL || 'info',
  };

  // Parse command line args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--port':
      case '-p':
        if (next && !isNaN(parseInt(next))) {
          result.port = parseInt(next);
          i++;
        }
        break;
      
      case '--host':
      case '-h':
        if (next) {
          result.host = next;
          i++;
        }
        break;
      
      case '--auth':
        result.authRequired = true;
        break;
      
      case '--cors-origin':
        if (next) {
          result.corsOrigin = next;
          i++;
        }
        break;
      
      case '--log-level':
        if (next) {
          result.logLevel = next;
          i++;
        }
        break;
      
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Real-Time Collaboration Server

Usage: rtcc-server [options]

Options:
  -p, --port <port>           Port to listen on (default: 3001)
  -h, --host <host>           Host to bind to (default: 0.0.0.0)
  --auth                      Require authentication
  --cors-origin <origin>      CORS origin (default: *)
  --log-level <level>         Log level: error, warn, info, debug (default: info)
  --help                      Show this help message

Environment Variables:
  PORT                        Server port
  HOST                        Server host
  AUTH_REQUIRED               Require authentication (true/false)
  AUTH_SECRET                 JWT secret for authentication
  CORS_ORIGIN                 CORS origin
  LOG_LEVEL                   Log level

Examples:
  rtcc-server --port 3001 --auth
  rtcc-server --port 8080 --cors-origin "https://myapp.com"
  rtcc-server --log-level debug
`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  // Create server configuration
  const config: ServerConfig = {
    port: options.port,
    host: options.host,
    cors: {
      origin: options.corsOrigin === '*' ? true : options.corsOrigin,
      credentials: true,
    },
    auth: {
      required: options.authRequired,
      secret: process.env.AUTH_SECRET,
    },
    logging: {
      level: options.logLevel as any,
    },
    persistence: {
      enabled: false, // Can be configured via env vars in the future
    },
  };

  console.log('🚀 Starting Real-Time Collaboration Server...');
  console.log(`📡 Host: ${config.host}`);
  console.log(`🔌 Port: ${config.port}`);
  console.log(`🔐 Auth: ${config.auth?.required ? 'Required' : 'Disabled'}`);
  console.log(`🌐 CORS: ${options.corsOrigin}`);
  console.log(`📝 Log Level: ${config.logging?.level}`);

  // Create and start server
  const server = new CollaborationServer(config);

  // Handle graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
    
    try {
      await server.stop();
      console.log('✅ Server stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });

  try {
    await server.start();
    console.log(`✅ Server started successfully!`);
    console.log(`🌍 WebSocket: ws://${config.host}:${config.port}/ws`);
    console.log(`🏥 Health: http://${config.host}:${config.port}/health`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');

    // Log server events
    server.on('clientConnected', (client) => {
      console.log(`👤 Client connected: ${client.clientId}`);
    });

    server.on('clientDisconnected', (client) => {
      console.log(`👋 Client disconnected: ${client.clientId}`);
    });

    server.on('documentJoined', (documentId, client) => {
      console.log(`📄 Client ${client.clientId} joined document: ${documentId}`);
    });

    server.on('operationApplied', (documentId, operation) => {
      console.log(`✏️  Operation applied to ${documentId}: ${operation.type}`);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}