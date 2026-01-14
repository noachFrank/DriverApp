/**
 * Expo Config Plugin for Square In-App Payments SDK
 * 
 * This plugin configures the native iOS and Android projects
 * to use Square's In-App Payments SDK for card tokenization.
 * 
 * NOTE: iOS native SDK is DISABLED due to CorePaymentCard.framework issues.
 * iOS uses WebView fallback for card entry instead.
 */

const { withAppBuildGradle, withProjectBuildGradle, withInfoPlist, withPodfile, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SQUARE_APPLICATION_ID = 'sq0idp-HT7cBlmVVPanBhG6ls7vMw';

// Android: Add Square Maven repository to project-level build.gradle
function withSquareProjectBuildGradle(config) {
    return withProjectBuildGradle(config, (config) => {
        let contents = config.modResults.contents;

        if (!contents.includes('sdk.squareup.com')) {
            const allProjectsRepoRegex = /allprojects\s*\{\s*repositories\s*\{/;
            if (allProjectsRepoRegex.test(contents)) {
                contents = contents.replace(
                    allProjectsRepoRegex,
                    `allprojects {
  repositories {
    maven { url 'https://sdk.squareup.com/public/android' }`
                );
            }
        }

        config.modResults.contents = contents;
        return config;
    });
}

// Android: No additional config needed
function withSquareAndroidBuildGradle(config) {
    return config;
}

// iOS: No longer needed - Square SDK is disabled via react-native.config.js
// The WebView fallback is used instead for iOS card entry
function withSquarePodfileHook(config) {
    // No modifications needed - autolinking is disabled for iOS
    return config;
}

// iOS: Configure Info.plist
function withSquareIOSInfoPlist(config) {
    return withInfoPlist(config, (config) => {
        // Add Square Application ID
        config.modResults.SquareApplicationId = SQUARE_APPLICATION_ID;

        return config;
    });
}

// Main plugin export
module.exports = function withSquareInAppPayments(config) {
    // Apply Android modifications
    config = withSquareProjectBuildGradle(config);
    config = withSquareAndroidBuildGradle(config);

    // Apply iOS modifications  
    config = withSquareIOSInfoPlist(config);
    config = withSquarePodfileHook(config);

    return config;
};
