import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import signalRService from '../services/signalRService';
import { authAPI } from '../services/apiService';

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

                setIsAuthenticated(true);
                setUser(authData.user);

                await initializeSignalR(authData.user.userId);
            }
        } catch (error) {
            console.error('Error checking existing auth:', error);
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

            // API returns 'id' not 'userId'
            if (!data || !data.id) {
                return { success: false, message: 'Invalid credentials' };
            }

            const userData = {
                username: data.userName || username,
                role: 'driver',
                userId: data.id,
                name: data.name,
                email: data.email,
                token: data.token,
                joinedDate: data.joinedDate,
                license: data.license,
                phoneNumber: data.phoneNumber,
                carCount: data.cars?.length || 0
            };

            setIsAuthenticated(true);
            setUser(userData);

            await AsyncStorage.setItem('driverAuth', JSON.stringify({ user: userData }));

            await initializeSignalR(userData.userId);

            return { success: true, userId: userData.userId };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: error.message || 'Login failed' };
        }
    };

    const logout = async () => {
        try {
            if (user?.userId) {
                try {
                    await authAPI.logout('driver', user.userId);
                } catch (apiError) {
                    console.warn('Logout API failed:', apiError);
                }
            }

            await stopSignalR();

            await AsyncStorage.removeItem('driverAuth');
            setIsAuthenticated(false);
            setUser(null);

            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);

            await stopSignalR();
            await AsyncStorage.removeItem('driverAuth');
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
        signalRService
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
