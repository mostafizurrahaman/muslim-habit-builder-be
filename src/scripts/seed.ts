import { connectAndSeed } from '../seeds';

const isFreshRun = process.argv.includes('--fresh');

connectAndSeed({ fresh: isFreshRun })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
