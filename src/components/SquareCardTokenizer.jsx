/**
 * SquareCardTokenizer.jsx
 * 
 * Square In-App Payments SDK integration for React Native.
 * - Android: Uses native Square SDK for secure card tokenization
 * - iOS: Uses WebView with Square Web Payments SDK (native SDK has CorePaymentCard.framework issues)
 * 
 * Both methods are PCI compliant - card details never touch our servers.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import config from '../config/apiConfig';

// Try to import native Square SDK - Only on Android
let SQIPCardEntry = null;
let SQIPCore = null;
let nativeSDKAvailable = false;

// Only try to load native SDK on Android - iOS uses WebView instead
if (Platform.OS === 'android') {
    try {
        const SquareSDK = require('react-native-square-in-app-payments');
        SQIPCardEntry = SquareSDK.SQIPCardEntry;
        SQIPCore = SquareSDK.SQIPCore;
        nativeSDKAvailable = true;
        console.log('✅ Square native SDK loaded (Android)');
    } catch (error) {
        console.log('⚠️ Square native SDK not available on Android:', error.message);
        nativeSDKAvailable = false;
    }
}

const SQUARE_APP_ID = 'sq0idp-HT7cBlmVVPanBhG6ls7vMw';
const SQUARE_LOCATION_ID = 'L8Y3SJQSQPBZJ'; // Your Square location ID

const SquareCardTokenizer = ({
    onTokenReceived,
    onError,
    rideId,
    amount
}) => {
    const { theme, isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [sdkInitialized, setSdkInitialized] = useState(false);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [showWebView, setShowWebView] = useState(false);

    // Manual entry state (for development/fallback)
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (Platform.OS === 'ios') {
            // iOS: Use WebView with Square Web Payments SDK
            console.log('ℹ️ iOS detected - using WebView for Square payments');
            setLoading(false);
            setShowWebView(true);
        } else if (nativeSDKAvailable) {
            // Android: Use native SDK
            initializeNativeSDK();
        } else {
            // Fallback to manual entry (development mode)
            setLoading(false);
            setShowManualEntry(true);
        }
    }, []);

    // Handle messages from WebView (iOS)
    const handleWebViewMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            console.log('📱 WebView message received:', data);

            if (data.type === 'success') {
                onTokenReceived(data.token, {
                    brand: data.cardDetails?.brand,
                    lastFour: data.cardDetails?.lastFour,
                    webPayments: true
                });
            } else if (data.type === 'cancel') {
                onError('Payment cancelled', 'USER_CANCELED');
            } else if (data.type === 'error') {
                onError(data.error || 'Payment failed', data.code || 'PAYMENT_ERROR');
            }
        } catch (error) {
            console.error('Failed to parse WebView message:', error);
        }
    };

    // Build WebView URL for iOS
    const getWebViewUrl = () => {
        const baseUrl = config.API_BASE_URL.replace('/api', '');
        const isProduction = !__DEV__; // React Native built-in
        const params = new URLSearchParams({
            amount: amount?.toString() || '0',
            rideId: rideId?.toString() || '',
            darkMode: isDarkMode ? 'true' : 'false',
            appId: SQUARE_APP_ID,
            locationId: SQUARE_LOCATION_ID,
            production: isProduction ? 'true' : 'false'
        });
        return `${baseUrl}/square-payment.html?${params.toString()}`;
    };

    const initializeNativeSDK = async () => {
        try {
            console.log('Initializing Square SDK with App ID:', SQUARE_APP_ID);
            await SQIPCore.setSquareApplicationId(SQUARE_APP_ID);
            setSdkInitialized(true);
            setLoading(false);

            // Auto-start card entry after SDK initialized
            setTimeout(() => {
                startCardEntry();
            }, 300);
        } catch (error) {
            console.error('Failed to initialize Square SDK:', error);
            setLoading(false);
            setShowManualEntry(true);
        }
    };

    const startCardEntry = async () => {
        if (!nativeSDKAvailable || !SQIPCardEntry) {
            setShowManualEntry(true);
            return;
        }

        try {
            console.log('Starting Square card entry flow...');

            // Card entry configuration
            const cardEntryConfig = {
                collectPostalCode: false,
            };

            // Start card entry - this opens Square's native UI
            await SQIPCardEntry.startCardEntryFlow(
                cardEntryConfig,
                onCardNonceRequestSuccess,
                onCardEntryCancel
            );
        } catch (error) {
            console.error('Card entry failed:', error);
            setShowManualEntry(true);
        }
    };

    const onCardNonceRequestSuccess = async (cardDetails) => {
        try {
            console.log('✅ Card tokenized successfully!');
            console.log('Nonce:', cardDetails.nonce);

            // Complete the card entry flow
            await SQIPCardEntry.completeCardEntry(() => {
                console.log('Card entry completed');
            });

            // Return the nonce to parent
            onTokenReceived(cardDetails.nonce, {
                brand: cardDetails.card?.brand,
                lastFourDigits: cardDetails.card?.lastFourDigits,
            });
        } catch (error) {
            console.error('Error completing card entry:', error);
            onError(error.message, 'COMPLETION_ERROR');
        }
    };

    const onCardEntryCancel = () => {
        console.log('Card entry cancelled by user');
        onError('Card entry canceled', 'USER_CANCELED');
    };

    // ============ Manual Entry Fallback ============

    const formatCardNumber = (text) => {
        const cleaned = text.replace(/\D/g, '');
        const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
        return formatted.substring(0, 23);
    };

    const formatExpiry = (text) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 2) {
            return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
        }
        return cleaned;
    };

    const validateCard = () => {
        const cardDigits = cardNumber.replace(/\s/g, '');
        if (cardDigits.length < 15 || cardDigits.length > 16) {
            Alert.alert('Invalid Card', 'Card number must be 15-16 digits');
            return false;
        }

        const expiryParts = expiry.split('/');
        if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
            Alert.alert('Invalid Expiry', 'Expiry must be in MM/YY format');
            return false;
        }

        const month = parseInt(expiryParts[0]);
        if (month < 1 || month > 12) {
            Alert.alert('Invalid Expiry', 'Month must be between 01 and 12');
            return false;
        }

        if (cvv.length < 3 || cvv.length > 4) {
            Alert.alert('Invalid CVV', 'CVV must be 3 or 4 digits');
            return false;
        }

        return true;
    };

    const handleManualSubmit = async () => {
        if (!validateCard()) return;

        setSubmitting(true);

        try {
            const cardDigits = cardNumber.replace(/\s/g, '');
            let testToken;

            // Map test cards to Square sandbox tokens
            switch (cardDigits) {
                case '4111111111111111':
                case '5105105105105100':
                case '378282246310005':
                case '6011111111111117':
                    testToken = 'cnon:card-nonce-ok';
                    break;
                case '4000000000000002':
                    testToken = 'cnon:card-nonce-declined';
                    break;
                case '4000000000000069':
                    testToken = 'cnon:card-nonce-cvv-declined';
                    break;
                case '4000000000000127':
                    testToken = 'cnon:card-nonce-cvv-declined';
                    break;
                case '4000000000000119':
                    testToken = 'cnon:card-nonce-declined';
                    break;
                default:
                    // Unknown card - treat as success in sandbox
                    testToken = 'cnon:card-nonce-ok';
                    break;
            }

            console.log('✅ Test card tokenized:', testToken);
            onTokenReceived(testToken, {
                cardNumber: '****' + cardDigits.slice(-4),
                testMode: true
            });

        } catch (error) {
            console.error('❌ Tokenization failed:', error);
            onError(error.message || 'Failed to process card', 'TOKENIZATION_ERROR');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        onError('Card entry canceled', 'USER_CANCELED');
    };

    // ============ Render ============

    if (loading) {
        return (
            <Modal visible={true} transparent={false} animationType="fade">
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                        Initializing secure payment...
                    </Text>
                </View>
            </Modal>
        );
    }

    // iOS WebView with Square Web Payments SDK
    if (showWebView) {
        const webViewUrl = getWebViewUrl();
        console.log('📱 Loading Square WebView:', webViewUrl);

        return (
            <Modal visible={true} animationType="slide" transparent={false} onRequestClose={handleCancel}>
                <View style={[styles.webViewContainer, { backgroundColor: theme.colors.background }]}>
                    <WebView
                        source={{ uri: webViewUrl }}
                        onMessage={handleWebViewMessage}
                        onError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.error('WebView error:', nativeEvent);
                            onError('Failed to load payment form', 'WEBVIEW_ERROR');
                        }}
                        onHttpError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.error('WebView HTTP error:', nativeEvent.statusCode);
                            if (nativeEvent.statusCode >= 400) {
                                onError('Failed to load payment form', 'HTTP_ERROR');
                            }
                        }}
                        style={styles.webView}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={[styles.webViewLoading, { backgroundColor: theme.colors.background }]}>
                                <ActivityIndicator size="large" color={theme.colors.primary} />
                                <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                                    Loading secure payment form...
                                </Text>
                            </View>
                        )}
                    />
                </View>
            </Modal>
        );
    }

    // Manual entry form (fallback for Expo Go)
    if (showManualEntry) {
        return (
            <Modal visible={true} animationType="slide" transparent={false} onRequestClose={handleCancel}>
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            Enter Card Details
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            Amount: ${amount?.toFixed(2) || '0.00'}
                        </Text>
                        {!nativeSDKAvailable && (
                            <Text style={[styles.devMode, { color: theme.colors.warning || '#FFA500' }]}>
                                ⚠️ Dev Mode - Use test cards below
                            </Text>
                        )}
                    </View>

                    <View style={styles.form}>
                        <Text style={[styles.label, { color: theme.colors.text }]}>Card Number</Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: theme.colors.card,
                                color: theme.colors.text,
                                borderColor: theme.colors.border
                            }]}
                            value={cardNumber}
                            onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                            keyboardType="numeric"
                            placeholder="1234 5678 9012 3456"
                            placeholderTextColor={theme.colors.textSecondary}
                            maxLength={23}
                            autoComplete="off"
                            autoCorrect={false}
                            importantForAutofill="no"
                            textContentType="none"
                        />

                        <View style={styles.row}>
                            <View style={styles.halfWidth}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Expiry</Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: theme.colors.card,
                                        color: theme.colors.text,
                                        borderColor: theme.colors.border
                                    }]}
                                    value={expiry}
                                    onChangeText={(text) => setExpiry(formatExpiry(text))}
                                    keyboardType="numeric"
                                    placeholder="MM/YY"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    maxLength={5}
                                    autoComplete="off"
                                    autoCorrect={false}
                                    importantForAutofill="no"
                                    textContentType="none"
                                />
                            </View>

                            <View style={styles.halfWidth}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>CVV</Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: theme.colors.card,
                                        color: theme.colors.text,
                                        borderColor: theme.colors.border
                                    }]}
                                    value={cvv}
                                    onChangeText={setCvv}
                                    keyboardType="numeric"
                                    placeholder="123"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    maxLength={4}
                                    secureTextEntry
                                    autoComplete="off"
                                    autoCorrect={false}
                                    importantForAutofill="no"
                                    textContentType="none"
                                />
                            </View>
                        </View>

                        <Text style={[styles.testInfo, { color: theme.colors.textSecondary }]}>
                            Test Cards (any expiry/CVV):{'\n'}
                            4111 1111 1111 1111 - Success{'\n'}
                            4000 0000 0000 0002 - Declined{'\n'}
                            4000 0000 0000 0069 - CVV Failure
                        </Text>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { borderColor: theme.colors.border }]}
                            onPress={handleCancel}
                            disabled={submitting}
                        >
                            <Text style={[styles.buttonText, { color: theme.colors.text }]}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.submitButton, { backgroundColor: theme.colors.primary }]}
                            onPress={handleManualSubmit}
                            disabled={submitting}
                        >
                            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                                {submitting ? 'Processing...' : 'Submit'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
                        🔒 Secured by Square
                    </Text>
                </View>
            </Modal>
        );
    }

    // Native SDK placeholder (shows briefly while Square UI opens)
    return (
        <Modal visible={true} transparent={false} animationType="fade">
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                    Opening secure card entry...
                </Text>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        paddingTop: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    header: {
        marginBottom: 20,
        alignSelf: 'stretch',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    devMode: {
        fontSize: 14,
        marginTop: 8,
        fontWeight: '500',
    },
    form: {
        flex: 1,
        alignSelf: 'stretch',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    halfWidth: {
        flex: 1,
    },
    testInfo: {
        marginTop: 24,
        fontSize: 12,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        marginTop: 20,
        alignSelf: 'stretch',
    },
    button: {
        flex: 1,
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        borderWidth: 1,
    },
    submitButton: {},
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 12,
    },
    // WebView styles (iOS)
    webViewContainer: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 50 : 0, // Safe area for iOS
    },
    webView: {
        flex: 1,
    },
    webViewLoading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default SquareCardTokenizer;
