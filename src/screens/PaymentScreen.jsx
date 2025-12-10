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
    Modal,
    Alert
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useWaitTime } from '../contexts/WaitTimeContext';
import { ridesAPI } from '../services/apiService';

const WAIT_TIME_RATE = 1; // $1 per minute

const PaymentScreen = ({ rideId, cost = 0, paymentType = 'Cash', call = null, waitTimeMinutes = 0, onComplete }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const { clearTimer } = useWaitTime();
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [tipSaving, setTipSaving] = useState(false);
    const [waitTimeSaving, setWaitTimeSaving] = useState(false);

    // Tip state
    const [tipAmount, setTipAmount] = useState('');
    const [tipSaved, setTipSaved] = useState(false);

    // Wait time state
    const [waitTimeSaved, setWaitTimeSaved] = useState(false);

    // Credit card form state
    const [ccNumber, setCcNumber] = useState('');
    const [ccExpiry, setCcExpiry] = useState('');
    const [ccCvv, setCcCvv] = useState('');
    const [ccName, setCcName] = useState('');

    const normalizedPaymentType = paymentType?.toLowerCase() || 'cash';
    const isCC = normalizedPaymentType === 'drivercc' || normalizedPaymentType === 'dispatchercc';

    // Only show CC input fields for "Driver CC" - other CC types are charged by dispatch
    const isDriverCC = normalizedPaymentType === 'drivercc';

    // Calculate totals
    const baseCost = typeof cost === 'number' ? cost : 0;
    const parsedTip = parseFloat(tipAmount) || 0;
    const waitTimeCost = waitTimeMinutes * WAIT_TIME_RATE;
    const totalCost = baseCost + parsedTip + waitTimeCost;

    // Auto-save wait time when component mounts (if there's wait time)
    useEffect(() => {
        const saveWaitTime = async () => {
            if (waitTimeMinutes > 0 && !waitTimeSaved) {
                setWaitTimeSaving(true);
                try {
                    console.log('Saving wait time for ride:', rideId, 'Amount:', waitTimeCost);
                    await ridesAPI.addWaitTime(rideId, Math.round(waitTimeCost));
                    setWaitTimeSaved(true);
                    console.log('Wait time saved successfully');
                } catch (error) {
                    console.error('Error saving wait time:', error);
                    // Don't show alert, just log - we can retry later
                } finally {
                    setWaitTimeSaving(false);
                }
            }
        };

        saveWaitTime();
    }, [rideId, waitTimeMinutes, waitTimeCost, waitTimeSaved]);

    /**
     * Get display name for payment type
     */
    const getPaymentDisplayName = () => {
        switch (normalizedPaymentType) {
            case 'cash':
                return '💵 Cash';
            case 'check':
                return '📝 Check';
            case 'drivercc':
                return '💳 Driver CC';
            case 'dispatchercc':
                return '💳 Dispatcher CC';
            default:
                return `💵 ${paymentType || 'Cash'}`;
        }
    };

    /**
     * Handle saving the tip
     */
    const handleSaveTip = async () => {
        if (!tipAmount || parsedTip <= 0) {
            Alert.alert('Invalid Tip', 'Please enter a valid tip amount.');
            return;
        }

        setTipSaving(true);
        try {
            console.log('Saving tip for ride:', rideId, 'Amount:', parsedTip);
            await ridesAPI.addTip(rideId, Math.round(parsedTip)); // API expects integer
            setTipSaved(true);
            Alert.alert('Tip Saved', `Tip of $${parsedTip.toFixed(2)} has been added to the ride.`);
        } catch (error) {
            console.error('Error saving tip:', error);
            Alert.alert('Error', 'Failed to save tip. Please try again.');
        } finally {
            setTipSaving(false);
        }
    };

    /**
     * Format tip input - only allow numbers and decimal
     */
    const formatTipInput = (text) => {
        // Remove non-numeric except decimal point
        const cleaned = text.replace(/[^0-9.]/g, '');
        // Only allow one decimal point
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            return parts[0] + '.' + parts.slice(1).join('');
        }
        // Limit to 2 decimal places
        if (parts[1]?.length > 2) {
            return parts[0] + '.' + parts[1].slice(0, 2);
        }
        return cleaned;
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
     * Handle charging the credit card
     * TODO: Implement actual CC processing later
     */
    const handleCharge = async () => {
        setLoading(true);
        try {
            console.log('Charging CC for ride:', rideId);
            console.log('CC Details:', { ccNumber: ccNumber.slice(-4), ccExpiry, ccName });

            // TODO: Implement actual CC processing
            // For now, simulate processing and show success
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Show success modal
            setShowSuccessModal(true);
        } catch (error) {
            console.error('Error charging card:', error);
        } finally {
            setLoading(false);
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

                    {/* Price Breakdown */}
                    <View style={styles.priceBreakdown}>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Base Fare</Text>
                            <Text style={[styles.breakdownValue, { color: colors.text }]}>${baseCost.toFixed(2)}</Text>
                        </View>
                        {waitTimeCost > 0 && (
                            <View style={styles.breakdownRow}>
                                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                                    Wait Time ({waitTimeMinutes} min)
                                </Text>
                                <Text style={[styles.breakdownValue, { color: '#f39c12' }]}>
                                    +${waitTimeCost.toFixed(2)}
                                    {waitTimeSaving && ' ⏳'}
                                    {waitTimeSaved && ' ✓'}
                                </Text>
                            </View>
                        )}
                        {parsedTip > 0 && (
                            <View style={styles.breakdownRow}>
                                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Tip</Text>
                                <Text style={[styles.breakdownValue, { color: '#2ecc71' }]}>+${parsedTip.toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                            <Text style={[styles.breakdownTotalLabel, { color: colors.text }]}>Total</Text>
                            <Text style={[styles.breakdownTotalValue, { color: '#2ecc71' }]}>${totalCost.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Add Tip Section */}
                <View style={[styles.tipSection, { backgroundColor: colors.card }]}>
                    <Text style={[styles.tipSectionTitle, { color: colors.text }]}>💵 Add Tip</Text>
                    <View style={styles.tipInputRow}>
                        <Text style={[styles.tipDollarSign, { color: colors.text }]}>$</Text>
                        <TextInput
                            style={[styles.tipInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            value={tipAmount}
                            onChangeText={(text) => setTipAmount(formatTipInput(text))}
                            keyboardType="decimal-pad"
                            editable={!tipSaved}
                        />
                        <TouchableOpacity
                            style={[
                                styles.saveTipButton,
                                { backgroundColor: tipSaved ? '#ccc' : '#2ecc71' },
                                tipSaving && styles.buttonDisabled
                            ]}
                            onPress={handleSaveTip}
                            disabled={tipSaving || tipSaved || !tipAmount}
                        >
                            {tipSaving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveTipButtonText}>
                                    {tipSaved ? '✓ Saved' : 'Save Tip'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                    {tipSaved && (
                        <Text style={styles.tipSavedNote}>Tip has been added to the ride total</Text>
                    )}
                </View>

                {/* Payment Type Badge */}
                <View style={[styles.paymentTypeSection, { backgroundColor: colors.card }]}>
                    <Text style={[styles.paymentTypeLabel, { color: colors.textSecondary }]}>Payment Method</Text>
                    <View style={styles.paymentTypeBadge}>
                        <Text style={styles.paymentTypeBadgeText}>
                            {getPaymentDisplayName()}
                        </Text>
                    </View>
                </View>

                {/* Credit Card Form (only for Driver CC - driver enters card) */}
                {isDriverCC && (
                    <View style={[styles.ccSection, { backgroundColor: colors.card }]}>
                        <Text style={[styles.ccSectionTitle, { color: colors.text }]}>Card Details</Text>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Card Number</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                placeholder="1234 5678 9012 3456"
                                placeholderTextColor={colors.textMuted}
                                value={ccNumber}
                                onChangeText={(text) => setCcNumber(formatCCNumber(text))}
                                keyboardType="numeric"
                                maxLength={19}
                            />
                        </View>

                        <View style={styles.rowInputs}>
                            <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Expiry</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                    placeholder="MM/YY"
                                    placeholderTextColor={colors.textMuted}
                                    value={ccExpiry}
                                    onChangeText={(text) => setCcExpiry(formatExpiry(text))}
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                            </View>
                            <View style={[styles.inputContainer, { flex: 1 }]}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CVV</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                    placeholder="123"
                                    placeholderTextColor={colors.textMuted}
                                    value={ccCvv}
                                    onChangeText={setCcCvv}
                                    keyboardType="numeric"
                                    maxLength={4}
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Cardholder Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                placeholder="John Doe"
                                placeholderTextColor={colors.textMuted}
                                value={ccName}
                                onChangeText={setCcName}
                                autoCapitalize="words"
                            />
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
                {isDriverCC ? (
                    // Driver CC: Charge button (after entering card details)
                    <TouchableOpacity
                        style={[styles.chargeButton, loading && styles.buttonDisabled]}
                        onPress={handleCharge}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.chargeButtonText}>
                                Charge ${totalCost.toFixed(2)}
                            </Text>
                        )}
                    </TouchableOpacity>
                ) : isCC ? (
                    // Other CC types (Dispatch CC, etc.): Just charge button, no input needed
                    <TouchableOpacity
                        style={[styles.chargeButton, loading && styles.buttonDisabled]}
                        onPress={handleCharge}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.chargeButtonText}>
                                Charge ${totalCost.toFixed(2)}
                            </Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.completeButton, loading && styles.buttonDisabled]}
                        onPress={handleCompleteRide}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.completeButtonText}>Complete Ride</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

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
        alignItems: 'center',
    },
    paymentTypeLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    paymentTypeBadge: {
        backgroundColor: '#e8f4fd',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    paymentTypeBadgeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
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
        padding: 15,
        marginBottom: 20,
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
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    breakdownLabel: {
        fontSize: 14,
        color: '#666',
    },
    breakdownValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
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
});

export default PaymentScreen;
