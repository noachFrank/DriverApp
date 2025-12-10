import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import environmentConfig from './environment';

/**
 * API Configuration for DriverApp
 * 
 * URLs are automatically determined by environment (development vs production).
 * 
 * DEVELOPMENT: Update DEV_SERVER_IP in environment.js when your network changes.
 * PRODUCTION: Update PRODUCTION_URL in environment.js when you deploy.
 */

// API Configuration - URLs come from environment.js
const config = {
    // Base API URL - automatically determined by environment
    API_BASE_URL: environmentConfig.API_BASE_URL,

    // SignalR Hub URL - automatically determined by environment
    SIGNALR_HUB_URL: environmentConfig.SIGNALR_HUB_URL,

    // API Endpoints (same as DispatchApp)
    ENDPOINTS: {
        AUTH: {
            LOGIN: '/api/user/login',
            LOGOUT: '/api/user/logout',
            REFRESH: '/api/user/refresh'
        },
        RIDES: {
            GET_ALL: '/api/Ride/Open',
            GET_BY_ID: '/api/Ride/GetById',
            GET_ASSIGNED: '/api/Ride/AssignedRides',
            GET_ASSIGNED_BY_DRIVER: '/api/Ride/AssignedRidesByDriver',
            GET_IN_PROGRESS: '/api/Ride/CurrentlyBeingDriven',
            GET_FUTURE: '/api/Ride/FutureRides',
            GET_TODAY: '/api/Ride/TodaysRides',
            GET_OPEN: '/api/Ride/Open',
            UPDATE: '/api/rides',
            ASSIGN: '/api/Ride/AssignToDriver',
            CANCEL: '/api/Ride/CancelRide',
            REASSIGN: '/api/Ride/Reassign',
            PICKUP: '/api/Ride/PickUp',
            DROPOFF: '/api/Ride/DroppedOff',
            UPDATE_STATUS: '/api/Ride/UpdateStatus',
            DRIVER_HISTORY: '/api/Ride/DriverRideHistory',
            ADD_STOP: '/api/Ride/AddStop',
            UPDATE_PRICE: '/api/Ride/UpdatePrice',
            ADD_TIP: '/api/Ride/AddTip',
            ADD_WAIT_TIME: '/api/Ride/AddWaitTime'
        },
        DRIVERS: {
            GET_ALL: '/api/User/AllDrivers',
            GET_BY_ID: '/api/User/DriverById',
            GET_ACTIVE: '/api/User/ActiveDrivers',
            GET_DRIVING: '/api/User/ActiveDriversOnCall',
            CREATE: '/api/User/AddDriver',
            UPDATE: '/api/User/UpdateDriver',
            GET_DRIVER_STATUS: '/api/User/getDriverStatus',
        },
        DISPATCHERS: {
            GET_ACTIVE: '/api/User/ActiveDispatchers',
            GET_BY_ID: '/api/User/DispatcherById',
            CREATE: '/api/User/AddDispatcher',
            UPDATE: '/api/User/UpdateDispatcher',
        },
        CARS: {
            GET_BY_DRIVER: '/api/User/getCars',
            CREATE: '/api/User/AddCar',
            UPDATE: '/api/User/UpdateCar',
            SET_PRIMARY: '/api/User/SetPrimaryCar',
        },
        MESSAGES: {
            SEND_MESSAGE: '/api/Communication/AddCom',
            GET_TODAY_MESSAGES: '/api/Communication/TodaysCom',
            GET_ALL_MESSAGES: '/api/Communication/AllCom',
            MARK_READ: '/api/Communication/MarkAsRead',
            GET_UNREAD_COUNT: '/api/Communication/driverUnreadCount'
        }
    },

    // Request timeout in milliseconds
    TIMEOUT: 10000
};

// Create axios instance with default configuration
const apiClient = axios.create({
    baseURL: config.API_BASE_URL,
    timeout: config.TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

/**
 * JWT Token Management for React Native
 * 
 * KEY DIFFERENCE: All methods are now ASYNC because AsyncStorage is async.
 * 
 * In React Native, you CANNOT use localStorage - it doesn't exist.
 * AsyncStorage is the React Native equivalent.
 */
const TOKEN_KEY = 'driver_jwt_token';

// Cache the token in memory to avoid async calls on every request
let cachedToken = null;

export const tokenManager = {
    // Async method to get token from storage
    getToken: async () => {
        if (cachedToken) {
            return cachedToken;
        }
        cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
        return cachedToken;
    },

    // Sync method for interceptor (uses cached value)
    getTokenSync: () => {
        return cachedToken;
    },

    setToken: async (token) => {
        if (token) {
            cachedToken = token;
            await AsyncStorage.setItem(TOKEN_KEY, token);
        }
    },

    removeToken: async () => {
        cachedToken = null;
        await AsyncStorage.removeItem(TOKEN_KEY);
    },

    hasToken: () => {
        return !!cachedToken;
    },

    // Initialize token cache from storage (call on app start)
    initializeToken: async () => {
        cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
        return cachedToken;
    }
};

/**
 * Request interceptor - adds JWT token to all requests
 * 
 * Uses the sync token getter (cached value) to avoid async issues.
 */
apiClient.interceptors.request.use(
    (requestConfig) => {
        // Use sync method to get cached token
        const token = tokenManager.getTokenSync();
        if (token) {
            requestConfig.headers.Authorization = `Bearer ${token}`;
        }

        // Log request details in development
        if (__DEV__) {
            console.log('API Request:', {
                method: requestConfig.method?.toUpperCase(),
                url: requestConfig.url,
                hasToken: !!token,
                body: requestConfig.data,
            });
        }

        return requestConfig;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

/**
 * Response interceptor - handles errors
 * 
 * Note: Token refresh logic is simplified for React Native.
 * Instead of redirecting, we just reject and let the app handle it.
 */
apiClient.interceptors.response.use(
    (response) => {
        // Log response in development
        if (__DEV__) {
            console.log('API Response:', {
                status: response.status,
                url: response.config.url
            });
        }

        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized - token expired or invalid
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Try to refresh token
            try {
                const currentToken = tokenManager.getTokenSync();
                const response = await axios.post(
                    `${config.API_BASE_URL}${config.ENDPOINTS.AUTH.REFRESH}`,
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${currentToken}`
                        }
                    }
                );

                if (response.data?.token) {
                    await tokenManager.setToken(response.data.token);
                    originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
                    return apiClient(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed - clear token
                // Navigation to login is handled by AuthContext
                await tokenManager.removeToken();
                return Promise.reject(refreshError);
            }
        }

        // Log error details
        console.error('API Error:', {
            status: error.response?.status,
            message: error.message,
            url: error.config?.url,
            data: error.response?.data
        });

        return Promise.reject(error);
    }
);

// Export the axios instance and config
export { apiClient };
export default config;