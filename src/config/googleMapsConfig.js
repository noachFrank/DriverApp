// Google Maps Configuration for DriverApp
//
// Different API keys for different platforms due to Google's restriction requirements:
// - Web/Browser APIs use HTTP referer restrictions
// - Android apps use SHA-1 fingerprint restrictions  
// - iOS apps use Bundle ID restrictions

import { Platform } from 'react-native';

// API Keys per platform
const API_KEYS = {
    android: 'AIzaSyDefjcbM4uO_aPJi1UzmDVnUgy5E0zz7pE',  // Restricted to Android apps
    ios: 'AIzaSyAA9F_HQ6b1u7B6pO_ByGhGY2b99ihhddQ',          // Restricted to iOS apps
    web: 'AIzaSyDazdrhKGIatao6AWpveHph0TPPuZexSQg',  // Restricted to HTTP referers (for Expo web)
};

// For development, you can use a single unrestricted key:
const DEV_API_KEY = 'AIzaSyB4oZD9v6F-9KZGRyyt4mS1IuBayV3x3CU';

// Set to true to use platform-specific keys, false for single dev key
const USE_PLATFORM_KEYS = false;

// Export the appropriate key based on platform
export const GOOGLE_MAPS_API_KEY = USE_PLATFORM_KEYS
    ? (API_KEYS[Platform.OS] || DEV_API_KEY)
    : DEV_API_KEY;
