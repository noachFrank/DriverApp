/**
 * Distance Service for DriverApp
 * 
 * Calculates distance from user's location to pickup addresses
 * by calling the server API (which proxies to Google Distance Matrix API).
 * 
 * This approach avoids CORS issues and keeps the API key secure on the server.
 */

import config, { apiClient } from '../config/apiConfig';

/**
 * Calculate distance from origin to destination using server API
 * @param {object} origin - { latitude, longitude }
 * @param {string} destination - Address string
 * @returns {Promise<{distance: string, duration: string, error?: string}>}
 */
export const calculateDistanceToPickup = async (origin, destination) => {
    if (!origin || !destination) {
        return { distance: null, duration: null, error: 'Missing origin or destination' };
    }

    try {
        console.log('Calculating distance via server API:', {
            originLat: origin.latitude,
            originLng: origin.longitude,
            destination
        });

        const response = await apiClient.post(config.ENDPOINTS.RIDES.CALCULATE_DISTANCE, {
            originLatitude: origin.latitude,
            originLongitude: origin.longitude,
            destinationAddress: destination
        });

        const data = response.data;

        if (data.error) {
            console.error('Distance calculation error from server:', data.error, data.errorMessage || '');
            return { distance: null, duration: null, error: data.error, errorMessage: data.errorMessage };
        }

        console.log('Distance calculation result:', data);

        return {
            distance: data.distance,      // e.g., "5.2 mi"
            duration: data.duration,      // e.g., "12 mins"
            distanceValue: data.distanceValue,  // meters
            durationValue: data.durationValue,  // seconds
            error: null
        };
    } catch (error) {
        console.error('Distance calculation error:', error);
        return { distance: null, duration: null, error: error.message };
    }
};
