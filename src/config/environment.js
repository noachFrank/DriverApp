/**
 * Environment Configuration for DriverApp
 * 
 * This file manages different configurations for development vs production.
 * 
 * DEVELOPMENT:
 * - Uses your local computer's IP address
 * - When your network changes, update DEV_SERVER_IP below
 * - To find your IP: Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
 * 
 * PRODUCTION:
 * - Uses your hosted server domain
 * - Update PRODUCTION_URL when you deploy to Azure/cloud
 */

// ============================================================
// DEVELOPMENT SETTINGS - Update when your network changes
// ============================================================
const DEV_SERVER_IP = '192.168.1.41';
const DEV_SERVER_PORT = '5062';

// ============================================================
// PRODUCTION SETTINGS - Update when you deploy to cloud
// ============================================================
const PRODUCTION_URL = 'https://your-app-name.azurewebsites.net';

// ============================================================
// Environment Detection
// ============================================================

/**
 * Determine if we're in production mode
 * 
 * In Expo/React Native, we check:
 * 1. __DEV__ global (built-in to React Native)
 * 2. Can also use EAS build profiles in the future
 */
const isProduction = () => {
    // __DEV__ is true in development, false in production builds
    return !__DEV__;
};

// ============================================================
// Environment Configurations
// ============================================================

const environments = {
    development: {
        API_BASE_URL: `http://${DEV_SERVER_IP}:${DEV_SERVER_PORT}`,
        SIGNALR_HUB_URL: `http://${DEV_SERVER_IP}:${DEV_SERVER_PORT}/hubs/dispatch`,
        DEBUG: true,
        ENV_NAME: 'development'
    },
    production: {
        API_BASE_URL: PRODUCTION_URL,
        SIGNALR_HUB_URL: `${PRODUCTION_URL}/hubs/dispatch`,
        DEBUG: false,
        ENV_NAME: 'production'
    }
};

// ============================================================
// Export Configuration
// ============================================================

export const getEnvironmentConfig = () => {
    const env = isProduction() ? 'production' : 'development';
    console.log(`[Environment] Running in ${env} mode`);
    return environments[env];
};

// For direct import
const environmentConfig = getEnvironmentConfig();

// Export individual values for convenience
export const API_BASE_URL = environmentConfig.API_BASE_URL;
export const SIGNALR_HUB_URL = environmentConfig.SIGNALR_HUB_URL;
export const DEBUG = environmentConfig.DEBUG;
export const ENV_NAME = environmentConfig.ENV_NAME;

export default environmentConfig;
