/**
 * Purpose: Run one chunk's O(n^2) Connections topology off the render thread.
 * Context: The Mycelium module posts one chunk's nodes and uploads the reply into its slot.
 * Responsibility: Relay one typed request through the pure topology function.
 * Boundary: No Three.js, no window knowledge; staleness is judged by the module.
 */

import { buildChunkTopology, type ChunkTopology } from "./network-topology";
import type {
  ConnectionTopologyRequest,
  ConnectionTopologyResult,
} from "./topology-messages";

/**
 * The project compiles against the DOM lib, so the dedicated worker scope is
 * typed locally instead of adding the conflicting WebWorker lib.
 */
interface TopologyWorkerScope {
  onmessage: ((event: MessageEvent<ConnectionTopologyRequest>) => void) | null;
  postMessage(
    message: ConnectionTopologyResult,
    transfer: Transferable[],
  ): void;
}

const workerScope = self as unknown as TopologyWorkerScope;

workerScope.onmessage = (event) => {
  const request = event.data;
  const topology: ChunkTopology = buildChunkTopology(
    request.own,
    request.halo,
    {
      neighborsPerNode: request.neighborsPerNode,
      edgeCapacity: request.edgeCapacity,
    },
  );

  workerScope.postMessage(
    {
      buildSlotIndex: request.buildSlotIndex,
      revision: request.revision,
      edgeCount: topology.edgeCount,
      droppedEdgeCount: topology.droppedEdgeCount,
      edgeStarts: topology.edgeStarts,
      edgeEnds: topology.edgeEnds,
      edgeWeights: topology.edgeWeights,
      edgeHubClasses: topology.edgeHubClasses,
    },
    [
      topology.edgeStarts.buffer,
      topology.edgeEnds.buffer,
      topology.edgeWeights.buffer,
      topology.edgeHubClasses.buffer,
    ],
  );
};
