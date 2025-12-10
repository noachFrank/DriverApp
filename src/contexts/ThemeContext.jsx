/**
 * ThemeContext.jsx
 * 
 * Provides app-wide theme (light/dark mode) support.
 * Persists theme preference to AsyncStorage.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'driver_app_theme';

// Theme definitions
export const themes = {
    light: {
        name: 'light',
        colors: {
            // Backgrounds
            background: '#f5f5f5',
            surface: '#ffffff',
            card: '#ffffff',

            // Text
            text: '#333333',
            textSecondary: '#666666',
            textMuted: '#999999',

            // Primary colors
            primary: '#007AFF',
            primaryLight: 'rgba(0, 122, 255, 0.1)',

            // Status colors
            success: '#34C759',
            warning: '#FF9500',
            error: '#FF3B30',

            // Borders & dividers
            border: '#e0e0e0',
            divider: '#f0f0f0',

            // Tab bar
            tabBar: '#ffffff',
            tabInactive: '#999999',
            tabActive: '#007AFF',

            // Header
            header: '#007AFF',
            headerText: '#ffffff',

            // Overlay
            overlay: 'rgba(0, 0, 0, 0.5)',
        }
    },
    dark: {
        name: 'dark',
        colors: {
            // Backgrounds
            background: '#121212',
            surface: '#1E1E1E',
            card: '#2C2C2C',

            // Text
            text: '#FFFFFF',
            textSecondary: '#B0B0B0',
            textMuted: '#808080',

            // Primary colors
            primary: '#0A84FF',
            primaryLight: 'rgba(10, 132, 255, 0.2)',

            // Status colors
            success: '#30D158',
            warning: '#FF9F0A',
            error: '#FF453A',

            // Borders & dividers
            border: '#3C3C3C',
            divider: '#2C2C2C',

            // Tab bar
            tabBar: '#1C1C1E',
            tabInactive: '#808080',
            tabActive: '#0A84FF',

            // Header
            header: '#1C1C1E',
            headerText: '#FFFFFF',

            // Overlay
            overlay: 'rgba(0, 0, 0, 0.7)',
        }
    }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved theme preference on mount
    useEffect(() => {
        loadThemePreference();
    }, []);

    const loadThemePreference = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme !== null) {
                setIsDarkMode(savedTheme === 'dark');
            }
        } catch (error) {
            console.error('Error loading theme preference:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTheme = async () => {
        try {
            const newMode = !isDarkMode;
            setIsDarkMode(newMode);
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
    };

    const setTheme = async (mode) => {
        try {
            const newMode = mode === 'dark';
            setIsDarkMode(newMode);
            await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
    };

    const theme = isDarkMode ? themes.dark : themes.light;

    return (
        <ThemeContext.Provider value={{
            theme,
            isDarkMode,
            isLoading,
            toggleTheme,
            setTheme
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeContext;
