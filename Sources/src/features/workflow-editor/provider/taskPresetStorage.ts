/**
 * @file taskPresetStorage.ts
 * @brief Provides persistence utilities for storing and managing task node presets in browser localStorage.
 * 
 * This module is responsible for loading, validating, saving, and updating
 * user-defined task presets used in the workflow editor.
 * 
 * Presets are stored under a fixed localStorage key and validated
 * using domain-level type guards to ensure data consistency.
 * 
 * @author Silvia Šlachtovská
 */

import type { TaskNodePreset } from '../../../domain/workflow/model/model';
import { isTaskNodePreset } from '../../../domain/workflow/operations/taskPresets';

/**
 * @brief Key used to store task presets in localStorage.
 */
const STORAGE_KEY = 'workflow-task-presets';

/**
 * @brief Loads stored task presets from localStorage.
 *
 * Safely reads and parses stored data. If the data is missing, invalid,
 * or does not conform to the expected structure, an empty array is returned.
 *
 * Each loaded item is validated using {@link isTaskNodePreset}.
 *
 * @return Array of valid task node presets.
 */
export function loadStoredTaskPresets(): TaskNodePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isTaskNodePreset);
  } catch {
    return [];
  }
}

/**
 * @brief Saves task presets to localStorage.
 *
 * Serializes the provided presets and overwrites the stored value.
 *
 * @param presets Array of task node presets to store.
 */
export function saveStoredTaskPresets(presets: TaskNodePreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/**
 * @brief Adds a new task preset or updates an existing one.
 *
 * If a preset with the same name already exists, it is replaced.
 * Otherwise, the preset is appended to the list.
 *
 * The updated preset list is automatically persisted.
 *
 * @param preset Task preset to add or update.
 * @return Updated list of task presets.
 */
export function addStoredTaskPreset(preset: TaskNodePreset) {
  const presets = loadStoredTaskPresets();

  const exists = presets.some((p) => p.presetName === preset.presetName);

  const updated = exists
    ? presets.map((p) => (p.presetName === preset.presetName ? preset : p))
    : [...presets, preset];

  saveStoredTaskPresets(updated);
  return updated;
}

/**
 * @brief Removes a task preset by its name.
 *
 * Filters out the preset with the given name and persists the updated list.
 *
 * @param presetName Name of the preset to remove.
 * @return Updated list of task presets.
 */
export function removeStoredTaskPreset(presetName: string) {
  const presets = loadStoredTaskPresets().filter(
    (p) => p.presetName !== presetName
  );

  saveStoredTaskPresets(presets);
  return presets;
}