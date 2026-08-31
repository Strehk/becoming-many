/**
 * Purpose: Type the messages between the Mycelium module and its topology worker.
 * Context: Topology is O(n^2) and runs off the frame path in a module-owned worker.
 * Responsibility: Define the request, the result, and the narrow port seam.
 * Boundary: Topology math lives in network-topology; scheduling stays in the module.
 */

export interface ConnectionTopologyRequest {
  /** Window-state generation; stale results are discarded on receipt. */
  readonly generation: number;
  readonly nodeCount: number;
  /** Packed xyz per node; the buffer is transferred to the worker. */
  readonly positions: Float32Array;
  /** Per-node class weight from the preset; the buffer is transferred. */
  readonly weights: Float32Array;
  readonly neighborsPerNode: number;
  readonly edgeCapacity: number;
}

export interface ConnectionTopologyResult {
  readonly generation: number;
  readonly edgeCount: number;
  /** Edges removed by the capacity cap, lowest combined weight first. */
  readonly droppedEdgeCount: number;
  /** Node index pairs [a, b] per edge; the buffer is transferred back. */
  readonly edgePairs: Uint32Array;
  /** Mean endpoint weight per edge, driving cord width and brightness. */
  readonly edgeWeights: Float32Array;
}

/** Narrow seam over the module-owned worker so tests inject a fake. */
export interface TopologyPort {
  readonly postRequest: (request: ConnectionTopologyRequest) => void;
  readonly setResultHandler: (
    onResult: (result: ConnectionTopologyResult) => void,
  ) => void;
  readonly terminate: () => void;
}

/** Wrap the real module worker; created on load, terminated on unload. */
export function createTopologyWorkerPort(): TopologyPort {
  const worker = new Worker(new URL("./topology.worker.ts", import.meta.url), {
    type: "module",
  });

  return {
    postRequest: (request) =>
      worker.postMessage(request, [
        request.positions.buffer,
        request.weights.buffer,
      ]),
    setResultHandler: (onResult) => {
      worker.onmessage = (event: MessageEvent<ConnectionTopologyResult>) =>
        onResult(event.data);
    },
    terminate: () => worker.terminate(),
  };
}
