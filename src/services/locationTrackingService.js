/**
 * Location Tracking Service for DriverApp
 * 
 * This service handles background location tracking when the driver has an active ride.
 * It sends GPS coordinates to the server via SignalR every few seconds so dispatchers
 * can see real-time driver positions on the map.
 * 
 * HOW IT WORKS:
 * 1. When driver picks up a customer (or has an active ride), call startTracking(rideId)
 * 2. Service starts watching GPS position
 * 3. Every few seconds, sends location to server via SignalR
 * 4. When ride is complete, call stopTracking()
 * 
 * COST: Free! Uses device GPS (no API calls) + SignalR (your server, no per-message cost)
 */

import * as Location from 'expo-location';
import signalRService from './signalRService';

class LocationTrackingService {
    constructor() {
        this.locationSubscription = null;
        this.currentRideId = null;
        this.isTracking = false;
        this.lastSentTime = 0;
        this.minUpdateInterval = 5000; // Minimum 5 seconds between updates
    }

    /**
     * Start tracking driver's location for a specific ride.
     * @param {number} rideId - The ID of the current ride
     */
    async startTracking(rideId) {
        if (this.isTracking) {
            console.log('Location tracking already active');
            // Update the ride ID if it changed
            this.currentRideId = rideId;
            return;
        }

        try {
            // Check/request location permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Location permission not granted');
                return false;
            }

            this.currentRideId = rideId;
            this.isTracking = true;

            // Start watching position
            this.locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,      // Update every 5 seconds
                    distanceInterval: 10,    // Or when moved 10 meters
                },
                (location) => this.handleLocationUpdate(location)
            );

            console.log('📍 Location tracking started for ride:', rideId);
            return true;
        } catch (error) {
            console.error('Error starting location tracking:', error);
            this.isTracking = false;
            return false;
        }
    }

    /**
     * Handle incoming location updates
     */
    handleLocationUpdate(location) {
        const now = Date.now();

        // Throttle updates to prevent too many SignalR messages
        if (now - this.lastSentTime < this.minUpdateInterval) {
            return;
        }

        this.lastSentTime = now;

        const { latitude, longitude } = location.coords;

        // Send to server via SignalR
        signalRService.updateDriverLocation(latitude, longitude, this.currentRideId);
    }

    /**
     * Stop tracking driver's location.
     * Call this when the ride is complete or driver goes offline.
     */
    async stopTracking() {
        if (this.locationSubscription) {
            this.locationSubscription.remove();
            this.locationSubscription = null;
        }

        this.isTracking = false;
        this.currentRideId = null;

        // Notify server that this driver is no longer being tracked
        await signalRService.removeDriverLocation();

        console.log('📍 Location tracking stopped');
    }

    /**
     * Update the current ride ID (when switching between rides)
     */
    updateRideId(rideId) {
        this.currentRideId = rideId;
    }

    /**
     * Check if location tracking is currently active
     */
    isActive() {
        return this.isTracking;
    }

    /**
     * Get current tracking ride ID
     */
    getCurrentRideId() {
        return this.currentRideId;
    }
}

// Export singleton instance
const locationTrackingService = new LocationTrackingService();
export default locationTrackingService;
