import { generateAlerts } from './alerts.job';

async function run() {
  try {
    await generateAlerts();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
