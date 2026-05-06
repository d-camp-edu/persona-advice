import { batchUploadCollection, saveDoc } from '../lib/firestoreApi';
import {
  seedPatients,
  seedMedications,
  seedMedCategories,
  seedDrugClasses,
  seedSettings,
} from './seed';

export async function uploadPatients(): Promise<void> {
  await batchUploadCollection('patients', seedPatients);
}

export async function uploadMedications(): Promise<void> {
  await Promise.all([
    batchUploadCollection('medications', seedMedications),
    batchUploadCollection('medCategories', seedMedCategories),
    batchUploadCollection('drugClasses', seedDrugClasses),
  ]);
}

export async function uploadSettings(): Promise<void> {
  await saveDoc('settings', 'global', seedSettings as unknown as Record<string, unknown>);
}

export async function uploadAll(): Promise<void> {
  await Promise.all([uploadPatients(), uploadMedications(), uploadSettings()]);
}
