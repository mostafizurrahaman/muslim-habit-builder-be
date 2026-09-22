import { Server as HTTPServer } from 'http';
import mongoose from 'mongoose';
import app from './app';
import config from './config';
import dns from 'dns';
import seedingAdmin from './utilities/seeding';
import { startHabitReminderScheduler, stopHabitReminderScheduler } from './app/modules/Notification';
import { startAnnouncementScheduler, stopAnnouncementScheduler } from './app/modules/dashboard/announcement/announcement.scheduler';

let server: HTTPServer;
// dns.setServers(["1.1.1.1", "8.8.8.8"]);
// handle uncaught exception error
process.on('uncaughtException', (error) => {
  console.log('uncaughtException error', error);
  process.exit(1);
});

const runServer = async () => {
  await mongoose.connect(config.mongodb_url as string);
  console.log('\x1b[32mDatabase has been connected successfully\x1b[0m');

  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : config.base_url || 'localhost';

  server = app.listen(config.server_port || 5002, () => {
    console.log(`\x1b[33mServer is listening on port http://${host}:${config.server_port || 5020}\x1b[0m`);
  });

  seedingAdmin();

  // Start background schedulers
  startHabitReminderScheduler();
  startAnnouncementScheduler();
};

// handle unhandled rejection
process.on('unhandledRejection', (reason, promise) => {
  console.log(`unhandle rejection at ${promise} and reason ${reason}`);
  stopHabitReminderScheduler();
  stopAnnouncementScheduler();
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// graceful shutdown on SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received.');
  stopHabitReminderScheduler();
  stopAnnouncementScheduler();
  server.close(() => {
    console.log('Server closed.');
  });
});

runServer();

