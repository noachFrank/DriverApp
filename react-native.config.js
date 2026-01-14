/**
 * React Native Config
 * 
 * This file controls autolinking behavior.
 * We disable Square SDK on iOS due to CorePaymentCard.framework crash.
 * iOS uses WebView fallback for card entry instead.
 */
module.exports = {
    dependencies: {
        'react-native-square-in-app-payments': {
            platforms: {
                // Disable on iOS - causes crash due to missing CorePaymentCard.framework
                ios: null,
                // Keep enabled on Android
                android: undefined,
            },
        },
    },
};
