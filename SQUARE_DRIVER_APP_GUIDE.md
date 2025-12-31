# Square Payment Integration - Driver App (React Native)

## Overview

This guide explains how Square payments work in the DriverApp for both **Dispatcher CC** (token already saved) and **Driver CC** (driver enters card on the spot).

## How It Works

### Flow 1: Dispatcher CC (Token Already Saved)

1. Dispatcher enters card in NewCallWizard → card tokenized → `paymentTokenId` saved with ride
2. Driver completes ride → sees "Card On File" message
3. Driver taps "Charge" → calls `/api/Payment/ChargeCard` with saved token
4. Success → show checkmark → return to Open Calls
5. Failure → show retry/change payment method options

### Flow 2: Driver CC (Driver Enters Card)

1. Driver selects "Driver CC" payment method
2. Driver enters card details in payment screen
3. For React Native, we have 3 options:
   - **Option A (Recommended)**: Use Square's In-App Payments SDK for React Native
   - **Option B (Simpler)**: Driver enters card → send to backend → backend tokenizes via Square API
   - **Option C (Web View)**: Embed web Square form in a WebView

## Current Implementation Status

✅ **Backend**: Complete - PaymentController with ChargeCard endpoint  
✅ **apiConfig.js**: Payment endpoints added  
✅ **apiService.js**: paymentAPI with chargeCard() and verifyToken() methods  
⚠️ **PaymentScreen.jsx**: Needs update to call actual payment API

## Implementation - Using Current Simple Approach

Since Square's React Native SDK requires native modules and is complex to set up, we'll use the **simpler backend tokenization approach** for now:

### Step 1: Update PaymentScreen.jsx

Replace the `handleCharge` function in [PaymentScreen.jsx](src/screens/PaymentScreen.jsx) around line 305:

**FIND:**

```javascript
const handleCharge = async () => {
  setLoading(true);
  try {
    console.log('Charging CC for ride:', rideId);
    console.log('CC Details:', {
      ccNumber: ccNumber.slice(-4),
      ccExpiry,
      ccName,
    });

    // TODO: Implement actual CC processing
    // For now, simulate processing and show success
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Show success modal
    setShowSuccessModal(true);
  } catch (error) {
    console.error('Error charging card:', error);
  } finally {
    setLoading(false);
  }
};
```

**REPLACE WITH:**

