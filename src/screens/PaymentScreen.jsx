/**
 * PaymentScreen.jsx
 * 
 * Displayed after driver clicks "Drop Off" to complete the ride.
 * Shows final cost and handles payment based on payment type.
 * 
 * PAYMENT TYPES:
 * - Cash/Check/Voucher: Simple "Complete Ride" button
 * - CC (Credit Card): 
 *   - If "Driver CC": Shows CC input fields for driver to enter card info
 *   - Shows "Charge" button that leads to success page
 * 
 * FLOW:
 * 1. Show final cost
 * 2. Based on payment type, show appropriate UI
 * 3. On complete/charge → show success → return to Open Calls
 * 
 * PROPS:
 * - rideId: The ID of the completed ride
 * - cost: The ride cost
 * - paymentType: The payment type string
 * - onComplete: Function to call when ride is fully completed
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Modal
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useWaitTime } from '../contexts/WaitTimeContext';
import { useAlert } from '../contexts/AlertContext';
import { ridesAPI, paymentAPI } from '../services/apiService';
import SquareCardTokenizer from '../components/SquareCardTokenizer';

// Payment method options
const PAYMENT_OPTIONS = [
    { value: 'cash', label: '💵 Cash' },
    { value: 'zelle', label: '📱 Zelle' },
    { value: 'drivercc', label: '💳 Driver CC (enter card)' },
    { value: 'dispatchercc', label: '💳 Dispatcher CC (on file)' },
];

/**
 * Wait time pricing per minute based on car type:
 * - Sedan (Car), Minivan: $0.50/min
 * - Lux SUV, 12-pass, 15-pass: $1.00/min
 */
const getWaitTimeRate = (carType) => {
    // carType values from CarType.cs enum: Car=0, SUV=1, MiniVan=2, TwelvePass=3, FifteenPass=4, LuxurySUV=5
    const carTypeNum = typeof carType === 'number' ? carType : parseInt(carType) || 0;
    const carTypeName = typeof carType === 'string' ? carType.toLowerCase() : '';

    // Premium car types: $1.00/min
    if (carTypeNum === 3 || carTypeNum === 4 || carTypeNum === 5 ||
        carTypeName === 'twelvepass' || carTypeName === 'fifteenpass' || carTypeName === 'luxurysuv' ||
        carTypeName === '12pass' || carTypeName === '15pass' || carTypeName === 'lux suv') {
        return 1.00;
    }

    // Standard car types: $0.50/min (Car, SUV, MiniVan)
    return 0.50;
};

