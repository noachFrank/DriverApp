# Custom Alert System Migration Guide

## Overview

The app now uses a custom alert system with two components:

1. **CustomAlert** - For confirmations and errors (like MessageBox.Show in WinForms)
2. **Toast** - For auto-dismissing notifications (success, info, warnings)

## Usage

### 1. Import the hook

```javascript
import { useAlert } from '../contexts/AlertContext';

// Inside your component:
const { showAlert, showToast } = useAlert();
```

### 2. Remove React Native Alert import

```javascript
// ❌ Remove this:
import { Alert } from 'react-native';

// ✅ No need to import Alert anymore
```

## Migration Patterns

### Success Messages (use Toast)

```javascript
// ❌ Old way:
Alert.alert('Success', 'Call assigned successfully', [{ text: 'OK' }]);

// ✅ New way:
showToast('Call assigned successfully!', 'success');
```

### Info/Warning Messages (use Toast)

```javascript
// ❌ Old way:
Alert.alert('Call Unavailable', 'This call was just taken', [{ text: 'OK' }]);

// ✅ New way:
showToast('This call was just taken', 'warning');
```

### Error Messages (use Alert for critical errors)

```javascript
// ❌ Old way:
Alert.alert('Error', 'Failed to load data', [{ text: 'OK' }]);

// ✅ New way (requires acknowledgment):
showAlert('Error', 'Failed to load data', [{ text: 'OK' }]);
```

### Confirmation Dialogs (use Alert)

```javascript
// ❌ Old way:
Alert.alert('Confirm Action', 'Are you sure you want to continue?', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'OK', onPress: () => console.log('Confirmed') },
]);

// ✅ New way:
showAlert('Confirm Action', 'Are you sure you want to continue?', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'OK', onPress: () => console.log('Confirmed') },
]);
```

### Destructive Actions (use Alert with destructive style)

```javascript
// ❌ Old way:
Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
  { text: 'No', style: 'cancel' },
  { text: 'Yes, Cancel', style: 'destructive', onPress: handleCancel },
]);

// ✅ New way:
showAlert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
  { text: 'No', style: 'cancel' },
  { text: 'Yes, Cancel', style: 'destructive', onPress: handleCancel },
]);
```

## Toast Types

```javascript
showToast('Success message', 'success'); // Green with checkmark
showToast('Error message', 'error'); // Red with X
showToast('Warning message', 'warning'); // Orange with ⚠
showToast('Info message', 'info'); // Blue with ℹ
```

## Toast Duration

```javascript
// Default: 3000ms (3 seconds)
showToast('Default duration', 'success');

// Custom duration:
showToast('Quick message', 'success', 1500); // 1.5 seconds
showToast('Long message', 'info', 5000); // 5 seconds
```

## Decision Tree

**Use TOAST when:**

- ✅ Action was successful (call assigned, message sent, etc.)
- ✅ Non-critical warning (call unavailable, no internet)
- ✅ Info notification (new message, call available)
- ✅ User doesn't need to acknowledge

**Use ALERT when:**

- ✅ Critical error that needs acknowledgment
- ✅ User confirmation required (delete, cancel, etc.)
- ✅ Destructive action
- ✅ Important decision

## Complete Examples

### Example 1: OpenCallsScreen.jsx

```javascript
import { useAlert } from '../contexts/AlertContext';

const OpenCallsScreen = () => {
  const { showAlert, showToast } = useAlert();

  // Success - use toast
  const handleCallAssigned = () => {
    showToast('Call assigned! View it in the Active tab.', 'success');
  };

  // Warning - use toast
  const handleCallTaken = () => {
    showToast('This call was just taken by another driver.', 'warning');
  };

  // Error requiring acknowledgment - use alert
  const handleConnectionError = () => {
    showAlert(
      'Connection Error',
      'Not connected to server. Please check your internet connection.',
      [{ text: 'OK' }]
    );
  };
};
```

### Example 2: CurrentCallScreen.jsx

```javascript
import { useAlert } from '../contexts/AlertContext';

const CurrentCallScreen = () => {
  const { showAlert, showToast } = useAlert();

  // Success - use toast
  const handlePickup = async () => {
    await markAsPickedUp();
    showToast('Marked as picked up!', 'success');
  };

  // Confirmation - use alert
  const handleCancelRide = () => {
    showAlert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          await cancelRide();
          showToast('Ride canceled', 'success');
        },
      },
    ]);
  };
};
```

## Files Updated

- ✅ `src/components/CustomAlert.jsx` - Created
- ✅ `src/components/Toast.jsx` - Created
- ✅ `src/contexts/AlertContext.jsx` - Created
- ✅ `App.js` - Added AlertProvider
- ✅ `src/screens/OpenCallsScreen.jsx` - Migrated all alerts

## Files Remaining (To Be Updated)

- [ ] `src/screens/CurrentCallScreen.jsx`
- [ ] `src/screens/HomeScreen.jsx`

## Testing Checklist

- [ ] Test success toast (call assignment)
- [ ] Test warning toast (call taken by another driver)
- [ ] Test error alert (connection error)
- [ ] Test confirmation alert (cancel ride)
- [ ] Test destructive alert (delete action)
- [ ] Test auto-dismiss timing
- [ ] Test manual dismiss (tap toast)
- [ ] Test multiple toasts (should queue or replace)
