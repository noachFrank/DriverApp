/**
 * mapsService.js
 * 
 * Service for opening addresses in the user's preferred maps app.
 * Supports Apple Maps, Google Maps, and Waze.
 */

import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAPS_PREFERENCE_KEY = '@preferred_maps_app';

// Available maps apps
export const MAPS_APPS = {
    DEFAULT: 'default',      // Use system default (Apple Maps on iOS, intent picker on Android)
    GOOGLE_MAPS: 'google',   // Google Maps
    WAZE: 'waze',            // Waze
    APPLE_MAPS: 'apple',     // Apple Maps (iOS only)
};

// Labels for the settings screen
export const MAPS_APP_LABELS = {
    [MAPS_APPS.DEFAULT]: 'System Default',
    [MAPS_APPS.GOOGLE_MAPS]: 'Google Maps',
    [MAPS_APPS.WAZE]: 'Waze',
    [MAPS_APPS.APPLE_MAPS]: 'Apple Maps',
};

// Get available maps options based on platform
export const getAvailableMapsOptions = () => {
    const options = [
        { value: MAPS_APPS.DEFAULT, label: MAPS_APP_LABELS[MAPS_APPS.DEFAULT] },
        { value: MAPS_APPS.GOOGLE_MAPS, label: MAPS_APP_LABELS[MAPS_APPS.GOOGLE_MAPS] },
        { value: MAPS_APPS.WAZE, label: MAPS_APP_LABELS[MAPS_APPS.WAZE] },
    ];

    // Add Apple Maps only for iOS
    if (Platform.OS === 'ios') {
        options.push({ value: MAPS_APPS.APPLE_MAPS, label: MAPS_APP_LABELS[MAPS_APPS.APPLE_MAPS] });
    }

    return options;
};

/**
 * Get the user's preferred maps app
 */
export const getPreferredMapsApp = async () => {
    try {
        const preference = await AsyncStorage.getItem(MAPS_PREFERENCE_KEY);
        return preference || MAPS_APPS.DEFAULT;
    } catch (error) {
        console.error('Error getting maps preference:', error);
        return MAPS_APPS.DEFAULT;
    }
};

/**
 * Set the user's preferred maps app
 */
export const setPreferredMapsApp = async (app) => {
    try {
        await AsyncStorage.setItem(MAPS_PREFERENCE_KEY, app);
    } catch (error) {
        console.error('Error saving maps preference:', error);
    }
};

/**
 * Build the URL for a specific maps app
 */
const buildMapsUrl = (address, mapsApp) => {
    const encodedAddress = encodeURIComponent(address);

    switch (mapsApp) {
        case MAPS_APPS.GOOGLE_MAPS:
            // Google Maps URL scheme
            return Platform.select({
                ios: `comgooglemaps://?q=${encodedAddress}`,
                android: `google.navigation:q=${encodedAddress}`,
            });

        case MAPS_APPS.WAZE:
            // Waze URL scheme
            return `waze://?q=${encodedAddress}&navigate=yes`;

        case MAPS_APPS.APPLE_MAPS:
            // Apple Maps (iOS only)
            return `maps:0,0?q=${encodedAddress}`;

        case MAPS_APPS.DEFAULT:
        default:
            // System default
            return Platform.select({
                ios: `maps:0,0?q=${encodedAddress}`,
                android: `geo:0,0?q=${encodedAddress}`,
            });
    }
};

/**
 * Get fallback URL (Google Maps web)
 */
const getFallbackUrl = (address) => {
    const encodedAddress = encodeURIComponent(address);
    return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
};

/**
 * Open address in the user's preferred maps app
 */
export const openAddressInMaps = async (address) => {
    if (!address) return;

    const preferredApp = await getPreferredMapsApp();
    const url = buildMapsUrl(address, preferredApp);

    try {
        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            // If preferred app isn't installed, try fallbacks
            if (preferredApp !== MAPS_APPS.DEFAULT) {
                // Try system default first
                const defaultUrl = buildMapsUrl(address, MAPS_APPS.DEFAULT);
                const defaultSupported = await Linking.canOpenURL(defaultUrl);

                if (defaultSupported) {
                    await Linking.openURL(defaultUrl);
                    return;
                }
            }

            // Final fallback to Google Maps web
            await Linking.openURL(getFallbackUrl(address));
        }
    } catch (error) {
        console.error('Error opening maps:', error);
        // Final fallback to Google Maps web
        try {
            await Linking.openURL(getFallbackUrl(address));
        } catch (e) {
            console.error('Error opening fallback maps:', e);
        }
    }
};

/**
 * Open navigation to an address in the user's preferred maps app
 * This version is specifically for navigation/directions
 */
