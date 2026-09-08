import {
  type DeploymentConfig,
  parseDeploymentConfig,
} from "../../shared/deployment-config";

/**
 * Fetches the station server's /config. Vite development and preview have no
 * deployment endpoint; their fallback response yields an empty config.
 * Deployment config is an overlay, never a requirement.
 */
export async function loadDeploymentConfig(): Promise<DeploymentConfig> {
  try {
    const response = await fetch("/config");
    if (!response.ok) return {};

    return parseDeploymentConfig(await response.json());
  } catch {
    return {};
  }
}
