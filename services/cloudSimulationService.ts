import { CNCOutput } from '../types';

export interface CloudSimulationResponse {
  status: 'success' | 'error';
  provider: string;
  meshUrl?: string;
  message?: string;
}

export const requestCloudSimulation = async (_data: CNCOutput): Promise<CloudSimulationResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await new Promise((resolve) => setTimeout(resolve, 600));

  return {
    status: 'success',
    provider: '阿里云仿真节点（杭州）',
    meshUrl: 'https://example.com/mock-simulation.glb'
  };
};
