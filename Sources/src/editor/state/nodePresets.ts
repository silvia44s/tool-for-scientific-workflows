/**
 * @file nodePresets.ts
 * @brief Utilities for creating and instantiating task node presets.
 * @author Silvia Šlachtovská
 *
 * Presets allow saving a configured task node and reusing it later.
 * A preset contains the task configuration, parameters, environment
 * and IO ports, but without fixed IDs or canvas position.
 *
 * When creating a node from a preset, new IDs are generated for all
 * internal objects (params, env vars, ports) to avoid collisions.
 */

import type { TaskNode, TaskNodePreset, IOPort } from './model';


/**
 * Generate a simple unique ID with a given prefix.
 * Used for nodes, params, environment variables and ports.
 */
function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}


/**
 * Clone a parameter while assigning a new unique ID.
 * This prevents ID conflicts when duplicating nodes.
 */
/*function cloneParamWithNewId(param: TaskParam): TaskParam {
  return {
    ...param,
    id: uid('param'),
    options: param.options ? [...param.options] : undefined,
  };
}*/


/**
 * Clone environment variable and assign new ID.
 */
/*function cloneEnvVarWithNewId(variable: EnvVar): EnvVar {
  return {
    ...variable,
    id: uid('env'),
  };
}*/


/**
 * Build mapping between original and new parameter IDs.
 * Currently unused placeholder – kept for possible future logic.
 */
/*function paramIdMapFromParams(params: TaskParam[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of params) {
    // original id mapping would be built here if needed
  }
  return map;
}*/


/**
 * Convert an existing task node into a reusable preset.
 *
 * The preset stores the configuration but keeps IDs unchanged,
 * since they will be regenerated when the preset is instantiated.
 */
export function buildTaskPreset(node: TaskNode): TaskNodePreset {
  return {
    schemaVersion: 1,
    kind: 'taskPreset',
    presetName: node.name,
    node: {
      type: 'task',
      name: node.name,
      task: {
        config: { ...node.task.config },

        params: node.task.params.map((p) => ({
          ...p,
          options: p.options ? [...p.options] : undefined,
        })),

        environment: {
          variables: node.task.environment.variables.map((v) => ({ ...v })),
          modules: [...node.task.environment.modules],
          libraries: [...node.task.environment.libraries],
        },

        io: {
          inputs: node.task.io.inputs.map((p) => ({
            ...p,
            inputBind: p.inputBind ? { ...p.inputBind } : undefined,
          })),
          outputs: node.task.io.outputs.map((p) => ({
            ...p,
            outputSource: p.outputSource ? { ...p.outputSource } : undefined,
          })),
        },

        batch: {
          ...node.task.batch,
          array: node.task.batch.array ? { ...node.task.batch.array } : undefined,
        },
      },
    },
  };
}


/**
 * Runtime type guard checking if a value is a valid TaskNodePreset.
 *
 * Used mainly when loading presets from JSON or external storage.
 */
export function isTaskNodePreset(value: unknown): value is TaskNodePreset {
  if (!value || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    v.kind === 'taskPreset' &&
    typeof v.presetName === 'string' &&
    typeof v.node === 'object' &&
    v.node !== null
  );
}


/**
 * Create a new task node instance from a preset.
 *
 * This function:
 * - generates new IDs for params, ports and env variables
 * - remaps references between ports and params
 * - assigns the node to the given canvas position
 */
export function createTaskNodeFromPreset(
  preset: TaskNodePreset,
  position: { x: number; y: number }
): TaskNode {

  /**
   * Mapping from original param IDs to newly generated ones.
   * Needed because ports may reference params.
   */
  const oldToNewParamId = new Map<string, string>();


  // clone parameters with new IDs
  const newParams = preset.node.task.params.map((param) => {
    const newId = uid('param');
    oldToNewParamId.set(param.id, newId);

    return {
      ...param,
      id: newId,
      options: param.options ? [...param.options] : undefined,
    };
  });


  // clone environment variables
  const newEnvVars = preset.node.task.environment.variables.map((v) => ({
    ...v,
    id: uid('env'),
  }));


  /**
   * Rebuild input ports and remap parameter references.
   */
  const newInputs: IOPort[] = preset.node.task.io.inputs.map((port) => {
    const mappedParamId =
      port.inputBind?.paramId ? oldToNewParamId.get(port.inputBind.paramId) : undefined;

    return {
      ...port,
      id: uid('in'),
      inputBind:
        port.inputBind && mappedParamId
          ? { ...port.inputBind, paramId: mappedParamId }
          : port.inputBind
            ? { ...port.inputBind }
            : undefined,
    };
  });


  /**
   * Rebuild output ports and remap parameter references if needed.
   */
  const newOutputs: IOPort[] = preset.node.task.io.outputs.map((port) => {
    const src = port.outputSource;

    let outputSource = src ? { ...src } : undefined;

    if (src?.kind === 'fromParam') {
      const mappedParamId = oldToNewParamId.get(src.paramId);
      if (mappedParamId) {
        outputSource = { ...src, paramId: mappedParamId };
      }
    }

    return {
      ...port,
      id: uid('out'),
      outputSource,
    };
  });


  /**
   * Final node object ready to be inserted into the workflow.
   */
  return {
    id: uid('node'),
    type: 'task',
    name: preset.node.name,
    position,
    task: {
      config: { ...preset.node.task.config },

      params: newParams,

      environment: {
        variables: newEnvVars,
        modules: [...preset.node.task.environment.modules],
        libraries: [...preset.node.task.environment.libraries],
      },

      io: {
        inputs: newInputs,
        outputs: newOutputs,
      },

      batch: {
        ...preset.node.task.batch,
        array: preset.node.task.batch.array
          ? { ...preset.node.task.batch.array }
          : undefined,
      },
    },
  };
}

const STORAGE_KEY = 'workflow-task-presets';


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
 * Saves the list of task presets to local storage.
 * @param presets 
 * 
 */
export function saveStoredTaskPresets(presets: TaskNodePreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}


/**
 * 
 * @param preset 
 * @returns 
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
 * 
 * @param presetName 
 * @returns 
 */
export function removeStoredTaskPreset(presetName: string) {
  const presets = loadStoredTaskPresets().filter(
    (p) => p.presetName !== presetName
  );

  saveStoredTaskPresets(presets);
  return presets;
}