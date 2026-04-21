/**
 * @file SubworkflowOverlay.tsx
 * @brief Overlay component for editing nested subworkflows inside the workflow editor.
 * @author Silvia Šlachtovská
 *
 * This component renders a modal-like overlay containing an inner ReactFlow canvas
 * for the currently active subworkflow. It supports:
 * - rendering nodes and edges of the nested workflow,
 * - editing connections inside the subworkflow,
 * - node and edge selection,
 * - navigation back to the parent workflow or root workflow.
 */

import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useWorkflow } from '../provider/useWorkflow';
import {
  getActiveWorkflow,
  getActiveSubworkflowNode,
} from '../../../domain/workflow/operations/workflowTree';

import { TaskNodeView } from './nodes/task-node/TaskNode';
import { SubworkflowNodeView } from './nodes/subworkflow-node/SubworkflowNode';

import toast from 'react-hot-toast';
import styles from './SubworkflowOverlay.module.css';
import {
  findPortType,
  isCompatible,
  wouldCreateCycle,
} from './canvasUtils';

/**
 * @brief Wraps the subworkflow overlay in a ReactFlow provider.
 *
 * @return JSX wrapper around the inner subworkflow overlay.
 */
export function SubworkflowOverlay() {
  return (
    <ReactFlowProvider>
      <SubworkflowOverlayInner />
    </ReactFlowProvider>
  );
}

/**
 * @brief Inner implementation of the subworkflow overlay.
 *
 * Displays and manages the currently opened nested workflow using ReactFlow.
 *
 * @return JSX element representing the subworkflow overlay.
 */
function SubworkflowOverlayInner() {
  const { state, dispatch } = useWorkflow();

  /**
   * @brief Currently active nested workflow.
   */
  const activeWorkflow = useMemo(
    () => getActiveWorkflow(state.workflow, state.activePath),
    [state.workflow, state.activePath]
  );

  /**
   * @brief Subworkflow node corresponding to the current navigation path.
   */
  const activeNode = useMemo(() => {
    const node = getActiveSubworkflowNode(state.workflow, state.activePath);
    return node && node.type === 'subworkflow' ? node : null;
  }, [state.workflow, state.activePath]);

  /**
   * @brief Mapping between workflow node types and ReactFlow node components.
   */
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      task: TaskNodeView,
      subworkflow: SubworkflowNodeView,
    }),
    []
  );

  /**
   * @brief Converts nested workflow nodes into ReactFlow nodes.
   */
  const storeNodes: Node[] = useMemo(() => {
    return Object.values(activeWorkflow.nodes).map((node) => ({
      id: node.id,
      type: node.type === 'task' ? 'task' : 'subworkflow',
      position: node.position,
      selected: state.selectedNodeIds.includes(node.id),
      data: {
        title: node.name,
        subtitle:
          node.type === 'task'
            ? (node.task.config.binaryPath || 'no binary')
            : (node.description || 'subworkflow'),
        ports: node.type === 'task' ? node.task.io : node.subworkflow.io,
      },
    }));
  }, [activeWorkflow.nodes, state.selectedNodeIds]);

  /**
   * @brief Converts nested workflow edges into ReactFlow edges.
   *
   * Selected edges are styled differently.
   */
  const storeEdges: Edge[] = useMemo(() => {
    return Object.values(activeWorkflow.edges).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      selected: state.selectedEdgeId === edge.id,
      style: {
        stroke: state.selectedEdgeId === edge.id ? '#5356eae8' : '#888',
        strokeWidth: state.selectedEdgeId === edge.id ? 4 : 2.5,
      },
    }));
  }, [activeWorkflow.edges, state.selectedEdgeId]);

  /**
   * @brief Local ReactFlow state used for smoother interaction.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  /**
   * @brief Synchronizes local node state with the nested workflow store.
   */
  useEffect(() => setNodes(storeNodes), [storeNodes, setNodes]);

  /**
   * @brief Synchronizes local edge state with the nested workflow store.
   */
  useEffect(() => setEdges(storeEdges), [storeEdges, setEdges]);

  /**
   * @brief Handles creation of a new connection inside the nested workflow.
   *
   * Performs validation of ports, type compatibility, input occupancy,
   * and cycle prevention before creating the edge.
   *
   * @param params ReactFlow connection parameters.
   */
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (!params.sourceHandle || !params.targetHandle) return;

      const sourceType = findPortType(
        params.source,
        params.sourceHandle,
        'output',
        activeWorkflow.nodes
      );

      const targetType = findPortType(
        params.target,
        params.targetHandle,
        'input',
        activeWorkflow.nodes
      );

      if (!sourceType || !targetType) {
        toast.error('Invalid ports.');
        return;
      }

      if (!isCompatible(sourceType, targetType)) {
        toast.error(`Type mismatch: ${sourceType} - ${targetType}`);
        return;
      }

      const inputAlreadyConnected = edges.some(
        (edge) =>
          edge.target === params.target &&
          edge.targetHandle === params.targetHandle
      );

      if (inputAlreadyConnected) {
        toast.error('This input port already has a connection.');
        return;
      }

      if (wouldCreateCycle(params.source, params.target, edges)) {
        toast.error('Connection would create a cycle.');
        return;
      }

      setEdges((currentEdges) => addEdge(params, currentEdges));

      dispatch({
        type: 'edge/add',
        edge: {
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle,
        },
      });
    },
    [dispatch, setEdges, activeWorkflow.nodes, edges]
  );

  return (
    <div className={styles.overlay}>
      <div
        className={styles.backdrop}
        onClick={() => dispatch({ type: 'navigation/goBack' })}
      />

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.title}>
              {activeNode?.name ?? 'Subworkflow'}
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => dispatch({ type: 'navigation/goBack' })}
            >
              Back
            </button>

            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => dispatch({ type: 'navigation/goToRoot' })}
            >
              Root
            </button>
          </div>
        </div>

        <div className={styles.canvasWrap}>
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            defaultEdgeOptions={{ style: { stroke: '#888', strokeWidth: 2.5 } }}
            onNodeClick={(event, node) => {
              const multi = event.ctrlKey || event.metaKey || event.shiftKey;

              if (multi) {
                dispatch({ type: 'selection/toggleNode', nodeId: node.id });
              } else {
                dispatch({ type: 'selection/setSingleNode', nodeId: node.id });
              }
            }}
            onNodeDoubleClick={(_, node) => {
              const workflowNode = activeWorkflow.nodes[node.id];
              if (!workflowNode || workflowNode.type !== 'subworkflow') return;

              dispatch({ type: 'navigation/openSubworkflow', nodeId: node.id });
            }}
            onEdgeClick={(_, edge) => {
              dispatch({ type: 'selection/setEdge', edgeId: edge.id });
            }}
            onPaneClick={() => {
              dispatch({ type: 'selection/clearNodes' });
              dispatch({ type: 'selection/setEdge', edgeId: null });
            }}
            onNodeDragStop={(_, node) =>
              dispatch({
                type: 'node/setPosition',
                nodeId: node.id,
                position: node.position,
              })
            }
          >
            <Background variant="dots" gap={18} size={1} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}