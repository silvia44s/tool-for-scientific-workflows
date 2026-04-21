/**
 * @file PropertiesView.tsx
 * @brief Selects and renders the appropriate properties editor based on current selection.
 * @author Silvia Šlachtovská
 *
 * Depending on the selection, this component renders:
 * - workflow properties (no selection)
 * - multi-selection editor
 * - subworkflow properties
 * - task node properties
 */

import { useWorkflow } from '../../provider/useWorkflow';
import { getActiveWorkflow } from '../../../../domain/workflow/operations/workflowTree';
import { MultiSelectionView } from './properties-views/MultiSelectionView';
import { WorkflowPropertiesView } from './properties-views/WorkflowPropertiesView';
import { TaskPropertiesView } from './properties-views/TaskPropertiesView';
import { SubworkflowPropertiesView } from './properties-views/SubworkflowPropertiesView';

/**
 * @brief Renders the correct properties editor for the current selection.
 *
 * Depending on the current editor selection, this component displays:
 * - workflow properties when no node is selected,
 * - multi-selection view when multiple nodes are selected,
 * - subworkflow properties when a single subworkflow node is selected,
 * - task properties when a single task node is selected.
 *
 * @return JSX element representing the active properties panel view.
 */
export function PropertiesView() {
  const { state, dispatch } = useWorkflow();

  const activeWorkflow = getActiveWorkflow(state.workflow, state.activePath);
  const workflowBackend =
    activeWorkflow.run?.backend ?? state.workflow.run?.backend ?? 'local';

  const selectedNodes = state.selectedNodeIds
    .map((id) => activeWorkflow.nodes[id])
    .filter(Boolean);

  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const hasMultipleSelection = selectedNodes.length >= 2;

  if (hasMultipleSelection) {
    return <MultiSelectionView selectedNodes={selectedNodes} />;
  }

  if (!selectedNode) {
    return <WorkflowPropertiesView state={state} dispatch={dispatch} />;
  }

  if (selectedNode.type === 'subworkflow') {
    return <SubworkflowPropertiesView node={selectedNode} dispatch={dispatch} />;
  }

  return (
    <TaskPropertiesView
      node={selectedNode}
      activeWorkflow={activeWorkflow}
      workflowBackend={workflowBackend}
      dispatch={dispatch}
    />
  );
}