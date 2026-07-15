import { batchUploadCollection, saveDoc } from '../lib/firestoreApi';
import type { Medication } from '../types';
import {
  seedPatients,
  seedMedications,
  seedMedCategories,
  seedDrugClasses,
  seedSettings,
  seedGifts,
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

/**
 * 사용자가 수정한 엑셀에서 파싱한 약제 목록을 업로드한다 ("엑셀 반영" 버튼).
 * 계열이 새 카테고리를 참조할 수 있으므로 카테고리·계열 마스터도 함께 최신화한다.
 */
export async function uploadMedicationList(meds: Medication[]): Promise<void> {
  await Promise.all([
    batchUploadCollection('medications', meds),
    batchUploadCollection('medCategories', seedMedCategories),
    batchUploadCollection('drugClasses', seedDrugClasses),
  ]);
}

export async function uploadSettings(): Promise<void> {
  await saveDoc('settings', 'global', seedSettings as unknown as Record<string, unknown>);
}

export async function uploadGifts(): Promise<void> {
  await batchUploadCollection('gifts', seedGifts);
}

export async function uploadAll(): Promise<void> {
  await Promise.all([uploadPatients(), uploadMedications(), uploadSettings()]);
}
