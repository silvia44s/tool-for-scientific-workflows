/**
 * @file WorkflowCanvas.tsx
 * @brief Main canvas component responsible for rendering and managing the workflow graph.
 * @author Silvia Šlachtovská
 *
 * This component integrates ReactFlow with the application state.
 * It handles:
 *
 * - rendering nodes and edges
 * - synchronizing ReactFlow state with the workflow store
 * - drag & drop creation of nodes
 * - connecting nodes with edges
 * - cycle prevention and type compatibility checks
 * - node/edge selection
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

import { useWorkflowState } from '../state/workflowState';
import { TaskNodeView } from './nodes/TaskNode';

import type { WorkflowNode, PortDataType } from '../state/model';

import toast from 'react-hot-toast';


/**
 * Wrapper component providing ReactFlow context.
 * Required by ReactFlow when hooks like useReactFlow are used.
 */
export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}


/**
 * Inner canvas implementation.
 *
 * Handles synchronization between:
 * - ReactFlow internal state (nodes/edges)
 * - global workflow state stored in context
 */
function WorkflowCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const { project } = useReactFlow();

  const { state, dispatch } = useWorkflowState();

  /**
   * Mapping between node type identifiers and React components.
   */
  const nodeTypes: NodeTypes = useMemo(() => ({ taskNode: TaskNodeView }), []);


  // ----- 1) map store -> reactflow nodes/edges

  /**
   * Convert workflow nodes stored in the global state
   * into ReactFlow nodes.
   */
  const storeNodes: Node[] = useMemo(() => {
    return Object.values(state.workflow.nodes).map((n) => ({
      id: n.id,
      type: n.type === 'task' ? 'taskNode' : 'default',
      position: n.position,
      selected: state.selectedNodeId === n.id,
      data: {
        title: n.name,
        subtitle: n.type === 'task' ? (n.task.config.binaryPath || 'no binary') : '',
        ports: n.type === 'task' ? n.task.io : { inputs: [], outputs: [] },
      },
    }));
  }, [state.workflow.nodes]);


  /**
   * Convert workflow edges into ReactFlow edges.
   * Selected edges receive different styling.
   */
  const storeEdges: Edge[] = useMemo(() => {
    return Object.values(state.workflow.edges).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      selected: state.selectedEdgeId === e.id,
      style: {
        stroke: state.selectedEdgeId === e.id ? '#5356eae8' : '#888',
        strokeWidth: state.selectedEdgeId === e.id ? 4 : 2.5,
      },
    }));
  }, [state.workflow.edges, state.selectedEdgeId]);


  // ----- 2) ReactFlow local state (used for smooth dragging)

  /**
   * ReactFlow keeps its own internal state for nodes and edges.
   * This allows smoother drag interactions compared to updating
   * global state on every small movement.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);


  /**
   * Synchronize ReactFlow state whenever the workflow store changes.
   */
  useEffect(() => setNodes(storeNodes), [storeNodes, setNodes]);
  useEffect(() => setEdges(storeEdges), [storeEdges, setEdges]);


  // ----- 3) connecting edges (mouse interaction)

  /**
   * Called when the user connects two ports.
   *
   * Performs several checks:
   * - ports must exist
   * - port types must be compatible
   * - input port must not already have a connection
   * - connection must not introduce a cycle
   */
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (!params.sourceHandle || !params.targetHandle) return;

      const srcType = findPortType(params.source, params.sourceHandle, 'output', state.workflow.nodes);
      const dstType = findPortType(params.target, params.targetHandle, 'input', state.workflow.nodes);

      if (!srcType || !dstType) {
        toast.error('Invalid ports.')
        return;
      }

      if (!isCompatible(srcType, dstType)) {
        toast.error(`Type mismatch: ${srcType} - ${dstType}`);
        return;
      }

      const inputAlreadyConnected = edges.some(
        (e) =>
          e.target === params.target &&
          e.targetHandle === params.targetHandle
      );

      if (inputAlreadyConnected) {
        toast.error('This input port already has a connection.');
        return;
      }

      if (wouldCreateCycle(params.source, params.target, edges)) {
        toast.error('Connection would create a cycle.');
        return;
      }

      setEdges((eds) => addEdge(params, eds));

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


  // ----- 4) drag & drop node creation

  /**
   * Allows dropping new nodes from the sidebar into the canvas.
   */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);


  /**
   * Handles node drop and creates a new node in the workflow state.
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
      }
    },
    [dispatch, project]
  );


  /**
   * Find the data type of a specific port.
   */
  function findPortType(
    nodeId: string,
    handleId: string,
    direction: 'input' | 'output',
    nodes: Record<string, WorkflowNode>
  ): PortDataType | null {
    const n = nodes[nodeId];
    if (!n || n.type !== 'task') return null;

    const list = direction === 'input' ? n.task.io.inputs : n.task.io.outputs;
    const p = list.find((x) => x.id === handleId);
    return p?.dataType ?? null;
  }


  /**
   * Simple compatibility check between port types.
   * Currently only strict equality is allowed.
   */
  function isCompatible(src: PortDataType, dst: PortDataType): boolean {
    if (src === dst) return true;
    return false;
  }


  /**
   * Detect whether adding an edge would create a cycle in the graph.
   *
   * Uses DFS starting from the target node.
   */
  function wouldCreateCycle(
    source: string,
    target: string,
    edges: Edge[]
  ): boolean {

    const adj = new Map<string, string[]>();

    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }

    const stack = [target];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node === source) return true;
      if (visited.has(node)) continue;
      visited.add(node);

      const next = adj.get(node) ?? [];
      for (const n of next) stack.push(n);
    }

    return false;
  }


  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        defaultEdgeOptions={{ style: { stroke: '#888', strokeWidth: 2.5 }}}

        onNodeClick={(_, node) => {
          dispatch({ type: 'selection/set', nodeId: node.id });

          setNodes((nds) =>
            nds.map((n) => ({ ...n, selected: n.id === node.id }))
          );

          setEdges((eds) =>
            eds.map((e) => ({ ...e, selected: false }))
          );
        }}

        onEdgeClick={(_, edge) => {
          dispatch({ type: 'selection/setEdge', edgeId: edge.id });

          setEdges((eds) =>
            eds.map((e) => ({ ...e, selected: e.id === edge.id }))
          );

          setNodes((nds) =>
            nds.map((n) => ({ ...n, selected: false }))
          );
        }}

        onPaneClick={() => {
          dispatch({ type: 'selection/set', nodeId: null });
          dispatch({ type: 'selection/setEdge', edgeId: null });

          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
          setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
        }}

        onNodeDragStop={(_, node) =>
          dispatch({ type: 'node/setPosition', nodeId: node.id, position: node.position })
        }
      >

        <Background variant="dots" gap={18} size={1} />
        <MiniMap />
        <Controls showInteractive={false} />

      </ReactFlow>
    </div>
  );
}