```javascript
const handleCharge = async () => {
  // Validation for Driver CC
  if (isDriverCC) {
    if (!ccNumber || ccNumber.replace(/\s/g, '').length < 13) {
      showAlert('Error', 'Please enter a valid card number', [{ text: 'OK' }]);
      return;
    }
    if (!ccExpiry || ccExpiry.length < 5) {
      showAlert('Error', 'Please enter card expiry date', [{ text: 'OK' }]);
      return;
    }
    if (!ccCvv || ccCvv.length < 3) {
      showAlert('Error', 'Please enter CVV', [{ text: 'OK' }]);
      return;
    }
    if (!ccName || ccName.trim().length < 3) {
      showAlert('Error', 'Please enter cardholder name', [{ text: 'OK' }]);
      return;
    }
  }

  setLoading(true);
  try {
    let tokenToCharge = null;

    // For Dispatcher CC: use token from ride data
    if (isDispatcherCC) {
      tokenToCharge = call?.paymentTokenId;
      if (!tokenToCharge) {
        showAlert(
          'Error',
          'No payment token found for this ride. Please contact dispatch.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      console.log('Using dispatcher CC token:', tokenToCharge);
    }

    // For Driver CC: send card details to backend for tokenization
    else if (isDriverCC) {
      // TODO: Implement Square tokenization via backend
      // For now, this is a placeholder - you'll need to:
      // 1. Send ccNumber, ccExpiry, ccCvv, ccName to backend
      // 2. Backend calls Square API to tokenize
      // 3. Backend returns token
      // 4. Use that token to charge

      showAlert(
        'Not Implemented',
        'Driver CC tokenization requires Square SDK setup. Please use Dispatcher CC for now, or contact support.',
        [{ text: 'OK' }]
      );
      setLoading(false);
      return;
    }

    // Charge the card using the token
    console.log('Charging card for ride:', rideId, 'Amount:', totalCost);
    const result = await paymentAPI.chargeCard(
      tokenToCharge,
      totalCost,
      rideId,
      `Payment for ride #${rideId}`
    );

    if (result.success) {
      console.log('✅ Payment successful! Payment ID:', result.paymentId);
      showToast('Payment processed successfully!', 'success');

      // Show success modal
      setShowSuccessModal(true);
    } else {
      // Payment failed
      console.error('❌ Payment failed:', result.message);

      showAlert(
        'Payment Failed',
        result.message ||
          'Unable to process payment. Please try again or use a different payment method.',
        [
          {
            text: 'Retry',
            onPress: () => handleCharge(),
          },
          {
            text: 'Change Payment Method',
            onPress: () => setShowPaymentPicker(true),
          },
        ]
      );
    }
  } catch (error) {
    console.error('Error charging card:', error);
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'Network error. Please check your connection.';

    showAlert('Payment Error', errorMessage, [
      {
        text: 'Retry',
        onPress: () => handleCharge(),
      },
      {
        text: 'Change Payment Method',
        onPress: () => setShowPaymentPicker(true),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  } finally {
    setLoading(false);
  }
};
```

### Step 2: Add Import for paymentAPI

At the top of [PaymentScreen.jsx](src/screens/PaymentScreen.jsx), add:

**FIND (around line 18):**

```javascript
import { ridesAPI } from '../services/apiService';
```

**REPLACE WITH:**

```javascript
import { ridesAPI, paymentAPI } from '../services/apiService';
```

### Step 3: Update Dispatcher CC Section to Show Token Status

Replace the Dispatcher CC section in PaymentScreen.jsx (around line 625):

**FIND:**

```jsx
{
  /* Dispatcher CC Info (card on file - just click charge) */
}
{
  isDispatcherCC && (
    <View style={[styles.ccSection, { backgroundColor: colors.card }]}>
      <Text style={[styles.ccSectionTitle, { color: colors.text }]}>
        💳 Card On File
      </Text>
      <View
        style={[styles.cardOnFileInfo, { backgroundColor: colors.background }]}
      >
        <Text style={styles.cardOnFileIcon}>🔒</Text>
        <Text style={[styles.cardOnFileText, { color: colors.text }]}>
          Credit card details are on file with dispatch.
        </Text>
        <Text
          style={[styles.cardOnFileSubtext, { color: colors.textSecondary }]}
        >
          Simply tap "Charge" below to process the payment.
        </Text>
      </View>
    </View>
  );
}
```

**REPLACE WITH:**

```jsx
{
  /* Dispatcher CC Info (card on file - just click charge) */
}
{
  isDispatcherCC && (
    <View style={[styles.ccSection, { backgroundColor: colors.card }]}>
      <Text style={[styles.ccSectionTitle, { color: colors.text }]}>
        💳 Card On File
      </Text>
      <View
        style={[styles.cardOnFileInfo, { backgroundColor: colors.background }]}
      >
        {call?.paymentTokenId ? (
          <>
            <Text style={styles.cardOnFileIcon}>🔒</Text>
            <Text style={[styles.cardOnFileText, { color: colors.text }]}>
              Credit card details are on file with dispatch.
            </Text>
            <Text
              style={[
                styles.cardOnFileSubtext,
                { color: colors.textSecondary },
              ]}
            >
              Simply tap "Charge" below to process the payment.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.cardOnFileIcon}>⚠️</Text>
            <Text style={[styles.cardOnFileText, { color: '#e74c3c' }]}>
              No payment token found for this ride.
            </Text>
            <Text
              style={[
                styles.cardOnFileSubtext,
                { color: colors.textSecondary },
              ]}
            >
              Please contact dispatch or change payment method.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
```

## Testing with Dispatcher CC

### Test Flow:

1. **In DispatchApp**:

   - Create new call
   - Select "Dispatcher CC"
   - Enter test card: `4111 1111 1111 1111`, any future date, any CVV
   - Submit call

2. **In DriverApp**:
   - Assign call to yourself
   - Go through pickup/dropoff flow
   - On payment screen, should see "Card On File"
   - Tap "Charge $XX.XX"
   - Should process payment and show success

### Test Cards (Sandbox):

- **Success**: `4111 1111 1111 1111`
- **Declined**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`

## Driver CC Tokenization (Future Implementation)

For Driver CC where driver enters card on the spot, you have 3 options:

### Option A: Square In-App Payments SDK (Recommended but Complex)

1. Install: `npm install react-native-square-in-app-payments`
2. Link native modules: `cd ios && pod install`
3. Configure Square Application ID in app.json
4. Use `<CardEntry>` component to collect card
5. Get token from Square, then charge via API

**Pros**: Official Square SDK, PCI compliant  
**Cons**: Requires native modules, iOS/Android configuration

### Option B: Backend Tokenization (Simpler)

1. Send encrypted card data to your backend
2. Backend calls Square API to tokenize
3. Return token to app
4. Charge using token

**Pros**: No native modules needed  
**Cons**: Card data touches your server (must encrypt)

### Option C: WebView (Easiest)

1. Load SquarePaymentForm in React Native WebView
2. Get token via WebView message passing
3. Charge using token

**Pros**: Reuses existing web component  
**Cons**: Not native UI, less polished experience

## Implementation Priority

For MVP/testing:

1. ✅ **Dispatcher CC** - Works now with current code
2. ⏸️ **Driver CC** - Implement later when needed

Most rides use cash or Dispatcher CC anyway, so Driver CC can wait.

## Production Checklist

Before going live:

- [ ] Update Square environment from Sandbox to Production in `appsettings.json`
- [ ] Use production Square credentials (not sandbox)
- [ ] Test with real cards (small amounts)
- [ ] Implement proper error handling for all failure scenarios
- [ ] Add logging/monitoring for payment failures
- [ ] Implement receipt generation/email
- [ ] Add refund capability in backend
- [ ] Consider PCI compliance audit if storing any card data (we don't, so should be fine)

## Troubleshooting

### "No payment token found"

- Ride was created before Square integration was added
- Dispatcher selected "Dispatcher CC" but didn't enter card
- Token got lost during ride reassignment (check backend logic)

### Payment fails with "CARD_DECLINED"

- Customer's card was declined by bank
- Ask for different payment method

### Payment fails with "INVALID_VALUE"

- Token is expired (Square tokens can expire)
- Token format is wrong (should start with "cnon:" or "ccof:")

### Network errors

- Check server is running
- Check firewall/VPN isn't blocking
- Verify API_BASE_URL in environment.js

## Support

For Square API issues: https://developer.squareup.com/support  
For backend issues: Check server logs in DispatchApp.Server console  
For app issues: Check React Native debugger console
