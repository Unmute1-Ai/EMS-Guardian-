/**
 * Environment validation
 */

interface Config {
  geminiApiKey: string;
  appUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

const validateEnv = (): Config => {
  const geminiApiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  const appUrl = process.env.APP_URL || import.meta.env.VITE_APP_URL || window.location.origin;
  const isDevelopment = import.meta.env.DEV;
  const isProduction = import.meta.env.PROD;

  if (!geminiApiKey && isProduction) {
    throw new Error(
      'GEMINI_API_KEY is required in production. Set via environment variables or .env file.'
    );
  }

  if (!appUrl) {
    console.warn('APP_URL not set, using window.location.origin');
  }

  return {
    geminiApiKey: geminiApiKey || '',
    appUrl,
    isDevelopment,
    isProduction
  };
};

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = validateEnv();
  }
  return config;
}

export function isConfigValid(): boolean {
  try {
    getConfig();
    return true;
  } catch (_err) {
    return false;
  }
}
