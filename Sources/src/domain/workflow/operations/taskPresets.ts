/**
 * @file taskPresets.ts
 * @brief Utility functions for creating and restoring task node presets.
 * @author Silvia Šlachtovská
 *
 * This file contains helper functions for serializing task nodes into reusable
 * preset objects, validating imported preset data, and creating new task nodes
 * from presets with freshly generated identifiers.
 */

import type { TaskNode, TaskNodePreset, IOPort } from '../model/model';
import { uid } from './workflowTree';

/**
 * @brief Builds a reusable preset object from a task node.
 *
 * The function creates a deep copy of the task configuration, parameters,
 * environment, ports, and batch settings so that the resulting preset
 * can be safely stored and reused independently of the original node.
 *
 * @param node Task node to convert into a preset.
 * @return Serialized task preset object.
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
 * @brief Checks whether an unknown value has the basic shape of a task preset.
 *
 * This function performs a lightweight runtime check used before attempting
 * to create a new task node from imported preset data.
 *
 * @param value Unknown value to validate.
 * @return True if the value appears to be a task preset.
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
 * @brief Creates a new task node instance from a preset.
 *
 * New identifiers are generated for the node, all parameters, environment variables,
 * and ports. References between ports and parameters are remapped so that the new
 * task node is fully independent of the original preset source.
 *
 * @param preset Task preset used as the source configuration.
 * @param position Initial position of the created task node.
 * @return Newly created task node based on the preset.
 */
export function createTaskNodeFromPreset(
  preset: TaskNodePreset,
  position: { x: number; y: number }
): TaskNode {
  const oldToNewParamId = new Map<string, string>();

  const newParams = preset.node.task.params.map((param) => {
    const newId = uid('param');
    oldToNewParamId.set(param.id, newId);

    return {
      ...param,
      id: newId,
      options: param.options ? [...param.options] : undefined,
    };
  });

  const newEnvVars = preset.node.task.environment.variables.map((v) => ({
    ...v,
    id: uid('env'),
  }));

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