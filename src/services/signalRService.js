import * as signalR from '@microsoft/signalr';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { SIGNALR_HUB_URL } from '../config/environment';
import { tokenManager } from '../config/apiConfig';

class SignalRService {
    constructor() {
        this.connection = null;
        this.messageCallbacks = [];
        this.newCallCallbacks = [];
        this.callUpdateCallbacks = [];
        this.callAssignedCallbacks = [];
        this.callUnassignedCallbacks = [];
        this.callAvailableAgainCallbacks = []; // When a call becomes available again (reassigned)
        this.callAlreadyAssignedCallbacks = [];  // When driver tries to take an already-taken call
        this.callAssignmentSuccessCallbacks = []; // When this driver successfully takes a call
        this.callCanceledCallbacks = []; // When a call is canceled
        this.pickupTimeResetCallbacks = []; // When pickup time is reset by dispatcher
        this.messageMarkedAsReadCallbacks = []; // When a message is marked as read
        this.driverId = null;
        this.isRegistered = false;
        this.heartbeatInterval = null;
        this.appStateSubscription = null;
        // Location tracking
        this.locationSubscription = null;
        this.isTrackingLocation = false;
        this.lastLocationSentTime = 0;
        this.locationUpdateInterval = 5000; // 5 seconds between updates
    }

    async initialize(driverId, hubUrl = SIGNALR_HUB_URL) {
        if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
            console.log('SignalR already initialized and connected');
            return;
        }

        this.driverId = driverId;

        console.log(`🔌 SignalR: Attempting to connect to ${hubUrl}`);

        // Get JWT token for authentication
        const token = tokenManager.getTokenSync();
        console.log(`🔑 SignalR: Using JWT token: ${token ? 'Yes' : 'No'}`);

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
                skipNegotiation: true,
                transport: signalR.HttpTransportType.WebSockets,
                accessTokenFactory: () => token // Add JWT token for authentication
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // Handle incoming messages
        this.connection.on('ReceiveMessage', (message) => {
            console.log('Received message:', message);
            this.messageCallbacks.forEach(callback => callback(message));
        });

        // Handle new call notifications
        this.connection.on('NewCallAvailable', (call) => {
            console.log('New call available:', call);
            this.newCallCallbacks.forEach(callback => callback(call));
        });

        // Handle call assigned (remove from open calls)
        this.connection.on('CallAssigned', (data) => {
            console.log('Call assigned:', data);
            this.callAssignedCallbacks.forEach(callback => callback(data));
        });

        // Handle call unassigned (driver was removed from call - show alert and close active call)
        this.connection.on('CallUnassigned', (data) => {
            console.log('Call unassigned (you were removed):', data);
            this.callUnassignedCallbacks.forEach(callback => callback(data));
        });

        // Handle call available again (a call was reassigned and is now open for taking)
        this.connection.on('CallAvailableAgain', (data) => {
            console.log('Call available again:', data);
            this.callAvailableAgainCallbacks.forEach(callback => callback(data));
        });

        // Handle when driver tries to take a call that's already assigned
        this.connection.on('CallAlreadyAssigned', (data) => {
            console.log('Call already assigned:', data);
            this.callAlreadyAssignedCallbacks.forEach(callback => callback(data));
        });

        // Handle when this driver successfully gets assigned to a call
        this.connection.on('CallAssignmentSuccess', (data) => {
            console.log('Call assignment success:', data);
            this.callAssignmentSuccessCallbacks.forEach(callback => callback(data));
        });

        // Handle when a call is canceled
        this.connection.on('CallCanceled', (data) => {
            console.log('Call canceled:', data);
            this.callCanceledCallbacks.forEach(callback => callback(data));
        });

        // Handle when pickup time is reset
        this.connection.on('PickupTimeReset', (data) => {
            console.log('Pickup time reset:', data);
            this.pickupTimeResetCallbacks.forEach(callback => callback(data));
        });

        // Handle call updates
        this.connection.on('CallUpdated', (update) => {
            console.log('Call updated:', update);
            this.callUpdateCallbacks.forEach(callback => callback(update));
        });

        // Handle message marked as read notification
        this.connection.on('MessageMarkedAsRead', (data) => {
            console.log('Message marked as read:', data);
            this.messageMarkedAsReadCallbacks.forEach(callback => callback(data));
        });

        // Handle reconnection
        this.connection.onreconnecting((error) => {
            console.warn('SignalR reconnecting...');
            this.isRegistered = false;
        });

        this.connection.onreconnected(async (connectionId) => {
            console.log('SignalR reconnected');
            // Re-register driver after reconnection
            if (this.driverId && !this.isRegistered) {
                await this.registerDriver(this.driverId);
            }
        });