const PaymentScreen = ({ rideId, cost = 0, paymentType = 'Cash', call = null, waitTimeMinutes = 0, onComplete }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const { clearTimer } = useWaitTime();
    const { showAlert, showToast } = useAlert();
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Get wait time rate based on car type from call data
    const waitTimeRate = getWaitTimeRate(call?.carType);

    // Payment method state - initialize based on dispatcher input
    const getInitialPaymentMethod = () => {
        const normalized = paymentType?.toLowerCase() || 'cash';
        if (normalized === 'zelle') return 'zelle';
        if (normalized === 'dispatchercc') return 'dispatchercc';
        if (normalized === 'drivercc' || normalized === 'cc') return 'drivercc';
        return 'cash'; // Default to cash for cash, check, voucher, etc.
    };
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(getInitialPaymentMethod());
    const [showPaymentPicker, setShowPaymentPicker] = useState(false);

    // Editable wait time state
    const [editingWaitTime, setEditingWaitTime] = useState(false);
    const [waitTimeValue, setWaitTimeValue] = useState(waitTimeMinutes.toString());
    const [savedWaitTimeMinutes, setSavedWaitTimeMinutes] = useState(waitTimeMinutes);
    const [waitTimeSaving, setWaitTimeSaving] = useState(false);
    const [waitTimeSaved, setWaitTimeSaved] = useState(false);

    // Editable tip state
    const [editingTip, setEditingTip] = useState(false);
    const [tipValue, setTipValue] = useState('0');
    const [savedTip, setSavedTip] = useState(0);
    const [tipSaving, setTipSaving] = useState(false);
    const [tipSaved, setTipSaved] = useState(false);

    // Credit card form state
    const [ccNumber, setCcNumber] = useState('');
    const [ccExpiry, setCcExpiry] = useState('');
    const [ccCvv, setCcCvv] = useState('');
    const [ccName, setCcName] = useState('');

    // Square tokenization state
    const [squareToken, setSquareToken] = useState(null);
    const [tokenizing, setTokenizing] = useState(false);
    const [showSquareTokenizer, setShowSquareTokenizer] = useState(false);

    // Derived payment method flags
    const isDriverCC = selectedPaymentMethod === 'drivercc';
    const isDispatcherCC = selectedPaymentMethod === 'dispatchercc';
    const isCC = isDriverCC || isDispatcherCC;
    const isZelle = selectedPaymentMethod === 'zelle';
    const isCash = selectedPaymentMethod === 'cash';

    // Calculate totals - only include SAVED values, use car-type-specific rate
    const baseCost = typeof cost === 'number' ? cost : 0;
    const waitTimeCost = savedWaitTimeMinutes * waitTimeRate;
    const subtotal = baseCost + savedTip + waitTimeCost;

    // Add 4% CC processing fee for any CC payment type
    const ccFeeRate = 0.04;
    const ccFee = isCC ? subtotal * ccFeeRate : 0;
    const totalCost = subtotal + ccFee;

    // Auto-save wait time when component mounts (if there's initial wait time and not saved yet)
    useEffect(() => {
        const saveInitialWaitTime = async () => {
            if (waitTimeMinutes > 0 && !waitTimeSaved) {
                setWaitTimeSaving(true);
                try {
                    console.log('Saving initial wait time for ride:', rideId, 'Minutes:', waitTimeMinutes, 'Rate:', waitTimeRate);
                    // Save the dollar amount (minutes * rate)
                    await ridesAPI.addWaitTime(rideId, Math.round(waitTimeMinutes * waitTimeRate * 100) / 100);
                    setWaitTimeSaved(true);
                    setSavedWaitTimeMinutes(waitTimeMinutes);
                    console.log('Initial wait time saved successfully');
                } catch (error) {
                    console.error('Error saving initial wait time:', error);
                } finally {
                    setWaitTimeSaving(false);
                }
            }
        };

        saveInitialWaitTime();
    }, [rideId, waitTimeMinutes, waitTimeSaved]);

    // Clear Square token when switching away from Driver CC
    useEffect(() => {
        if (selectedPaymentMethod !== 'drivercc' && squareToken) {
            console.log('Clearing Square token - payment method changed from Driver CC');
            setSquareToken(null);
        }
    }, [selectedPaymentMethod]);

    // Update price when payment method changes (add/remove 4% CC fee)
    useEffect(() => {
        const updatePriceForPaymentMethod = async () => {
            try {
                // Calculate the new total based on payment method
                const currentSubtotal = baseCost + savedTip + (savedWaitTimeMinutes * waitTimeRate);
                const currentCcFee = isCC ? currentSubtotal * ccFeeRate : 0;
                const newTotal = currentSubtotal + currentCcFee;

                // Calculate driver's compensation: base comp + 100% of tips + 85% of wait time
                const baseDriverComp = call?.driversCompensation || baseCost;
                const waitTimeCostNow = savedWaitTimeMinutes * waitTimeRate;
                const driverWaitTimeShare = waitTimeCostNow * 0.85; // Driver gets 85% of wait time
                const driversComp = baseDriverComp + savedTip + driverWaitTimeShare;

                console.log('Updating price for payment method change. CC:', isCC, 'New Total:', newTotal, 'Driver Comp:', driversComp);

                // Update the price in the database with both total and driver compensation
                await ridesAPI.updatePrice(rideId, newTotal, driversComp);
                console.log('Price updated successfully');
            } catch (error) {
                console.error('Error updating price for payment method:', error);
            }
        };

        // Only update if we have a valid rideId and cost
        if (rideId && baseCost > 0) {
            updatePriceForPaymentMethod();
        }
    }, [selectedPaymentMethod, isCC]);

    /**
     * Handle saving/updating wait time
     */
    const handleSaveWaitTime = async () => {
        const minutes = parseInt(waitTimeValue) || 0;
        setWaitTimeSaving(true);
        try {
            console.log('Saving wait time for ride:', rideId, 'Minutes:', minutes, 'Rate:', waitTimeRate);
            // Save the dollar amount (minutes * rate)
            await ridesAPI.addWaitTime(rideId, Math.round(minutes * waitTimeRate * 100) / 100);
            setSavedWaitTimeMinutes(minutes);
            setWaitTimeSaved(true);
            setEditingWaitTime(false);

            // Recalculate total and driver compensation
            // Driver gets: base comp + 100% of tips + 85% of wait time
            const baseDriverComp = call?.driversCompensation || baseCost;
            const waitTimeCostNow = minutes * waitTimeRate;
            const driverWaitTimeShare = waitTimeCostNow * 0.85; // Driver gets 85% of wait time
            const newDriversComp = baseDriverComp + savedTip + driverWaitTimeShare;

            const newSubtotal = baseCost + savedTip + waitTimeCostNow;
            const newCcFee = isCC ? newSubtotal * ccFeeRate : 0;
            const newTotal = newSubtotal + newCcFee;

            console.log('Updating price after wait time change. New Total:', newTotal, 'Driver Comp:', newDriversComp);
            await ridesAPI.updatePrice(rideId, newTotal, newDriversComp);

            showToast(`Wait time updated to ${minutes} min ($${(minutes * waitTimeRate).toFixed(2)})`, 'success');
        } catch (error) {
            console.error('Error saving wait time:', error);
            showAlert('Error', 'Failed to save wait time. Please try again.', [{ text: 'OK' }]);
        } finally {
            setWaitTimeSaving(false);
        }
    };

    /**
     * Handle saving/updating tip
     */
    const handleSaveTip = async () => {
        const tipAmount = parseFloat(tipValue) || 0;
        setTipSaving(true);
        try {
            console.log('Saving tip for ride:', rideId, 'Amount:', tipAmount);
            await ridesAPI.addTip(rideId, Math.round(tipAmount));
            setSavedTip(tipAmount);
            setTipSaved(true);
            setEditingTip(false);

            // Recalculate total and driver compensation
            // Driver gets: base comp + 100% of tips + 85% of wait time
            const baseDriverComp = call?.driversCompensation || baseCost;
            const waitTimeCostNow = savedWaitTimeMinutes * waitTimeRate;
            const driverWaitTimeShare = waitTimeCostNow * 0.85; // Driver gets 85% of wait time
            const newDriversComp = baseDriverComp + tipAmount + driverWaitTimeShare;

            const newSubtotal = baseCost + tipAmount + waitTimeCostNow;
            const newCcFee = isCC ? newSubtotal * ccFeeRate : 0;
            const newTotal = newSubtotal + newCcFee;

            console.log('Updating price after tip change. New Total:', newTotal, 'Driver Comp:', newDriversComp);
            await ridesAPI.updatePrice(rideId, newTotal, newDriversComp);

            showToast(`Tip of $${tipAmount.toFixed(2)} saved`, 'success');
        } catch (error) {
            console.error('Error saving tip:', error);
            showAlert('Error', 'Failed to save tip. Please try again.', [{ text: 'OK' }]);
        } finally {
            setTipSaving(false);
        }
    };

    /**
     * Cancel wait time editing
     */
    const handleCancelWaitTimeEdit = () => {
        setWaitTimeValue(savedWaitTimeMinutes.toString());
        setEditingWaitTime(false);
    };

    /**
     * Cancel tip editing
     */
    const handleCancelTipEdit = () => {
        setTipValue(savedTip.toString());
        setEditingTip(false);
    };

    /**
     * Get display name for selected payment method
     */
    const getPaymentDisplayName = () => {
        const option = PAYMENT_OPTIONS.find(opt => opt.value === selectedPaymentMethod);
        return option?.label || '💵 Cash';
    };

    /**
     * Handle completing the ride for Cash/Check/Voucher payments
     */
    const handleCompleteRide = async () => {
        setLoading(true);
        try {
            // TODO: Call API to mark ride as complete if needed
            console.log('Completing ride:', rideId);

            // Simulate a short delay
            await new Promise(resolve => setTimeout(resolve, 500));

            // Clear the wait time timer
            clearTimer();

            // Return to open calls
            onComplete();
        } catch (error) {
            console.error('Error completing ride:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle charging the credit card or opening tokenizer for Driver CC
     */
    const handleCharge = async () => {
        // For Driver CC: Check if we need to tokenize first
        if (isDriverCC) {
            // If we don't have a token yet, show the Square tokenizer
            if (!squareToken) {
                console.log('No Square token - opening tokenizer modal');
                setShowSquareTokenizer(true);
                return;
            }

            // We have a token - charge the card
            setLoading(true);
            try {
                console.log('Charging with Square token:', squareToken);

                // Charge using the Square token
                const result = await paymentAPI.chargeCard(
                    squareToken,
                    totalCost,
                    rideId,
                    `Payment for ride #${rideId}`
                );

                // Check result and handle accordingly
                if (result.success) {
                    console.log('✅ Driver CC payment successful! Payment ID:', result.paymentId);
                    showToast('Payment processed successfully!', 'success');
                    setShowSuccessModal(true);
                } else {
                    // Payment failed - handle error
                    console.error('❌ Driver CC payment failed:', result.message, 'Error code:', result.errorCode);

                    // Customize alert based on error type
                    const errorCode = result.errorCode || 'UNKNOWN';
                    let title = 'Payment Failed';
                    let message = result.message || 'Unable to process payment.';
                    let buttons = [];

                    switch (errorCode) {
                        case 'CARD_DECLINED':
                        case 'INSUFFICIENT_FUNDS':
                            title = '💳 Card Declined';
                            message = result.message + '\n\nPlease ask the customer for a different card, or change to cash/Zelle payment.';
                            buttons = [
                                {
                                    text: 'Try Different Card',
                                    onPress: () => {
                                        setSquareToken(null);
                                        setShowSquareTokenizer(true);
                                    }
                                },
                                {
                                    text: 'Change Payment Method',
                                    onPress: () => setShowPaymentPicker(true)
                                },
                                { text: 'Cancel' }
                            ];
                            break;

                        case 'CVV_FAILURE':
                        case 'CARD_EXPIRED':
                        case 'INVALID_CARD':
                        case 'TOKENIZATION_FAILED':
                            title = '⚠️ Invalid Card';
                            message = result.message + '\n\nPlease verify the card details are correct.';
                            buttons = [
                                {
                                    text: 'Try Different Card',
                                    onPress: () => {
                                        setSquareToken(null);
                                        setShowSquareTokenizer(true);
                                    }
                                },
                                {
                                    text: 'Change Payment Method',
                                    onPress: () => setShowPaymentPicker(true)
                                }
                            ];
                            break;

                        case 'TOKEN_USED':
                        case 'TOKEN_EXPIRED':
                            title = '⚠️ Card Already Used';
                            message = result.message + '\n\nPlease enter the card details again.';
                            buttons = [
                                {
                                    text: 'Enter Card Again',
                                    onPress: () => {
                                        setSquareToken(null);
                                        setShowSquareTokenizer(true);
                                    }
                                },
                                { text: 'Cancel' }
                            ];
                            break;

                        default:
                            // Generic error - allow retry
                            buttons = [
                                {
                                    text: 'Retry',
                                    onPress: () => handleCharge()
                                },
                                {
                                    text: 'Try Different Card',
                                    onPress: () => {
                                        setSquareToken(null);
                                        setShowSquareTokenizer(true);
                                    }
                                },
                                {
                                    text: 'Change Payment Method',
                                    onPress: () => setShowPaymentPicker(true)
                                }
                            ];
                            break;
                    }

                    showAlert(title, message, buttons);
                }
            } catch (error) {
                console.error('Error charging Driver CC:', error);
                showToast('Something went wrong while processing the payment. Please try again.', 'error');
            } finally {
                setLoading(false);
            }
            return; // Exit - Driver CC flow complete
        }

        // For Dispatcher CC: use token from ride data
        if (isDispatcherCC) {
            const tokenToCharge = call?.paymentTokenId;
            if (!tokenToCharge) {
                showToast('No card on file for this ride.\nPlease change the payment method or contact dispatch.', 'error', 5000);
                return;
            }
            console.log('Using dispatcher CC token:', tokenToCharge);

            setLoading(true);
            try {
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
                    // Payment failed - handle different error types
                    console.error('❌ Payment failed:', result.message, 'Error code:', result.errorCode);

                    // Customize alert based on error type
                    const errorCode = result.errorCode || 'UNKNOWN';
                    let title = 'Payment Failed';
                    let message = result.message || 'Unable to process payment.';
                    let buttons = [];

                    switch (errorCode) {
                        case 'TOKEN_USED':
                        case 'TOKEN_EXPIRED':
                            // Token already used or expired - need new card from dispatch
                            title = '⚠️ Payment Card Issue';
                            message = result.message + '\n\nYou cannot retry with the same card. Please contact dispatch to update the payment method.';
                            buttons = [
                                {
                                    text: 'Contact Dispatch',
                                    onPress: () => {
                                        // TODO: Open messaging or call dispatch
                                        showToast('Please call dispatch to update the payment method', 'info');
                                    }
                                },
                                {
                                    text: 'Use Different Payment',
                                    onPress: () => setShowPaymentPicker(true)
                                }
                            ];
                            break;

                        case 'CARD_DECLINED':
                        case 'INSUFFICIENT_FUNDS':
                            title = '💳 Card Declined';
                            message = result.message + '\n\nPlease ask the customer for a different card, or change to cash/Zelle payment.';
                            buttons = [
                                {
                                    text: 'Change Payment Method',
                                    onPress: () => setShowPaymentPicker(true)
                                },
                                { text: 'Cancel' }
                            ];
                            break;

                        case 'CVV_FAILURE':
                        case 'CARD_EXPIRED':
                        case 'INVALID_CARD':
                            title = '⚠️ Invalid Card';
                            message = result.message + '\n\nPlease contact dispatch to verify the card details or use a different payment method.';
                            buttons = [
                                {
                                    text: 'Change Payment Method',
                                    onPress: () => setShowPaymentPicker(true)
                                },
                                { text: 'Cancel' }
                            ];
                            break;

                        default:
                            // Generic error - allow retry
                            buttons = [
                                {
                                    text: 'Retry',
                                    onPress: () => handleCharge()
                                },
                                {
                                    text: 'Change Payment Method',
                                    onPress: () => setShowPaymentPicker(true)
                                }
                            ];
                            break;
                    }

                    showAlert(title, message, buttons);
                }
            } catch (error) {
                console.error('Error charging card:', error);
                showToast('Something went wrong while processing the payment. Please try again, or change the payment method.', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    /**
     * Handle completion from success modal
     */
    const handleSuccessComplete = () => {
        setShowSuccessModal(false);
        // Clear the wait time timer
        clearTimer();
        onComplete();
    };

    /**
     * Format credit card number with spaces
     */
    const formatCCNumber = (text) => {
        // Remove non-digits
        const cleaned = text.replace(/\D/g, '');
        // Add space every 4 digits
        const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
        return formatted.slice(0, 19); // Max 16 digits + 3 spaces
    };

    /**
     * Format expiry date as MM/YY
     */
    const formatExpiry = (text) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 2) {
            return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
        }
        return cleaned;
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <Text style={styles.headerTitle}>Complete Ride</Text>
            </View>

            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                {/* Total Cost Display */}
                <View style={[styles.costSection, { backgroundColor: colors.card }]}>
                    <Text style={[styles.costLabel, { color: colors.textSecondary }]}>Total Amount</Text>
                    <Text style={styles.costValue}>
                        ${totalCost.toFixed(2)}
                    </Text>

                    {/* Price Breakdown with Editable Fields */}
                    <View style={styles.priceBreakdown}>
                        {/* Base Fare - Not editable */}
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Base Fare</Text>
                            <Text style={[styles.breakdownValue, { color: colors.text }]}>${baseCost.toFixed(2)}</Text>
                        </View>

                        {/* Wait Time - Editable */}
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                                ⏱️ Wait Time (${waitTimeRate.toFixed(2)}/min)
                            </Text>
                            {editingWaitTime ? (
                                <View style={styles.editableFieldRow}>
                                    <TextInput
                                        style={[styles.editableInput, { backgroundColor: colors.background, color: colors.text, borderColor: '#f39c12' }]}
                                        value={waitTimeValue}
                                        onChangeText={(text) => setWaitTimeValue(text.replace(/[^0-9]/g, ''))}
                                        keyboardType="numeric"
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                        autoFocus
                                    />
                                    <Text style={[styles.editableUnit, { color: colors.textSecondary }]}>min</Text>
                                    <TouchableOpacity
                                        style={[styles.confirmButton, waitTimeSaving && styles.buttonDisabled]}
                                        onPress={handleSaveWaitTime}
                                        disabled={waitTimeSaving}
                                    >
                                        {waitTimeSaving ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.confirmButtonText}>✓</Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cancelEditButton}
                                        onPress={handleCancelWaitTimeEdit}
                                    >
                                        <Text style={styles.cancelEditButtonText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.editableFieldRow}>
                                    <Text style={[styles.breakdownValue, { color: '#f39c12' }]}>
                                        +${waitTimeCost.toFixed(2)} ({savedWaitTimeMinutes} min)
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={() => setEditingWaitTime(true)}
                                    >
                                        <Text style={styles.editButtonText}>✏️</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* Tip - Editable */}
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                                💵 Tip
                            </Text>
                            {editingTip ? (
                                <View style={styles.editableFieldRow}>
                                    <Text style={[styles.editableDollar, { color: colors.text }]}>$</Text>
                                    <TextInput
                                        style={[styles.editableInput, { backgroundColor: colors.background, color: colors.text, borderColor: '#2ecc71' }]}
                                        value={tipValue}
                                        onChangeText={(text) => {
                                            const cleaned = text.replace(/[^0-9.]/g, '');
                                            const parts = cleaned.split('.');
                                            if (parts.length > 2) return;
                                            if (parts[1]?.length > 2) return;
                                            setTipValue(cleaned);
                                        }}
                                        keyboardType="decimal-pad"
                                        placeholder="0.00"
                                        placeholderTextColor={colors.textMuted}
                                        autoFocus
                                    />
                                    <TouchableOpacity
                                        style={[styles.confirmButton, { backgroundColor: '#2ecc71' }, tipSaving && styles.buttonDisabled]}
                                        onPress={handleSaveTip}
                                        disabled={tipSaving}
                                    >
                                        {tipSaving ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.confirmButtonText}>✓</Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cancelEditButton}
                                        onPress={handleCancelTipEdit}
                                    >
                                        <Text style={styles.cancelEditButtonText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.editableFieldRow}>
                                    <Text style={[styles.breakdownValue, { color: '#2ecc71' }]}>
                                        +${savedTip.toFixed(2)}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={() => setEditingTip(true)}
                                    >
                                        <Text style={styles.editButtonText}>✏️</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* CC Processing Fee - Only shown for CC payments */}
                        {isCC && ccFee > 0 && (
                            <View style={styles.breakdownRow}>
                                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                                    💳 CC Fee (4%)
                                </Text>
                                <Text style={[styles.breakdownValue, { color: '#e74c3c' }]}>
                                    +${ccFee.toFixed(2)}
                                </Text>
                            </View>
                        )}

                        {/* Total */}
                        <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                            <Text style={[styles.breakdownTotalLabel, { color: colors.text }]}>Total</Text>
                            <Text style={[styles.breakdownTotalValue, { color: '#2ecc71' }]}>${totalCost.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Payment Type Dropdown */}
                <View style={[styles.paymentTypeSection, { backgroundColor: colors.card }]}>
                    <Text style={[styles.paymentTypeLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                    <TouchableOpacity
                        style={[styles.paymentDropdown, { backgroundColor: colors.background, borderColor: colors.divider }]}
                        onPress={() => setShowPaymentPicker(true)}
                    >
                        <Text style={[styles.paymentDropdownText, { color: colors.text }]}>
                            {getPaymentDisplayName()}
                        </Text>
                        <Text style={[styles.paymentDropdownArrow, { color: colors.textSecondary }]}>▼</Text>
                    </TouchableOpacity>
                </View>

                {/* Zelle Section */}
                {isZelle && (
                    <View style={[styles.zelleSection, { backgroundColor: colors.card }]}>
                        <Text style={[styles.zelleSectionTitle, { color: colors.text }]}>📱 Zelle Payment Instructions</Text>
                        <View style={styles.zelleInstructions}>
                            <Text style={[styles.zelleStep, { color: colors.text }]}>
                                1. Open your bank app or Zelle app
                            </Text>
                            <Text style={[styles.zelleStep, { color: colors.text }]}>
                                2. Select "Send Money"
                            </Text>
                            <Text style={[styles.zelleStep, { color: colors.text }]}>
                                3. Send <Text style={styles.zelleAmount}>${totalCost.toFixed(2)}</Text> to:
                            </Text>
                            <View style={[styles.zelleRecipient, { backgroundColor: colors.background }]}>
                                <Text style={[styles.zelleEmail, { color: colors.primary }]}>
                                    payments@dispatch.com
                                </Text>
                                <Text style={[styles.zelleNote, { color: colors.textSecondary }]}>
                                    Include Ride #{rideId} in the memo
                                </Text>
                            </View>
                            <Text style={[styles.zelleStep, { color: colors.text }]}>
                                4. Confirm payment sent before completing ride
                            </Text>
                        </View>
                    </View>
                )}

                {/* Credit Card Form (only for Driver CC - using Square SDK) */}
                {isDriverCC && (
                    <View style={[styles.ccSection, { backgroundColor: colors.card }]}>
                        <Text style={[styles.ccSectionTitle, { color: colors.text }]}>💳 Secure Card Payment</Text>
                        {console.log('Rendering Driver CC section. Square Token:', squareToken, 'Show Tokenizer:', showSquareTokenizer)}
                        {squareToken ? (
                            <View style={[styles.tokenInfo, { backgroundColor: colors.background }]}>
                                <Text style={styles.tokenIcon}>✓</Text>
                                <Text style={[styles.tokenText, { color: colors.text }]}>
                                    Card verified and ready to charge
                                </Text>
                                <TouchableOpacity
                                    style={styles.retokenizeButton}
                                    onPress={() => {
                                        setSquareToken(null);
                                        setShowSquareTokenizer(true);
                                    }}
                                >
                                    <Text style={[styles.retokenizeText, { color: colors.primary }]}>Use Different Card</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.tokenizePrompt, { backgroundColor: colors.background }]}>
                                <Text style={styles.securityIcon}>🔒</Text>
                                <Text style={[styles.securityText, { color: colors.text }]}>
                                    Secure payment powered by Square
                                </Text>
                                <Text style={[styles.securitySubtext, { color: colors.textSecondary }]}>
                                    Card details are encrypted and never stored
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Dispatcher CC Info (card on file - just click charge) */}
                {isDispatcherCC && (
                    <View style={[styles.ccSection, { backgroundColor: colors.card }]}>
                        <Text style={[styles.ccSectionTitle, { color: colors.text }]}>💳 Card On File</Text>
                        <View style={[styles.cardOnFileInfo, { backgroundColor: colors.background }]}>
                            {call?.paymentTokenId ? (
                                <>
                                    <Text style={styles.cardOnFileIcon}>🔒</Text>
                                    <Text style={[styles.cardOnFileText, { color: colors.text }]}>
                                        Credit card details are on file with dispatch.
                                    </Text>
                                    <Text style={[styles.cardOnFileSubtext, { color: colors.textSecondary }]}>
                                        Simply tap "Charge" below to process the payment.
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.cardOnFileIcon}>⚠️</Text>
                                    <Text style={[styles.cardOnFileText, { color: '#e74c3c' }]}>
                                        No card on file found for this ride.
                                    </Text>
                                    <Text style={[styles.cardOnFileSubtext, { color: colors.textSecondary }]}>
                                        Please contact dispatch or change payment method.
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                )}

                {/* Customer Info Summary */}
                <View style={[styles.summarySection, { backgroundColor: colors.card }]}>
                    <Text style={[styles.summaryTitle, { color: colors.text }]}>Ride Summary</Text>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Customer:</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>{call?.customerName || 'N/A'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>From:</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
                            {call?.route?.pickup || 'N/A'}
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>To:</Text>
                        <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
                            {call?.route?.dropOff || 'N/A'}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action Button */}
            <View style={[styles.actionContainer, { backgroundColor: colors.card, borderTopColor: colors.divider }]}>
                {isCC ? (
                    // Credit Card: Charge or Enter Card Details button
                    <TouchableOpacity
                        style={[styles.chargeButton, loading && styles.buttonDisabled]}
                        onPress={handleCharge}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.chargeButtonText}>
                                {isDriverCC && !squareToken ? '🔒 Enter Card Details' : `Charge $${totalCost.toFixed(2)}`}
                            </Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    // Cash or Zelle: Complete Ride button
                    <TouchableOpacity
                        style={[styles.completeButton, loading && styles.buttonDisabled]}
                        onPress={handleCompleteRide}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.completeButtonText}>
                                {isZelle ? 'Confirm Zelle & Complete' : 'Complete Ride'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Payment Method Picker Modal */}
            <Modal
                visible={showPaymentPicker}
                transparent={true}
                animationType="slide"
            >
                <TouchableOpacity
                    style={styles.pickerModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowPaymentPicker(false)}
                >
                    <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Payment Method</Text>
                            <TouchableOpacity onPress={() => setShowPaymentPicker(false)}>
                                <Text style={[styles.pickerDone, { color: colors.primary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.paymentOptionsList}>
                            {PAYMENT_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.paymentOptionItem,
                                        { borderBottomColor: colors.divider },
                                        selectedPaymentMethod === option.value && styles.paymentOptionItemSelected
                                    ]}
                                    onPress={() => {
                                        setSelectedPaymentMethod(option.value);
                                        setShowPaymentPicker(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.paymentOptionText,
                                        { color: colors.text },
                                        selectedPaymentMethod === option.value && styles.paymentOptionTextSelected
                                    ]}>
                                        {option.label}
                                    </Text>
                                    {selectedPaymentMethod === option.value && (
                                        <Text style={styles.paymentOptionCheck}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Square Tokenizer - renders its own modal */}
            {showSquareTokenizer && (
                <SquareCardTokenizer
                    rideId={rideId}
                    amount={totalCost}
                    onTokenReceived={(token, details) => {
                        console.log('✅ Token received:', token);
                        setSquareToken(token);
                        setShowSquareTokenizer(false);
                        setTokenizing(false);
                        showToast('Card verified successfully!', 'success');
                    }}
                    onError={(message, code) => {
                        //console.error('❌ Tokenization error:', message, code);
                        setShowSquareTokenizer(false);
                        setTokenizing(false);

                        if (code === 'USER_CANCELED') {
                            // User canceled, no alert needed
                            return;
                        }

                        let alertMessage = message;
                        let alertButtons = [{ text: 'OK' }];

                        if (code === 'INVALID_CARD' || code === 'CVV_FAILURE' || code === 'CARD_EXPIRED') {
                            alertMessage = 'Invalid card details. Please check the card number, expiry date, and CVV.';
                            alertButtons = [
                                { text: 'Retry', onPress: () => setShowSquareTokenizer(true) },
                                { text: 'Cancel' }
                            ];
                        }

                        showAlert('Card Verification Failed', alertMessage, alertButtons);
                    }}
                />
            )}

            {/* Payment Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.successModal, { backgroundColor: colors.card }]}>
                        <Text style={styles.successIcon}>✅</Text>
                        <Text style={[styles.successTitle, { color: colors.text }]}>Payment Successful!</Text>
                        <Text style={styles.successAmount}>
                            ${totalCost.toFixed(2)}
                        </Text>
                        <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
                            The payment has been processed successfully.
                        </Text>
                        <TouchableOpacity
                            style={styles.successButton}
                            onPress={handleSuccessComplete}
                        >
                            <Text style={styles.successButtonText}>Complete Call</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: '#007AFF',
        paddingVertical: 15,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    costSection: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 30,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    costLabel: {
        fontSize: 16,
        color: '#666',
        marginBottom: 5,
    },
    costValue: {
        fontSize: 48,
        fontWeight: '700',
        color: '#2ecc71',
    },
    paymentTypeSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
    },
    paymentTypeLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    paymentDropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    paymentDropdownText: {
        fontSize: 16,
        fontWeight: '600',
    },
    paymentDropdownArrow: {
        fontSize: 12,
    },
    // Zelle section styles
    zelleSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    zelleSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 15,
    },
    zelleInstructions: {
        gap: 12,
    },
    zelleStep: {
        fontSize: 15,
        lineHeight: 22,
    },
    zelleAmount: {
        fontWeight: '700',
        color: '#6b2fba',
        fontSize: 16,
    },
    zelleRecipient: {
        padding: 15,
        borderRadius: 8,
        marginVertical: 8,
        alignItems: 'center',
    },
    zelleEmail: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 5,
    },
    zelleNote: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    // Picker modal styles
    pickerModalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    pickerModal: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 30,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    pickerDone: {
        fontSize: 20,
        fontWeight: '600',
    },
    paymentOptionsList: {
        paddingVertical: 10,
    },
    paymentOptionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    paymentOptionItemSelected: {
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
    },
    paymentOptionText: {
        fontSize: 17,
    },
    paymentOptionTextSelected: {
        fontWeight: '600',
        color: '#007AFF',
    },
    paymentOptionCheck: {
        fontSize: 18,
        color: '#007AFF',
        fontWeight: '700',
    },
    ccSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    ccSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    // Card on file styles (for Dispatcher CC)
    cardOnFileInfo: {
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    cardOnFileIcon: {
        fontSize: 40,
        marginBottom: 10,
    },
    cardOnFileText: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 8,
    },
    cardOnFileSubtext: {
        fontSize: 14,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#333',
    },
    rowInputs: {
        flexDirection: 'row',
    },
    summarySection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    summaryLabel: {
        fontSize: 14,
        color: '#666',
    },
    summaryValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        flex: 1,
        textAlign: 'right',
        marginLeft: 10,
    },
    actionContainer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    completeButton: {
        backgroundColor: '#2ecc71',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    completeButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    chargeButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    chargeButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    // Success Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    successModal: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    successIcon: {
        fontSize: 60,
        marginBottom: 15,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2ecc71',
        marginBottom: 10,
    },
    successAmount: {
        fontSize: 36,
        fontWeight: '700',
        color: '#333',
        marginBottom: 10,
    },
    successMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 25,
    },
    successButton: {
        backgroundColor: '#2ecc71',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 10,
    },
    successButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    // Tip Section
    tipSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
    },
    tipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    tipTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    tipBadge: {
        backgroundColor: '#d4edda',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    tipBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#28a745',
    },
    tipInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    tipInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    tipDollarSign: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginRight: 5,
    },
    tipInput: {
        flex: 1,
        fontSize: 18,
        color: '#333',
        paddingVertical: 12,
    },
    tipSaveButton: {
        backgroundColor: '#28a745',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    tipSaveButtonDisabled: {
        backgroundColor: '#9e9e9e',
    },
    tipSaveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    tipSavedText: {
        fontSize: 14,
        color: '#28a745',
        fontWeight: '500',
        marginTop: 10,
    },
    // Price Breakdown
    priceBreakdown: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginTop: 15,
    },
    breakdownTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        minHeight: 44,
    },
    breakdownLabel: {
        fontSize: 14,
        color: '#666',
        flex: 1,
    },
    breakdownValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    breakdownTotal: {
        marginTop: 5,
        borderBottomWidth: 0,
    },
    breakdownTotalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    breakdownTotalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2ecc71',
    },
    // Editable field styles
    editableFieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
    },
    editableInput: {
        width: 65,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 2,
        borderRadius: 8,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    editableUnit: {
        fontSize: 13,
        fontWeight: '500',
    },
    editableDollar: {
        fontSize: 15,
        fontWeight: '600',
    },
    editButton: {
        marginLeft: 10,
        padding: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 6,
    },
    editButtonText: {
        fontSize: 16,
    },
    confirmButton: {
        backgroundColor: '#f39c12',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelEditButton: {
        backgroundColor: '#e74c3c',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelEditButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    // Square tokenizer styles
    tokenInfo: {
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    tokenIcon: {
        fontSize: 40,
        marginBottom: 10,
        color: '#2ecc71',
    },
    tokenText: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 15,
    },
    retokenizeButton: {
        padding: 10,
    },
    retokenizeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    tokenizePrompt: {
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    securityIcon: {
        fontSize: 40,
        marginBottom: 10,
    },
    securityText: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 8,
    },
    securitySubtext: {
        fontSize: 13,
        textAlign: 'center',
    },
    tokenizerModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    tokenizerModal: {
        borderRadius: 20,
        maxHeight: '80%',
    },
    tokenizerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    tokenizerTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    tokenizerClose: {
        fontSize: 24,
        fontWeight: '600',
    },
    tokenizingContainer: {
        padding: 60,
        alignItems: 'center',
    },
    tokenizingText: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: '500',
    },
});

export default PaymentScreen;
