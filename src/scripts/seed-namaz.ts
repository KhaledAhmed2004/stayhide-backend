import mongoose from 'mongoose';
import config from '../config';
import { seedNamaz, PRAYER_STEPS } from '../DB/seedNamaz';

export { PRAYER_STEPS };

/**
 * Testable seed runner — accepts the model as a parameter so tests can inject mocks.
 * Returns an array of stepKeys that were successfully written.
 */
export type BulkWriteModel = {
  bulkWrite: (ops: object[]) => Promise<unknown>;
};

export async function runSeed(
  steps: typeof PRAYER_STEPS,
  model: BulkWriteModel,
): Promise<string[]> {
  const succeeded: string[] = [];
  for (const step of steps) {
    const op = {
      updateOne: {
        filter: { stepKey: step.stepKey },
        update: { $set: step },
        upsert: true,
      },
    };
    try {
      await model.bulkWrite([op]);
      succeeded.push(step.stepKey);
    } catch (err) {
      // continue to next step — Requirement 1.4
    }
  }
  return succeeded;
}

async function runStandaloneSeed(): Promise<void> {
  try {
    await mongoose.connect(config.database_url as string);
    console.log('[seed-namaz] Connected to MongoDB');
    
    await seedNamaz();
    
    console.log('[seed-namaz] Seeding complete');
  } catch (err) {
    console.error('[seed-namaz] Unexpected error during seeding:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Only run when this file is executed directly (not when imported by tests)
if (require.main === module) {
  runStandaloneSeed().catch(err => {
    console.error('[seed-namaz] Unexpected error:', err);
    process.exit(1);
  });
}