        this.connection.onclose((error) => {
            console.warn('SignalR connection closed');
            this.connection = null;
            this.isRegistered = false;
        });

        try {
            await this.connection.start();
            console.log('✅ SignalR Connected - Real-time updates enabled');

            // Register this driver automatically
            if (this.driverId) {
                await this.registerDriver(this.driverId);
            }

            // Start heartbeat to keep driver marked as active
            this.startHeartbeat();

            // Listen to app state changes
            this.setupAppStateListener();
        } catch (err) {
            console.warn('⚠️  SignalR not available - using HTTP polling fallback');
            console.error('SignalR connection error:', err);
            this.connection = null;
        }
    }

    /**
     * Start sending heartbeats every 30 seconds to keep driver active
     */
    startHeartbeat() {
        // Clear any existing interval
        this.stopHeartbeat();

        // Send heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(async () => {
            await this.sendHeartbeat();
        }, 30000);

        // Send initial heartbeat immediately
        this.sendHeartbeat();

        console.log('💓 Heartbeat started');
    }

    /**
     * Stop sending heartbeats
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💔 Heartbeat stopped');
        }
    }

    /**
     * Send a heartbeat to the server
     */
    async sendHeartbeat() {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            return;
        }

        if (!this.driverId) {
            return;
        }

        try {
            await this.connection.invoke('DriverHeartbeat', this.driverId);
            console.log('💓 Heartbeat sent');
        } catch (err) {
            console.warn('Failed to send heartbeat:', err.message);
        }
    }

    /**
     * Setup listener for app state changes
     * Only stop heartbeat when app is truly closing (not just backgrounding)
     */
    setupAppStateListener() {
        // Remove existing listener if any
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
        }

        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            console.log('App state changed to:', nextAppState);

            if (nextAppState === 'active') {
                // App came to foreground - ensure heartbeat is running
                if (!this.heartbeatInterval) {
                    this.startHeartbeat();
                }
                // Send immediate heartbeat when coming back
                this.sendHeartbeat();
            }
            // Note: We do NOT stop heartbeat when going to background
            // The heartbeat will continue and only the server timeout will mark inactive
            // This allows brief app switches without losing active status
        });
    }

    async stop() {
        // Stop heartbeat
        this.stopHeartbeat();

        // Stop location tracking
        await this.stopLocationTracking();

        // Remove app state listener
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        if (this.connection && this.driverId && this.isRegistered) {
            await this.unregisterDriver(this.driverId);
        }

        if (this.connection) {
            await this.connection.stop();
            this.connection = null;
            this.messageCallbacks = [];
            this.newCallCallbacks = [];
            this.callUpdateCallbacks = [];
            this.driverId = null;
            this.isRegistered = false;
        }
    }

    // Driver registration - called automatically when app opens
    async registerDriver(driverId) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            throw new Error('SignalR not connected');
        }

        if (this.isRegistered) {
            console.log('Driver already registered');
            return;
        }

        try {
            await this.connection.invoke('RegisterDriver', driverId);
            this.isRegistered = true;
            console.log('✅ Driver registered:', driverId);

            // Start location tracking as soon as driver is registered
            await this.startLocationTracking();
        } catch (err) {
            console.error('Error registering driver:', err);
            throw err;
        }
    }

    // Driver unregistration - called when app is closed
    async unregisterDriver(driverId) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            return; // Don't throw if disconnecting
        }
        console.log('Unregistering driver:', driverId);

        try {
            // Stop location tracking when unregistering
            await this.stopLocationTracking();

            await this.connection.invoke('UnregisterDriver', driverId);
            this.isRegistered = false;
            console.log('✅ Driver unregistered:', driverId);
        } catch (err) {
            console.error('Error unregistering driver:', err);
        }
    }

    /**
     * Start continuous location tracking.
     * Called when driver registers - runs as long as they're active (sending heartbeats).
     */
    async startLocationTracking() {
        if (this.isTrackingLocation) {
            console.log('Location tracking already active');
            return;
        }

        try {
            // Check/request location permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Location permission not granted');
                return false;
            }

            this.isTrackingLocation = true;

            // Start watching position
            this.locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,      // Update every 5 seconds
                    distanceInterval: 10,    // Or when moved 10 meters
                },
                (location) => this.handleLocationUpdate(location)
            );

            console.log('📍 Location tracking started');
            return true;
        } catch (error) {
            console.error('Error starting location tracking:', error);
            this.isTrackingLocation = false;
            return false;
        }
    }

    /**
     * Handle incoming location updates - throttled to prevent too many SignalR messages
     */
    handleLocationUpdate(location) {
        const now = Date.now();

        // Throttle updates
        if (now - this.lastLocationSentTime < this.locationUpdateInterval) {
            return;
        }

        this.lastLocationSentTime = now;

        const { latitude, longitude } = location.coords;

        // Send to server via SignalR (no rideId - just tracking driver position)
        this.updateDriverLocation(latitude, longitude, null);
    }

    /**
     * Stop location tracking.
     * Called when driver unregisters or app closes.
     */
    async stopLocationTracking() {
        if (this.locationSubscription) {
            this.locationSubscription.remove();
            this.locationSubscription = null;
        }

        this.isTrackingLocation = false;

        // Notify server to remove this driver from tracking
        await this.removeDriverLocation();

        console.log('📍 Location tracking stopped');
    }

    /**
     * Send a message to all dispatchers via SignalR
     * Uses the DriverSendsMessage socket which:
     * 1. Saves the message to the database
     * 2. Broadcasts to all connected dispatchers
     * 
     * @param {string} message - The message text to send
     * @param {number|null} rideId - Optional ride ID to associate with the message
     */
    async sendMessageToDispatchers(message, rideId = null, driverName = null) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            throw new Error('SignalR not connected');
        }

        if (!this.driverId) {
            throw new Error('Driver ID not set');
        }

        try {
            const savedMessage = await this.connection.invoke('DriverSendsMessage', {
                driverId: parseInt(this.driverId),
                driverName: driverName || '',
                message: message,
                rideId: rideId
            });
            console.log('✅ Message sent to dispatchers, received ID:', savedMessage?.id || savedMessage?.Id);
            return savedMessage;
        } catch (err) {
            console.error('Error sending message to dispatchers:', err);
            throw err;
        }
    }

    // Legacy message method (kept for backward compatibility)
    async sendMessageToDispatcher(message, rideId = null) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            throw new Error('SignalR not connected');
        }

        if (!this.driverId) {
            throw new Error('Driver ID not set');
        }

        try {
            await this.connection.invoke('SendMessageToDispatcher', {
                fromDriverId: this.driverId,
                message,
                rideId,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error sending message to dispatcher:', err);
            throw err;
        }
    }

    onMessageReceived(callback) {
        this.messageCallbacks.push(callback);
        return () => {
            this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
        };
    }

    // Call notification methods
    onNewCallReceived(callback) {
        this.newCallCallbacks.push(callback);
        return () => {
            this.newCallCallbacks = this.newCallCallbacks.filter(cb => cb !== callback);
        };
    }

    onCallUpdated(callback) {
        this.callUpdateCallbacks.push(callback);
        return () => {
            this.callUpdateCallbacks = this.callUpdateCallbacks.filter(cb => cb !== callback);
        };
    }

    // Called when a call is assigned to someone (remove from open calls)
    onCallAssigned(callback) {
        this.callAssignedCallbacks.push(callback);
        return () => {
            this.callAssignedCallbacks = this.callAssignedCallbacks.filter(cb => cb !== callback);
        };
    }

    // Called when a call is unassigned (driver was removed - should show alert and close active call)
    onCallUnassigned(callback) {
        this.callUnassignedCallbacks.push(callback);
        return () => {
            this.callUnassignedCallbacks = this.callUnassignedCallbacks.filter(cb => cb !== callback);
        };
    }

    // Called when a call becomes available again (reassigned - add to open calls)
    onCallAvailableAgain(callback) {
        this.callAvailableAgainCallbacks.push(callback);
        return () => {
            this.callAvailableAgainCallbacks = this.callAvailableAgainCallbacks.filter(cb => cb !== callback);
        };
    }

    // Called when driver tries to take a call that's already assigned to someone else
    onCallAlreadyAssigned(callback) {
        this.callAlreadyAssignedCallbacks.push(callback);
        return () => {
            this.callAlreadyAssignedCallbacks = this.callAlreadyAssignedCallbacks.filter(cb => cb !== callback);
        };
    }

    // Called when this driver successfully gets assigned to a call
    onCallAssignmentSuccess(callback) {
        this.callAssignmentSuccessCallbacks.push(callback);
        return () => {
            this.callAssignmentSuccessCallbacks = this.callAssignmentSuccessCallbacks.filter(cb => cb !== callback);
        };
    }

    // Called when a call is canceled
    onCallCanceled(callback) {
        this.callCanceledCallbacks.push(callback);
        return () => {
            this.callCanceledCallbacks = this.callCanceledCallbacks.filter(cb => cb !== callback);
        };
    }

    // Called when pickup time is reset by dispatcher
    onPickupTimeReset(callback) {
        this.pickupTimeResetCallbacks.push(callback);
        return () => {
            this.pickupTimeResetCallbacks = this.pickupTimeResetCallbacks.filter(cb => cb !== callback);
        };
    }

    async requestCallAssignment(rideId) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            throw new Error('SignalR not connected');
        }

        if (!this.driverId) {
            throw new Error('Driver ID not set');
        }

        try {
            console.log(`Requesting assignment for ride ${rideId} to driver ${this.driverId}`);
            await this.connection.invoke('CallAssigned', {
                rideId: rideId,
                assignToId: parseInt(this.driverId)
            });
        } catch (err) {
            console.error('Error requesting call assignment:', err);
            throw err;
        }
    }

    async updateDriverStatus(status) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            throw new Error('SignalR not connected');
        }

        if (!this.driverId) {
            throw new Error('Driver ID not set');
        }

        try {
            await this.connection.invoke('UpdateDriverStatus', {
                driverId: this.driverId,
                status, // 'available', 'on-call', 'offline'
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error updating driver status:', err);
            throw err;
        }
    }

    isConnected() {
        return this.connection && this.connection.state === signalR.HubConnectionState.Connected;
    }

    getDriverId() {
        return this.driverId;
    }

    /**
     * Send driver's current GPS location to the server.
     * This is called frequently when the driver has an active ride.
     * The server broadcasts this to all connected dispatchers for map tracking.
     * 
     * @param {number} latitude - GPS latitude
     * @param {number} longitude - GPS longitude
     * @param {number|null} rideId - Optional current ride ID
     */
    async updateDriverLocation(latitude, longitude, rideId = null) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            console.warn('Cannot update location: SignalR not connected');
            return;
        }

        if (!this.driverId) {
            console.warn('Cannot update location: Driver ID not set');
            return;
        }

        try {
            await this.connection.invoke('UpdateDriverLocation',
                parseInt(this.driverId),
                latitude,
                longitude,
                rideId
            );
            console.log('📍 Location updated:', { latitude, longitude, rideId });
        } catch (err) {
            console.warn('Failed to update location:', err.message);
        }
    }

    /**
     * Remove driver location from tracking (when ride is complete or driver goes offline)
     */
    async removeDriverLocation() {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            return;
        }

        if (!this.driverId) {
            return;
        }

        try {
            await this.connection.invoke('RemoveDriverLocation', parseInt(this.driverId));
            console.log('📍 Location tracking stopped');
        } catch (err) {
            console.warn('Failed to remove location:', err.message);
        }
    }

    /**
     * Notify dispatchers that a ride has been completed (dropoff clicked)
     * This allows the tracking map to immediately update
     * 
     * @param {number} rideId - The ID of the completed ride
     */
    async rideCompleted(rideId) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            console.warn('Cannot notify ride completion: SignalR not connected');
            return;
        }

        if (!this.driverId) {
            console.warn('Cannot notify ride completion: Driver ID not set');
            return;
        }

        try {
            await this.connection.invoke('RideCompleted', rideId, parseInt(this.driverId));
            console.log('✅ Ride completion notified:', rideId);
        } catch (err) {
            console.warn('Failed to notify ride completion:', err.message);
        }
    }

    /**
     * Mark messages as read via SignalR
     * This will update the database and notify the sender (dispatchers)
     * 
     * @param {number[]} messageIds - Array of message IDs to mark as read
     */
    async markMessagesAsRead(messageIds) {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            console.warn('Cannot mark messages as read: SignalR not connected');
            return;
        }

        if (!messageIds || messageIds.length === 0) {
            console.warn('No message IDs provided to mark as read');
            return;
        }

        try {
            await this.connection.invoke('MarkMessagesAsRead', messageIds, 'driver');
            console.log('✅ Marked messages as read:', messageIds);
        } catch (err) {
            console.error('Failed to mark messages as read:', err);
            throw err;
        }
    }

    /**
     * Subscribe to message marked as read events
     * Called when a dispatcher marks your message as read
     * 
     * @param {function} callback - Callback function to handle read receipt
     * @returns {function} Unsubscribe function
     */
    onMessageMarkedAsRead(callback) {
        this.messageMarkedAsReadCallbacks.push(callback);
        return () => {
            this.messageMarkedAsReadCallbacks = this.messageMarkedAsReadCallbacks.filter(cb => cb !== callback);
        };
    }
}

// Export singleton instance
const signalRService = new SignalRService();
export default signalRService;