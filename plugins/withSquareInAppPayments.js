/**
 * Expo Config Plugin for Square In-App Payments SDK
 * 
 * This plugin configures the native iOS and Android projects
 * to use Square's In-App Payments SDK for card tokenization.
 */

const { withAppBuildGradle, withProjectBuildGradle, withInfoPlist, withPodfile } = require('@expo/config-plugins');

const SQUARE_APPLICATION_ID = 'sandbox-sq0idb--YpQgluD9h8KuPogEWEhPQ';

// Android: Add Square Maven repository to project-level build.gradle
// Note: The react-native-square-in-app-payments package adds this via rootProject.allprojects
// in its own build.gradle, but we add it here as a backup to ensure it's present
function withSquareProjectBuildGradle(config) {
    return withProjectBuildGradle(config, (config) => {
        let contents = config.modResults.contents;

        // Add Square Maven repository to allprojects repositories block
        // Using the correct URL from Square's SDK documentation
        if (!contents.includes('sdk.squareup.com')) {
            // Find the allprojects { repositories { block and add Square Maven
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

// Android: The react-native-square-in-app-payments package handles its own dependencies
// in its build.gradle file, so we don't need to add them again here
function withSquareAndroidBuildGradle(config) {
    // No additional dependencies needed - package handles this
    return config;
}

// iOS: Add Square SDK to Podfile
function withSquareIOSPodfile(config) {
    return withPodfile(config, (config) => {
        const contents = config.modResults.contents;

        // Add Square SDK pod if not present
        if (!contents.includes('SquareInAppPaymentsSDK')) {
            const targetRegex = /target\s+['"].*['"]\s+do/;
            if (targetRegex.test(contents)) {
                config.modResults.contents = contents.replace(
                    targetRegex,
                    (match) => `${match}
  pod 'SquareInAppPaymentsSDK', '~> 1.6.0'`
                );
            }
        }

        return config;
    });
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
    config = withSquareIOSPodfile(config);
    config = withSquareIOSInfoPlist(config);

    return config;
};
