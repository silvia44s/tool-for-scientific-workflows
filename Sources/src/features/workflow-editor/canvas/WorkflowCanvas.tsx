/**
 * @file WorkflowCanvas.tsx
 * @brief Main canvas component responsible for rendering and managing the workflow graph.
 * @author Silvia Šlachtovská
 *
 * This component integrates ReactFlow with the workflow editor state.
 * It is responsible for:
 * - rendering workflow nodes and edges,
 * - synchronizing ReactFlow state with the workflow store,
 * - drag-and-drop creation of nodes,
 * - creating edges between compatible ports,
 * - preventing invalid or cyclic connections,
 * - handling node and edge selection.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  addEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useWorkflow } from '../provider/useWorkflow';
import { TaskNodeView } from './nodes/task-node/TaskNode';
import { SubworkflowNodeView } from './nodes/subworkflow-node/SubworkflowNode';

import type { TaskNodePreset } from '../../../domain/workflow/model/model';
import {
  createTaskNodeFromPreset,
  isTaskNodePreset,
} from '../../../domain/workflow/operations/taskPresets';

import toast from 'react-hot-toast';
import {
  findPortType,
  isCompatible,
  wouldCreateCycle,
} from './canvasUtils';

/**
 * @brief Wraps the workflow canvas in a ReactFlow provider.
 *
 * ReactFlow hooks such as {@link useReactFlow} require this provider
 * to be present in the component tree.
 *
 * @return JSX wrapper around the inner workflow canvas.
 */
export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}

/**
 * @brief Inner workflow canvas implementation.
 *
 * This component manages synchronization between ReactFlow internal state
 * and the global workflow editor state stored in context.
 *
 * @return JSX element representing the interactive workflow canvas.
 */
function WorkflowCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const { project } = useReactFlow();

  const { state, dispatch } = useWorkflow();

  /**
   * @brief Mapping between workflow node type identifiers and ReactFlow node components.
   */
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      task: TaskNodeView,
      subworkflow: SubworkflowNodeView,
    }),
    []
  );

  /**
   * @brief Converts workflow nodes from the global store into ReactFlow nodes.
   */
  const storeNodes: Node[] = useMemo(() => {
    return Object.values(state.workflow.nodes).map((node) => ({
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
  }, [state.workflow.nodes, state.selectedNodeIds]);

  /**
   * @brief Converts workflow edges from the global store into ReactFlow edges.
   *
   * Selected edges are styled differently for visual feedback.
   */
  const storeEdges: Edge[] = useMemo(() => {
    return Object.values(state.workflow.edges).map((edge) => ({
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
  }, [state.workflow.edges, state.selectedEdgeId]);

  /**
   * @brief Local ReactFlow state used for smoother dragging and interaction.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  /**
   * @brief Synchronizes local ReactFlow node state with the workflow store.
   */
  useEffect(() => setNodes(storeNodes), [storeNodes, setNodes]);

  /**
   * @brief Synchronizes local ReactFlow edge state with the workflow store.
   */
  useEffect(() => setEdges(storeEdges), [storeEdges, setEdges]);

  /**
   * @brief Handles creation of a new connection between two ports.
   *
   * The connection is validated before being added. Validation checks include:
   * - existence of source and target ports,
   * - compatibility of port data types,
   * - whether the input port is already occupied,
   * - whether the connection would introduce a cycle.
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
        state.workflow.nodes
      );

      const targetType = findPortType(
        params.target,
        params.targetHandle,
        'input',
        state.workflow.nodes
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
    [dispatch, setEdges, state.workflow.nodes, edges]
  );

  /**
   * @brief Enables dropping draggable items onto the canvas.
   *
   * @param event Drag-over event.
   */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * @brief Handles dropping a new node or preset onto the canvas.
   *
   * Supports:
   * - creating a default task node,
   * - creating a task node from a serialized preset.
   *
   * @param event Drop event.
   */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      if (type === 'task') {
        dispatch({ type: 'node/addTask', position });
        return;
      }

      if (type === 'taskPreset') {
        const rawPreset = event.dataTransfer.getData('application/task-preset');
        if (!rawPreset) {
          toast.error('Preset data is missing.');
          return;
        }

        try {
          const parsed = JSON.parse(rawPreset) as TaskNodePreset;

          if (!isTaskNodePreset(parsed)) {
            toast.error('Invalid task preset.');
            return;
          }

          const newNode = createTaskNodeFromPreset(parsed, position);

          dispatch({
            type: 'node/addPresetNode',
            node: newNode,
          });

          toast.success(`Preset "${parsed.presetName}" added.`);
        } catch (error) {
          console.error(error);
          toast.error('Could not create node from preset.');
        }
      }
    },
    [dispatch, project]
  );

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      ref={reactFlowWrapper}
    >
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        defaultEdgeOptions={{ style: { stroke: '#888', strokeWidth: 2.5 } }}
        onNodeClick={(event, node) => {
          const multi = event.ctrlKey || event.metaKey || event.shiftKey;

          if (multi) {
            dispatch({ type: 'selection/toggleNode', nodeId: node.id });
          } else {
            dispatch({ type: 'selection/setSingleNode', nodeId: node.id });

            setNodes((currentNodes) =>
              currentNodes.map((item) => ({
                ...item,
                selected: item.id === node.id,
              }))
            );

            setEdges((currentEdges) =>
              currentEdges.map((edge) => ({ ...edge, selected: false }))
            );
          }
        }}
        onNodeDoubleClick={(_, node) => {
          const workflowNode = state.workflow.nodes[node.id];
          if (!workflowNode || workflowNode.type !== 'subworkflow') return;

          dispatch({ type: 'navigation/openSubworkflow', nodeId: node.id });
        }}
        onPaneClick={() => {
          dispatch({ type: 'selection/clearNodes' });
          dispatch({ type: 'selection/setEdge', edgeId: null });

          setNodes((currentNodes) =>
            currentNodes.map((node) => ({ ...node, selected: false }))
          );

          setEdges((currentEdges) =>
            currentEdges.map((edge) => ({ ...edge, selected: false }))
          );
        }}
        onEdgeClick={(_, edge) => {
          dispatch({ type: 'selection/setEdge', edgeId: edge.id });

          setEdges((currentEdges) =>
            currentEdges.map((item) => ({
              ...item,
              selected: item.id === edge.id,
            }))
          );

          setNodes((currentNodes) =>
            currentNodes.map((node) => ({ ...node, selected: false }))
          );
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
        <MiniMap />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}