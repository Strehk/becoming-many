/**
 * Purpose: Run the O(n^2) Connections topology off the render thread.
 * Context: The Mycelium module posts gathered anchors and uploads the reply.
 * Responsibility: Relay one typed request through the pure topology function.
 * Boundary: No Three.js, no chunk knowledge; staleness is judged by the module.
 */

import {
  buildConnectionTopology,
  type ConnectionTopology,
} from "./network-topology";
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
  const topology: ConnectionTopology = buildConnectionTopology(
    request.positions.subarray(0, request.nodeCount * 3),
    request.weights.subarray(0, request.nodeCount),
    {
      neighborsPerNode: request.neighborsPerNode,
      edgeCapacity: request.edgeCapacity,
    },
  );

  workerScope.postMessage(
    {
      generation: request.generation,
      edgeCount: topology.edgeCount,
      droppedEdgeCount: topology.droppedEdgeCount,
      edgePairs: topology.edgePairs,
      edgeWeights: topology.edgeWeights,
    },
    [topology.edgePairs.buffer, topology.edgeWeights.buffer],
  );
};
