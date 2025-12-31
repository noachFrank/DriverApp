# google-services.json - Firebase Configuration

⚠️ **IMPORTANT FOR PRODUCTION DEPLOYMENT**

## Current Status

The current `google-services.json` file is a **placeholder for development with Expo Go**.

## Before Building for Production (EAS Build or Standalone):

1. **Go to Firebase Console**: https://console.firebase.google.com/

2. **Create/Select Project**:

   - Project name: `Shia's Transportation` (or your preferred name)

3. **Add Android App**:

   - Click "Add app" → Select Android
   - Android package name: `com.shiasTransportation.driverapp`
   - App nickname: `Driver App`
   - Click "Register app"

4. **Download google-services.json**:

   - Download the file from Firebase Console
   - **Replace** the placeholder `google-services.json` in this directory

5. **Enable Cloud Messaging**:

   - In Firebase Console → Project Settings → Cloud Messaging
   - Note the Server Key (you may need this for the backend)

6. **Rebuild the app**:
   ```bash
   npx eas build --platform android
   ```

## For iOS Push Notifications:

You'll also need to configure APNs (Apple Push Notification service):

- Upload APNs certificate to Firebase Console
- Or use EAS credentials for automatic management

## Testing in Expo Go:

Expo Go uses Expo's push notification service, so the placeholder file is sufficient for development on real devices.
