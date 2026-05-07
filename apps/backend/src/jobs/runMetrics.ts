import { generateDailyMetrics } from './metrics.job';

async function run() {
  const dateArg = process.argv[2]; // Optional date YYYY-MM-DD
  try {
    await generateDailyMetrics(dateArg);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
