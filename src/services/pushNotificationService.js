/**
 * Push Notification Service for DriverApp
 * 
 * HOW PUSH NOTIFICATIONS WORK:
 * 
 * 1. REGISTRATION:
 *    - When the app starts, we ask permission to show notifications
 *    - If granted, Expo gives us a unique "push token" for this device
 *    - We send this token to our server and store it with the driver's ID
 * 
 * 2. RECEIVING NOTIFICATIONS:
 *    - Our server sends notifications to Expo's servers with the push token
 *    - Expo forwards to Apple (APNs) or Google (FCM)
 *    - The OS delivers the notification to the device
 * 
 * 3. HANDLING TAPS:
 *    - When user taps a notification, we receive the "data" payload
 *    - The data tells us where to navigate (e.g., which call to show)
 *    - We use a callback to tell the app where to go
 * 
 * NOTIFICATION TYPES:
 * - NEW_CALL: A new ride is available
 * - CALL_AVAILABLE_AGAIN: A ride became available (was reassigned)
 * - CALL_CANCELED: Your assigned call was canceled
 * - CALL_UNASSIGNED: You were removed from a call
 * - NEW_MESSAGE: A dispatcher sent you a message
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications appear when the app is in foreground
// This ensures notifications show even when the app is open
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,    // Show the notification popup
        shouldPlaySound: true,    // Play notification sound
        shouldSetBadge: true,     // Update app badge count
    }),
});

class PushNotificationService {
    constructor() {
        this.expoPushToken = null;
        this.notificationListener = null;
        this.responseListener = null;

        // Callback for when user taps a notification
        // Set this from your main App component to handle navigation
        this.onNotificationTapped = null;

        // Callback for when a notification is received while app is open
        this.onNotificationReceived = null;
    }

    /**
     * Initialize push notifications.
     * Call this early in app startup (e.g., in App.js or AuthContext).
     * 
     * @returns {Promise<string|null>} The Expo Push Token, or null if failed
     */
    async initialize() {
        try {
            console.log('🔔 Push notification initialization started...');

            // Step 1: Check if we're on a real device (required for push notifications)
            console.log('📱 Device check:', {
                isDevice: Device.isDevice,
                modelName: Device.modelName,
                osName: Device.osName,
                osVersion: Device.osVersion
            });

            if (!Device.isDevice) {
                console.log('⚠️ Push notifications require a physical device');
                return null;
            }

            // Step 2: Check/request permission
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            console.log('🔐 Current permission status:', existingStatus);

            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                console.log('📋 Requesting push notification permissions...');
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
                console.log('📋 Permission request result:', status);
            }

            if (finalStatus !== 'granted') {
                console.log('❌ Push notification permission denied');
                return null;
            }

            console.log('✅ Push notification permission granted');

            // Step 3: Get the Expo Push Token
            console.log('🎫 Getting Expo Push Token...');

            const projectId = Constants.easConfig?.projectId
                || Constants.expoConfig?.extra?.eas?.projectId;

            console.log('📦 Project ID:', projectId || 'Using Expo Go default');

            let tokenData;
            try {
                if (projectId) {
                    tokenData = await Notifications.getExpoPushTokenAsync({
                        projectId: projectId,
                    });
                } else {
                    // For Expo Go - don't pass projectId
                    tokenData = await Notifications.getExpoPushTokenAsync();
                }
                this.expoPushToken = tokenData.data;
                console.log('✅ Expo Push Token obtained:', this.expoPushToken);
            } catch (tokenError) {
                // Known issue: expo-notifications on Android in Expo Go requires Firebase
                // This is expected and push notifications will work in production builds
                if (tokenError.message.includes('FirebaseApp')) {
                    console.log('⚠️ Firebase not configured - this is normal for Expo Go on Android');
                    console.log('📱 Push notifications will work once you build a standalone app');
                    console.log('💡 For now, you can test other features without push notifications');
                    return null; // Gracefully exit without crashing
                }
                console.error('❌ Error getting push token:', tokenError.message);
                throw tokenError;
            }

            // Step 4: Set up Android notification channel (required for Android)
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#1976d2',
                    sound: 'default',
                });
                console.log('✅ Android notification channel configured');
            }

            // Step 5: Set up notification listeners
            this._setupListeners();
            console.log('✅ Notification listeners configured');

            return this.expoPushToken;
        } catch (error) {
            console.log('⚠️ Push notifications not available:', error.message);

            // Only show full error in development if it's unexpected
            if (__DEV__ && !error.message.includes('FirebaseApp') && !error.message.includes('physical device')) {
                console.error('Full error details:', error);
            }

            return null;
        }
    }

    /**
     * Set up listeners for incoming notifications and user interactions.
     */
    _setupListeners() {
        // Listen for notifications received while app is in foreground
        this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
            console.log('📬 Notification received in foreground:', notification);

            if (this.onNotificationReceived) {
                this.onNotificationReceived(notification);
            }
        });

        // Listen for when user taps on a notification
        // This is the key handler for navigation!
        this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('👆 User tapped notification:', response);

            // Extract the data payload (contains type, rideId, etc.)
            const data = response.notification.request.content.data;

            if (this.onNotificationTapped) {
                this.onNotificationTapped(data);
            }
        });
    }

    /**
     * Get the current push token.
     * Returns cached token or null if not initialized.
     */
    getToken() {
        return this.expoPushToken;
    }

    /**
     * Check if push notifications are available and enabled.
     */
    async isEnabled() {
        const { status } = await Notifications.getPermissionsAsync();
        return status === 'granted';
    }

    /**
     * Clean up listeners when service is no longer needed.
     * Call this on logout or app unmount.
     */
    cleanup() {
        try {
            if (this.notificationListener) {
                Notifications.removeNotificationSubscription(this.notificationListener);
                this.notificationListener = null;
            }
            if (this.responseListener) {
                Notifications.removeNotificationSubscription(this.responseListener);
                this.responseListener = null;
            }
        } catch (error) {
            console.log('Note: Could not remove notification subscriptions:', error.message);
            // Clear references anyway
            this.notificationListener = null;
            this.responseListener = null;
        }
        this.expoPushToken = null;
    }

    /**
     * Set callback for when user taps a notification.
     * The callback receives the notification data payload.
     * 
     * @param {Function} callback - Function to call with notification data
     * 
     * @example
     * pushNotificationService.setNotificationTapHandler((data) => {
     *   if (data.type === 'NEW_CALL') {
     *     navigateToOpenCalls(data.rideId);
     *   }
     * });
     */
    setNotificationTapHandler(callback) {
        this.onNotificationTapped = callback;
    }

    /**
     * Set callback for when notification is received in foreground.
     * 
     * @param {Function} callback - Function to call with notification object
     */
    setNotificationReceivedHandler(callback) {
        this.onNotificationReceived = callback;
    }

    /**
     * Get the last notification response if app was opened from a notification.
     * Useful for handling the case where user opened app by tapping notification.
     */
    async getInitialNotification() {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
            return response.notification.request.content.data;
        }
        return null;
    }
}

// Export singleton instance
const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
