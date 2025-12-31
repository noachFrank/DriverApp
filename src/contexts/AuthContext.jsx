import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import signalRService from '../services/signalRService';
import pushNotificationService from '../services/pushNotificationService';
import { authAPI, pushNotificationAPI } from '../services/apiService';
import { tokenManager, setForceLogoutCallback } from '../config/apiConfig';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const appStateRef = useRef(AppState.currentState);

    // Define forceLogout function
    const forceLogout = async () => {
        console.log('🔴 Force logout triggered (token invalid/expired)');
        pushNotificationService.cleanup();
        await stopSignalR();
        await AsyncStorage.removeItem('driverAuth');
        await tokenManager.removeToken();
        setIsAuthenticated(false);
        setUser(null);
    };

    // Register forceLogout with API config on mount
    useEffect(() => {
        setForceLogoutCallback(forceLogout);
        return () => {
            setForceLogoutCallback(null);
        };
    }, []);

    useEffect(() => {
        checkExistingAuth();
    }, []);

    useEffect(() => {
        const handleAppStateChange = async (nextAppState) => {
            // App came to foreground from background/inactive
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                console.log('App came to foreground');
                if (user?.userId) {
                    await initializeSignalR(user.userId);
                }
            }

            // App is going to background - do NOT unregister
            // Heartbeat system will handle marking driver inactive after 15 min timeout
            if (nextAppState === 'background') {
                console.log('App went to background (driver stays active via heartbeat)');
            }

            appStateRef.current = nextAppState;
        };

        // Subscribe to app state changes
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Cleanup subscription on unmount
        return () => {
            subscription?.remove();
        };
    }, [user]);

    const checkExistingAuth = async () => {
        try {
            const savedAuth = await AsyncStorage.getItem('driverAuth');
            console.log('Checking for existing authentication...', savedAuth);

            if (savedAuth) {
                const authData = JSON.parse(savedAuth);
                console.log('Found existing auth:', authData.user?.userId);

                // CRITICAL: Validate JWT token exists
                if (!authData.user?.token) {
                    console.error('⚠️ Auth data exists but JWT token is missing - logging out');
                    // Clear invalid auth state
                    await AsyncStorage.removeItem('driverAuth');
                    await tokenManager.removeToken();
                    setLoading(false);
                    return;
                }

                // Restore JWT token for API requests
                await tokenManager.setToken(authData.user.token);
                console.log('JWT token restored for API requests');

                setIsAuthenticated(true);
                setUser(authData.user);

                // Reinitialize real-time services
                await initializeSignalR(authData.user.userId);

                // Reinitialize push notifications (token might have changed)
                initializePushNotifications(authData.user.userId);
            }
        } catch (error) {
            console.error('Error checking existing auth:', error);
            // Clear auth state on error
            await AsyncStorage.removeItem('driverAuth');
            await tokenManager.removeToken();
        } finally {
            setLoading(false);
        }
    };

    const initializeSignalR = async (driverId) => {
        try {
            await signalRService.initialize(String(driverId));
            console.log('✅ SignalR initialized for driver:', driverId);
        } catch (error) {
            console.warn('⚠️ SignalR initialization failed:', error.message);
            console.log('App will work in HTTP polling mode');
        }
    };

    /**
     * Initialize push notifications for a driver.
     * 
     * This does three things:
     * 1. Requests permission to send push notifications
     * 2. Gets the unique Expo Push Token for this device
     * 3. Sends the token to our server to store with the driver's ID
     * 
     * The server uses this token to send push notifications when:
     * - A new call comes in
     * - A call is canceled or reassigned
     * - A dispatcher sends a message
     */
    const initializePushNotifications = async (driverId) => {
        try {
            console.log('🔔 Initializing push notifications for driver:', driverId);

            // Get the Expo Push Token
            const pushToken = await pushNotificationService.initialize();

            if (pushToken) {
                // Send token to server
                await pushNotificationAPI.registerToken(driverId, pushToken);
                console.log('✅ Push token registered with server');
            } else {
                console.log('⚠️ No push token available (permissions denied or not a real device)');
            }
        } catch (error) {
            // Don't fail login if push notifications fail - they're optional
            console.warn('⚠️ Push notification setup failed:', error.message);
        }
    };

    const stopSignalR = async () => {
        try {
            await signalRService.stop();
            console.log('SignalR stopped');
        } catch (error) {
            console.error('Error stopping SignalR:', error);
        }
    };

    const login = async (username, password) => {
        if (!username || !password) {
            return { success: false, message: 'Please enter username and password' };
        }

        try {
            const data = await authAPI.login('driver', username, password);
            console.log('Login API response:', data);
            // Handle both new JWT response format (UserId, UserDetails) and legacy format (id)
            const userId = data.userId || data.UserId || data.id;
            const userDetails = data.userDetails || data.UserDetails || data;

            if (!userId) {
                return { success: false, message: 'Invalid credentials' };
            }

            const userData = {
                username: userDetails.userName || username,
                role: 'driver',
                userId: userId,
                name: userDetails.name || data.name,
                email: userDetails.email,
                token: data.token || data.Token,
                joinedDate: userDetails.joinedDate,
                license: userDetails.license,
                phoneNumber: userDetails.phoneNumber,
                carCount: userDetails.cars?.length || 0
            };

            setIsAuthenticated(true);
            setUser(userData);

            // Store auth data
            await AsyncStorage.setItem('driverAuth', JSON.stringify({ user: userData }));

            // CRITICAL: Store JWT token separately for API requests
            if (userData.token) {
                await tokenManager.setToken(userData.token);
                console.log('JWT token stored for API requests:', userData.token.substring(0, 20) + '...');
            } else {
                console.error('⚠️ No token in login response!');
            }

            // Initialize real-time services (token must be set first!)
            console.log('Initializing SignalR with userId:', userData.userId);
            await initializeSignalR(userData.userId);

            // Initialize push notifications (non-blocking - don't fail login if this fails)
            initializePushNotifications(userData.userId);

            return { success: true, userId: userData.userId };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: error.message || 'Login failed' };
        }
    };

    const logout = async () => {
        try {
            if (user?.userId) {
                // Unregister push token first (so we don't receive notifications after logout)
                try {
                    await pushNotificationAPI.unregisterToken(user.userId);
                    console.log('Push token unregistered');
                } catch (pushError) {
                    console.warn('Failed to unregister push token:', pushError);
                }

                try {
                    await authAPI.logout('driver', user.userId);
                } catch (apiError) {
                    console.warn('Logout API failed:', apiError);
                }
            }

            // Clean up push notification listeners
            pushNotificationService.cleanup();

            await stopSignalR();

            await AsyncStorage.removeItem('driverAuth');
            // CRITICAL: Remove JWT token
            await tokenManager.removeToken();
            console.log('JWT token removed');

            setIsAuthenticated(false);
            setUser(null);

            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);

            // Ensure cleanup even on error
            pushNotificationService.cleanup();
            await stopSignalR();
            await AsyncStorage.removeItem('driverAuth');
            // CRITICAL: Remove JWT token even on error
            await tokenManager.removeToken();
            setIsAuthenticated(false);
            setUser(null);

            return { success: true };
        }
    };

    const value = {
        isAuthenticated,
        user,
        loading,
        login,
        logout,
        signalRService,
        forceLogout // Use the function defined above
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
