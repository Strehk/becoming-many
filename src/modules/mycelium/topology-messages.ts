/**
 * Purpose: Type the messages between the Mycelium module and its topology worker.
 * Context: One request per chunk, so entering ground is built without touching resident cords.
 * Responsibility: Define the per-chunk request, its result, and the narrow port seam.
 * Boundary: Topology math lives in network-topology; scheduling stays in the module.
 */

/** One chunk's nodes as flat transferable buffers. */
export interface TopologyNodeBuffers {
  readonly positions: Float32Array;
  readonly weights: Float32Array;
  readonly classIndices: Uint8Array;
  readonly nodeCount: number;
}

export interface ConnectionTopologyRequest {
  /** Edge-pool slot the result is written into. */
  readonly buildSlotIndex: number;
  /** Slot revision; a reassigned slot discards the reply it no longer wants. */
  readonly revision: number;
  readonly own: TopologyNodeBuffers;
  /** The eight neighbouring chunks' nodes, pooled; seams are drawn against them. */
  readonly halo: TopologyNodeBuffers;
  readonly neighborsPerNode: number;
  readonly edgeCapacity: number;
}

export interface ConnectionTopologyResult {
  readonly buildSlotIndex: number;
  readonly revision: number;
  readonly edgeCount: number;
  /** Edges removed by the capacity cap, lowest combined weight first. */
  readonly droppedEdgeCount: number;
  /** Packed xyz per edge endpoint; the buffers are transferred back. */
  readonly edgeStarts: Float32Array;
  readonly edgeEnds: Float32Array;
  /** Mean endpoint weight per edge, driving cord width and brightness. */
  readonly edgeWeights: Float32Array;
  /** Class index of the heavier endpoint; the cord takes its color. */
  readonly edgeHubClasses: Uint8Array;
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
        request.own.positions.buffer,
        request.own.weights.buffer,
        request.own.classIndices.buffer,
        request.halo.positions.buffer,
        request.halo.weights.buffer,
        request.halo.classIndices.buffer,
      ]),
    setResultHandler: (onResult) => {
      worker.onmessage = (event: MessageEvent<ConnectionTopologyResult>) =>
        onResult(event.data);
    },
    terminate: () => worker.terminate(),
  };
}