export const navigateToAddress = async (address) => {
    if (!address) return;

    const preferredApp = await getPreferredMapsApp();
    const encodedAddress = encodeURIComponent(address);

    let url;

    switch (preferredApp) {
        case MAPS_APPS.GOOGLE_MAPS:
            url = Platform.select({
                ios: `comgooglemaps://?daddr=${encodedAddress}&directionsmode=driving`,
                android: `google.navigation:q=${encodedAddress}&mode=d`,
            });
            break;

        case MAPS_APPS.WAZE:
            url = `waze://?q=${encodedAddress}&navigate=yes`;
            break;

        case MAPS_APPS.APPLE_MAPS:
            url = `maps://?daddr=${encodedAddress}&dirflg=d`;
            break;

        case MAPS_APPS.DEFAULT:
        default:
            url = Platform.select({
                ios: `maps://?daddr=${encodedAddress}&dirflg=d`,
                android: `geo:0,0?q=${encodedAddress}`,
            });
    }

    try {
        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            // Fallback to Google Maps web with directions
            const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
            await Linking.openURL(fallbackUrl);
        }
    } catch (error) {
        console.error('Error opening navigation:', error);
        const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
        try {
            await Linking.openURL(fallbackUrl);
        } catch (e) {
            console.error('Error opening fallback navigation:', e);
        }
    }
};

export default {
    MAPS_APPS,
    MAPS_APP_LABELS,
    getAvailableMapsOptions,
    getPreferredMapsApp,
    setPreferredMapsApp,
    openAddressInMaps,
    navigateToAddress,
    openMultiStopRoute,
};

/**
 * Open a multi-stop route in the user's preferred maps app
 * @param {string} pickup - Starting address
 * @param {string[]} stops - Array of stop addresses (in order)
 * @param {string} dropoff - Final destination address
 */
export const openMultiStopRoute = async (pickup, stops, dropoff) => {
    if (!pickup || !dropoff) return;

    const preferredApp = await getPreferredMapsApp();

    // Build waypoints array (stops between pickup and dropoff)
    const waypoints = stops.filter(s => s); // Remove empty stops

    try {
        let url;

        switch (preferredApp) {
            case MAPS_APPS.GOOGLE_MAPS: {
                // Google Maps supports waypoints
                const origin = encodeURIComponent(pickup);
                const destination = encodeURIComponent(dropoff);
                const waypointsParam = waypoints.map(w => encodeURIComponent(w)).join('|');

                if (Platform.OS === 'ios') {
                    // iOS Google Maps app URL
                    if (waypoints.length > 0) {
                        // Google Maps iOS app doesn't support waypoints directly, use web URL
                        url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&travelmode=driving`;
                    } else {
                        url = `comgooglemaps://?saddr=${origin}&daddr=${destination}&directionsmode=driving`;
                    }
                } else {
                    // Android - Google Maps intent
                    if (waypoints.length > 0) {
                        url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&travelmode=driving`;
                    } else {
                        url = `google.navigation:q=${destination}`;
                    }
                }
                break;
            }

            case MAPS_APPS.WAZE: {
                // Waze doesn't support multiple waypoints, navigate to first stop or dropoff
                const firstDestination = waypoints.length > 0 ? waypoints[0] : dropoff;
                url = `waze://?q=${encodeURIComponent(firstDestination)}&navigate=yes`;
                break;
            }

            case MAPS_APPS.APPLE_MAPS: {
                // Apple Maps supports waypoints
                const origin = encodeURIComponent(pickup);
                const destination = encodeURIComponent(dropoff);

                if (waypoints.length > 0) {
                    // Build URL with all addresses
                    // Apple Maps format: maps://?saddr=X&daddr=Y+to:Z+to:W
                    const allDestinations = [...waypoints, dropoff].map(w => encodeURIComponent(w)).join('+to:');
                    url = `maps://?saddr=${origin}&daddr=${allDestinations}&dirflg=d`;
                } else {
                    url = `maps://?saddr=${origin}&daddr=${destination}&dirflg=d`;
                }
                break;
            }

            case MAPS_APPS.DEFAULT:
            default: {
                // Use Google Maps web as default for multi-stop (best support)
                const origin = encodeURIComponent(pickup);
                const destination = encodeURIComponent(dropoff);

                if (waypoints.length > 0) {
                    const waypointsParam = waypoints.map(w => encodeURIComponent(w)).join('|');
                    url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&travelmode=driving`;
                } else {
                    url = Platform.select({
                        ios: `maps://?saddr=${origin}&daddr=${destination}&dirflg=d`,
                        android: `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`,
                    });
                }
            }
        }

        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            // Fallback to Google Maps web
            const origin = encodeURIComponent(pickup);
            const destination = encodeURIComponent(dropoff);
            const waypointsParam = waypoints.map(w => encodeURIComponent(w)).join('|');
            const fallbackUrl = waypoints.length > 0
                ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&travelmode=driving`
                : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
            await Linking.openURL(fallbackUrl);
        }
    } catch (error) {
        console.error('Error opening multi-stop route:', error);
        // Final fallback
        try {
            const origin = encodeURIComponent(pickup);
            const destination = encodeURIComponent(dropoff);
            const waypointsParam = waypoints.map(w => encodeURIComponent(w)).join('|');
            const fallbackUrl = waypoints.length > 0
                ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&travelmode=driving`
                : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
            await Linking.openURL(fallbackUrl);
        } catch (e) {
            console.error('Error opening fallback route:', e);
        }
    }
};
