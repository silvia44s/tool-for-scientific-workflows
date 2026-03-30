/**
 * @file simpleTaskPreset.ts
 * @brief Minimal task preset used for performance benchmarking.
 * @author Silvia Šlachtovská
 *
 */
export const simpleTaskPreset = {
  schemaVersion: 1,
  kind: 'taskPreset',
  presetName: 'Benchmark Task',
  node: {
    type: 'task',
    name: 'Benchmark Task',
    task: {
      config: {
        binaryPath: '/bin/echo',
        workdir: '',
        argsTemplate: '',
      },
      params: [],
      environment: {
        variables: [],
        modules: [],
        libraries: [],
      },
      io: {
        inputs: [],
        outputs: [],
      },
      batch: {
        array: {
          enabled: false,
        },
      },
    },
  },
} as const;