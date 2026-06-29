import mongoose from 'mongoose';
import { Server } from 'socket.io';
import app from './app';
import config from './config';
import { allowedOrigins } from './app/logging/corsLogger';
import { seedSuperAdmin } from './DB/seedAdmin';
import { seedLegalPages } from './DB/seedLegal';
import { socketHelper } from './helpers/socketHelper';
import { SocketManager } from './helpers/socketManager';
import { errorLogger, logger, notifyCritical } from './shared/logger';
import { CacheHelper } from './app/shared/CacheHelper';
import { AccountPurgeScheduler } from './app/modules/user/accountPurgeScheduler';
import { OrphanFileCleaner } from './shared/orphanFileCleaner';
import { PendingEmailScheduler } from './app/modules/pending-email/pending-email.scheduler';
import './app/modules/symptom-log/symptomReminderCron';
import { generateDefaultBanner } from './shared/bannerGenerator';
import { generateStartupSummary, type StartupStatus } from './shared/startupSummary';
import { createSpinner } from './shared/spinnerHelper';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

// uncaught exception — ensure server closes before exit to avoid EADDRINUSE on respawn
process.on('uncaughtException', error => {
  errorLogger.error('UncaughtException Detected', error);
  if (server && typeof server.close === 'function') {
    try {
      server.close(() => {
        // small delay so OS can release the port cleanly
        setTimeout(() => process.exit(1), 500);
      });
    } catch (e) {
      // fallback if close throws
      setTimeout(() => process.exit(1), 500);
    }
  } else {
    process.exit(1);
  }
});

