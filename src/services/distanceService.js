/**
 * Distance Service for DriverApp
 * 
 * Calculates distance from user's location to pickup addresses
 * using Google Distance Matrix API.
 */

import { GOOGLE_MAPS_API_KEY } from '../config/googleMapsConfig';

/**
 * Calculate distance from origin to destination using Distance Matrix API
 * @param {object} origin - { latitude, longitude }
 * @param {string} destination - Address string
 * @returns {Promise<{distance: string, duration: string, error?: string}>}
 */
export const calculateDistanceToPickup = async (origin, destination) => {
    if (!origin || !destination) {
        return { distance: null, duration: null, error: 'Missing origin or destination' };
    }

    try {
        const originStr = `${origin.latitude},${origin.longitude}`;
        const destinationEncoded = encodeURIComponent(destination);

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destinationEncoded}&units=imperial&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        // Log full response for debugging
        console.log('Distance Matrix API full response:', JSON.stringify(data));

        if (data.status !== 'OK') {
            // Log error message if available
            if (data.error_message) {
                console.error('Distance Matrix API error:', data.error_message);
            }
            return { distance: null, duration: null, error: data.status, errorMessage: data.error_message };
        }

        const element = data.rows[0]?.elements[0];

        if (element?.status !== 'OK') {
            return { distance: null, duration: null, error: element?.status || 'No route found' };
        }

        return {
            distance: element.distance.text,  // e.g., "5.2 mi"
            duration: element.duration.text,  // e.g., "12 mins"
            distanceValue: element.distance.value,  // meters
            durationValue: element.duration.value,  // seconds
            error: null
        };
    } catch (error) {
        console.error('Distance calculation error:', error);
        return { distance: null, duration: null, error: error.message };
    }
};
