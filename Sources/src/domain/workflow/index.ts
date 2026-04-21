/**
 * @file index.ts
 * @brief Public API of the workflow domain layer.
 * @author Silvia Šlachtovská
 *
 * This file acts as a central export point for the workflow domain.
 * It re-exports core types, actions, reducers and utilities so that
 * other parts of the application (UI, features, export layer, etc.)
 * can access the domain logic through a single module.
 *
 * The goal is to encapsulate internal structure of the domain and
 * provide a clean and stable interface.
 */
export type * from './model/model';
export type * from './model/actions';

export { reducer } from './reducer/workflowReducer';
export type { State } from './reducer/workflowReducer';

export {
  historyReducer,
  areStatesEqualForDirtyCheck,
  shouldRecordInHistory,
} from './reducer/historyReducer';