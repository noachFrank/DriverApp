/**
 * NotificationContext.jsx
 * 
 * Manages push notification state and navigation.
 * 
 * PROBLEM:
 * When a user taps a push notification, we need to navigate to a specific screen
 * (e.g., Open Calls) and optionally highlight a specific item (e.g., a specific call).
 * But push notifications can arrive:
 * - When app is open → need to navigate immediately
 * - When app is closed → need to handle when app opens
 * - When app is in background → need to bring app to foreground and navigate
 * 
 * SOLUTION:
 * This context stores the "pending navigation" state and lets any component
 * check if there's a pending navigation request.
 * 
 * HOW IT WORKS:
 * 1. When notification is tapped, we set pendingNavigation with the target screen and data
 * 2. HomeScreen checks pendingNavigation and switches to the right tab
 * 3. OpenCallsScreen checks if there's a pending rideId and scrolls to that call
 * 4. After navigation is handled, we clear the pending state
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import pushNotificationService from '../services/pushNotificationService';

const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    // Pending navigation state
    // When set, the app should navigate to the specified screen
    // Format: { screen: 'openCalls', rideId: 123 } or { screen: 'messages' }
    const [pendingNavigation, setPendingNavigation] = useState(null);

    // Set up notification tap handler
    useEffect(() => {
        // Handler for when user taps a notification
        pushNotificationService.setNotificationTapHandler((data) => {
            console.log('📱 Notification tapped with data:', data);
            handleNotificationData(data);
        });

        // Check if app was opened from a notification (cold start)
        checkInitialNotification();

        return () => {
            // Cleanup is handled by pushNotificationService.cleanup() in AuthContext logout
        };
    }, []);

    /**
     * Check if the app was opened by tapping a notification (cold start scenario).
     * This handles the case where the app was completely closed and user tapped a notification.
     */
    const checkInitialNotification = async () => {
        try {
            const initialData = await pushNotificationService.getInitialNotification();
            if (initialData) {
                console.log('📱 App opened from notification:', initialData);
                handleNotificationData(initialData);
            }
        } catch (error) {
            console.error('Error checking initial notification:', error);
        }
    };

    /**
     * Handle notification data and set up navigation.
     * 
     * @param {Object} data - The notification data payload
     * @param {string} data.type - Notification type (NEW_CALL, NEW_MESSAGE, etc.)
     * @param {string} data.screen - Target screen to navigate to
     * @param {number} data.rideId - Optional ride ID to highlight
     */
    const handleNotificationData = (data) => {
        if (!data || !data.type) {
            console.log('No notification data to handle');
            return;
        }

        console.log(`Handling notification type: ${data.type}`);

        switch (data.type) {
            case 'NEW_CALL':
            case 'CALL_AVAILABLE_AGAIN':
                // Navigate to Open Calls and scroll to the specific call
                setPendingNavigation({
                    screen: 'openCalls',
                    rideId: data.rideId,
                    type: data.type
                });
                break;

            case 'NEW_MESSAGE':
                // Navigate to Messages screen
                setPendingNavigation({
                    screen: 'messages',
                    messageId: data.messageId,
                    type: data.type
                });
                break;

            case 'CALL_CANCELED':
            case 'CALL_UNASSIGNED':
                // Just go to home screen (call is no longer relevant)
                setPendingNavigation({
                    screen: 'home',
                    type: data.type
                });
                break;

            default:
                console.log('Unknown notification type:', data.type);
        }
    };

    /**
     * Clear the pending navigation after it has been handled.
     * Components should call this after they've navigated to the correct screen.
     */
    const clearPendingNavigation = () => {
        setPendingNavigation(null);
    };

    /**
     * Manually trigger navigation (for testing or programmatic navigation).
     */
    const navigateTo = (screen, data = {}) => {
        setPendingNavigation({
            screen,
            ...data
        });
    };

    const value = {
        pendingNavigation,
        clearPendingNavigation,
        navigateTo,
        handleNotificationData
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;