let server: any;
async function main() {
  try {
    // Display banner if enabled
    if (config.banner.enabled) {
      const banner = await generateDefaultBanner(
        config.app.name,
        config.app.tagline,
        config.app.version,
        config.node_env || 'unknown',
        config.port || 5000,
        config.banner.style
      );
      // Use console.log ONLY for banner (exception to no-console-log rule)
      // Banner displays before Winston logger initialization
      // eslint-disable-next-line no-console
      console.log('\n' + banner + '\n');
    }

    // Track startup status for beautiful summary
    const startupStatus: Partial<StartupStatus> = {
      environment: config.node_env || 'unknown',
      debugMode: config.node_env === 'development',
      rateLimit: true, // Always active in this setup
      socketIO: false,
      database: { status: 'disconnected' },
      cache: { status: 'disabled' },
    };

    // Connect to database
    const dbSpinner = createSpinner({ text: 'Connecting to MongoDB...', color: 'cyan' });
    try {
      await mongoose.connect(config.database_url as string);
      dbSpinner.succeed('MongoDB connected successfully');
      startupStatus.database = {
        status: 'connected',
        message: 'MongoDB connected successfully',
      };
    } catch (dbError) {
      dbSpinner.fail('MongoDB connection failed');
      errorLogger.error('❌ MongoDB connection error:', dbError);
      throw dbError;
    }

    // Seed Super Admin after database connection is successful
    const seedSpinner = createSpinner({ text: 'Verifying system seeds...', color: 'cyan' });
    try {
      await seedSuperAdmin();
      await seedLegalPages();
      seedSpinner.succeed('System seeds ready');
    } catch (seedError) {
      seedSpinner.fail('System seeding failed');
      errorLogger.error('❌ System seeding error:', seedError);
      throw seedError;
    }

    // Initialize CacheHelper (in-memory)
    const cacheSpinner = createSpinner({ text: 'Initializing cache system...', color: 'cyan' });
    const cache = CacheHelper.getInstance();
    cacheSpinner.succeed('In-memory cache initialized');
    startupStatus.cache = {
      status: 'initialized',
      message: 'In-memory cache ready',
    };

    // Account purge scheduler — sweeps soft-deleted users past their
    // 30-day recovery window and cascade-deletes their owned content.
    const purgeSpinner = createSpinner({
      text: 'Starting account purge scheduler...',
      color: 'cyan',
    });
    try {
      AccountPurgeScheduler.start();
      purgeSpinner.succeed('Account purge scheduler running (daily 03:00 UTC)');
    } catch (purgeErr) {
      purgeSpinner.warn('Account purge scheduler failed to start');
      errorLogger.error('AccountPurgeScheduler.start() failed:', purgeErr);
      // Don't throw — server can run without the cron; soft-deleted users
      // just won't be purged until next deployment fixes the issue.
    }

    // Orphan-file cleanup — sweeps uploads/ for files no User
    // references. Runs at 03:30 UTC, right after the account purge,
    // so cascade-unlink failures get retried before being treated as
    // true orphans.
    const orphanSpinner = createSpinner({
      text: 'Starting orphan-file cleanup scheduler...',
      color: 'cyan',
    });
    try {
      OrphanFileCleaner.start();
      orphanSpinner.succeed('Orphan-file cleanup running (daily 03:30 UTC)');
    } catch (orphanErr) {
      orphanSpinner.warn('Orphan-file cleanup failed to start');
      errorLogger.error('OrphanFileCleaner.start() failed:', orphanErr);
      // Don't throw — orphan accumulation is a disk-leak concern, not
      // a correctness one.
    }

    // Pending-email worker — drains the PendingEmail queue, reclaims
    // expired leases, and pushes DEAD rows on max-attempts. Wrapped
    // in its own try/catch so a scheduler-init failure never blocks
    // server boot (mail just queues up for the next process start).
    const pendingEmailSpinner = createSpinner({
      text: 'Starting pending-email scheduler...',
      color: 'cyan',
    });
    try {
      PendingEmailScheduler.start();
      pendingEmailSpinner.succeed(
        'Pending-email scheduler running (every minute)',
      );
    } catch (peErr) {
      pendingEmailSpinner.warn('Pending-email scheduler failed to start');
      errorLogger.error('PendingEmailScheduler.start() failed:', peErr);
      // Don't throw — failed-state emails build up in the PendingEmail
      // collection and can be drained manually via the admin endpoint.
    }

    // Validate performance thresholds
    if (config.tracing?.performance?.enabled) {
      const thresholdSpinner = createSpinner({
        text: 'Validating performance thresholds...',
        color: 'cyan'
      });
      try {
        const { validateAndWarnThresholds } = await import('./app/logging/thresholdValidator');
        validateAndWarnThresholds(config.tracing.performance.thresholds);
        thresholdSpinner.succeed('Performance config validated');
      } catch (err) {
        thresholdSpinner.warn('Threshold validation skipped');
        errorLogger.error('Threshold validation failed:', err);
        // Don't throw - let server start but warn about potential issues
      }
    }

    const port = Number(config.port) || 5001;
    const host =
      config.node_env?.toLowerCase() === 'development' || 
      config.node_env?.toLowerCase() === 'clean-test'
        ? '0.0.0.0'
        : (config.ip_address && String(config.ip_address).trim()) || '0.0.0.0';

    const serverSpinner = createSpinner({
      text: `Starting HTTP server on ${host}:${port}...`,
      color: 'cyan'
    });

    // Req 14: create server reference first, then attach Socket.IO before 'listening' fires
    server = app.listen(port, host, () => {
      serverSpinner.succeed(`HTTP server listening on ${host}:${port}`);
    });

    // Req 11 + 14: initialize Socket.IO immediately after listen() returns the server
    // reference — before the 'listening' event fires — so SocketManager.getIO() is
    // callable from any code path that runs after this point.
    const socketSpinner = createSpinner({
      text: 'Initializing Socket.IO server...',
      color: 'cyan'
    });
    const io = new Server(server, {
      pingTimeout: 60000,
      cors: {
        origin: allowedOrigins,   // Req 11: use HTTP-layer allowlist, not '*'
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    socketHelper.socket(io);
    SocketManager.init(io);
    socketSpinner.succeed('Socket.IO ready for real-time connections');
    startupStatus.socketIO = true;

    // Req 14: startup summary logging goes in the 'listening' event handler
    server.on('listening', () => {
      const url = `http://${host}:${port}/`;
      serverSpinner.succeed(`Server is listening at ${url}`);

      // Store server info
      startupStatus.server = { url, host, port };

      // Add timestamp
      startupStatus.timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      // Generate and display beautiful startup summary
      const summary = generateStartupSummary(startupStatus as StartupStatus, {
        style: 'compact', // Options: 'compact', 'progress', 'minimal'
        borderStyle: config.banner.style,
        width: 63,
        colors: true,
      });

      // Use console.log ONLY for startup summary (exception to no-console-log rule)
      // This ensures the summary appears cleanly without Winston formatting
      // eslint-disable-next-line no-console
      console.log('\n' + summary + '\n');
    });

    // handle listen errors gracefully
    server.on('error', (err: any) => {
      if (err && err.code === 'EADDRINUSE') {
        errorLogger.error(`⚠️ Port in use ${host}:${port} (EADDRINUSE)`);
        // attempt a graceful retry after closing
        try {
          server.close(() => {
            setTimeout(() => {
              server = app.listen(port, host, () => {
                logger.info(`♻️ Re-listened on ${host}:${port} after EADDRINUSE`);
              });
            }, 1000);
          });
        } catch (closeErr) {
          errorLogger.error('Failed to close server after EADDRINUSE', closeErr as any);
        }
      }
    });
  } catch (error) {
    errorLogger.error('❌ Server startup failed');
    notifyCritical(
      'Server Startup Failed',
      (error as Error)?.message || 'Unknown error'
    );
    // Exit if startup fails
    process.exit(1);
  }

  //handle unhandleRejection
  process.on('unhandledRejection', error => {
    if (server) {
      server.close(() => {
        errorLogger.error('❌ UnhandledRejection Detected');
        notifyCritical(
          'Unhandled Rejection',
          (error as Error)?.message || 'Unknown error'
        );
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

main();

//SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM IS RECEIVE');
  if (server) {
    server.close();
  }
});
