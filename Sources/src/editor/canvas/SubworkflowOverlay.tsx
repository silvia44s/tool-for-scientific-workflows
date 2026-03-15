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

import { useWorkflowState } from '../state/workflowState';
import { getActiveWorkflow, getActiveSubworkflowNode } from '../state/workflowUtils';

import { TaskNodeView } from './nodes/TaskNode';
import { SubworkflowNodeView } from './nodes/SubWorkflowNode';

import type { WorkflowNode, PortDataType } from '../state/model';

import toast from 'react-hot-toast';
import styles from './SubworkflowOverlay.module.css';

export function SubworkflowOverlay() {
  return (
    <ReactFlowProvider>
      <SubworkflowOverlayInner />
    </ReactFlowProvider>
  );
}

function SubworkflowOverlayInner() {
  const { state, dispatch } = useWorkflowState();

  const activeWorkflow = useMemo(
    () => getActiveWorkflow(state.workflow, state.activePath),
    [state.workflow, state.activePath]
  );

  const activeNode = useMemo(() => {
    const n = getActiveSubworkflowNode(state.workflow, state.activePath);
    return n && n.type === 'subworkflow' ? n : null;
  }, [state.workflow, state.activePath]);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      task: TaskNodeView,
      subworkflow: SubworkflowNodeView,
    }),
    []
  );

  const storeNodes: Node[] = useMemo(() => {
    return Object.values(activeWorkflow.nodes).map((n) => ({
      id: n.id,
      type: n.type === 'task' ? 'task' : 'subworkflow',
      position: n.position,
      selected: state.selectedNodeIds.includes(n.id),
      data: {
        title: n.name,
        subtitle:
          n.type === 'task'
            ? (n.task.config.binaryPath || 'no binary')
            : (n.description || 'subworkflow'),
        ports:
          n.type === 'task'
            ? n.task.io
            : n.subworkflow.io,
      },
    }));
  }, [activeWorkflow.nodes, state.selectedNodeIds]);

  const storeEdges: Edge[] = useMemo(() => {
    return Object.values(activeWorkflow.edges).map((e) => ({
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
  }, [activeWorkflow.edges, state.selectedEdgeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  useEffect(() => setNodes(storeNodes), [storeNodes, setNodes]);
  useEffect(() => setEdges(storeEdges), [storeEdges, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (!params.sourceHandle || !params.targetHandle) return;

      const srcType = findPortType(
        params.source,
        params.sourceHandle,
        'output',
        activeWorkflow.nodes
      );
      const dstType = findPortType(
        params.target,
        params.targetHandle,
        'input',
        activeWorkflow.nodes
      );

      if (!srcType || !dstType) {
        toast.error('Invalid ports.');
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
              const wfNode = activeWorkflow.nodes[node.id];
              if (!wfNode || wfNode.type !== 'subworkflow') return;

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

function findPortType(
  nodeId: string,
  handleId: string,
  direction: 'input' | 'output',
  nodes: Record<string, WorkflowNode>
): PortDataType | null {
  const n = nodes[nodeId];
  if (!n) return null;

  const io = n.type === 'task' ? n.task.io : n.subworkflow.io;
  const list = direction === 'input' ? io.inputs : io.outputs;
  const p = list.find((x) => x.id === handleId);

  return p?.dataType ?? null;
}

function isCompatible(src: PortDataType, dst: PortDataType): boolean {
  return src === dst;
}

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