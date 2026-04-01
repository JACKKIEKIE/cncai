const demoEnv = import.meta.env as Record<string, string | undefined>;

export const isPublicDemoBuild = demoEnv.VITE_PUBLIC_DEMO === 'true';
