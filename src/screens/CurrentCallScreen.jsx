/**
 * CurrentCallScreen.jsx
 * 
 * Displays the details of the CURRENT call that this driver is working on.
 * This screen is opened from the ActiveCallsScreen when a driver selects a call to work on.
 * 
 * FEATURES:
 * - Shows full call details (customer name, phone, route, notes, etc.)
 * - Phone number is clickable → opens phone dialer
 * - Addresses (pickup, dropoff, stops) are clickable → opens maps app
 * - Dynamic action button flow:
 *   1. "Picked Up" → calls /api/Ride/PickUp
 *   2. "Stop #1" through "Stop #4" (if they exist)
 *   3. "Drop Off" → calls /api/Ride/DroppedOff → opens PaymentScreen
 * - "Cancel" button that shows options: Cancel Ride / Cancel Driver
 * - Message button in header
 * 
 * PROPS (received from HomeScreen or ActiveCallsScreen):
 * - rideId: The ID of the ride to display
 * - onBack: Function to navigate back
 * - onComplete: Function to call when ride is fully completed
 * - onMessage: Function to open messaging
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Linking,
    Alert,
    Modal,
    Platform
} from 'react-native';
import { ridesAPI } from '../services/apiService';
import signalRService from '../services/signalRService';
import locationTrackingService from '../services/locationTrackingService';
import { useTheme } from '../contexts/ThemeContext';
import { useWaitTime } from '../contexts/WaitTimeContext';
import PaymentScreen from './PaymentScreen';
import { formatDayLabel, formatEstimatedDuration } from '../utils/dateHelpers';
import AddressAutocomplete from '../components/AddressAutocomplete';

const CurrentCallScreen = ({ rideId, onBack, onComplete, onMessage }) => {
    // All hooks at the top
    const { theme } = useTheme();
    const colors = theme?.colors || {};
    const {
        isTimerRunning,
        formattedTime,
        waitTimeMinutes,
        startTimer,
        stopTimer,
        resetTimer
    } = useWaitTime();

    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [rideStatus, setRideStatus] = useState('assigned');
    const [currentStopIndex, setCurrentStopIndex] = useState(0);
    const [showPayment, setShowPayment] = useState(false);

    // State for adding stops feature
    const [showAddStopForm, setShowAddStopForm] = useState(false);
    const [pendingStops, setPendingStops] = useState([]); // Array of validated addresses
    const [currentStopInput, setCurrentStopInput] = useState('');
    const [confirmingStops, setConfirmingStops] = useState(false);

    // Fetch call details on mount
    useEffect(() => {
        const fetchCallDetails = async () => {
            try {
                setLoading(true);
                const data = await ridesAPI.getById(rideId);
                console.log('Call details fetched:', data);
                setCall(data);

                // Check if ride already has a pickup time
                if (data.pickupTime) {
                    setRideStatus('pickedUp');
                }
            } catch (error) {
                console.error('Error fetching call details:', error);
                Alert.alert('Error', 'Failed to load call details');
            } finally {
                setLoading(false);
            }
        };

        fetchCallDetails();
        locationTrackingService.startTracking(rideId);
        // Cleanup: don't stop tracking here
    }, [rideId]);

    /**
     * Opens the phone app with the given phone number
     * Uses the tel: URL scheme which works on both iOS and Android
     */
    const handlePhonePress = (phoneNumber) => {
        if (!phoneNumber) return;

        // Remove any non-numeric characters except + for international numbers
        const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
        const url = `tel:${cleanNumber}`;

        Linking.canOpenURL(url)
            .then((supported) => {
                if (supported) {
                    Linking.openURL(url);
                } else {
                    Alert.alert('Error', 'Phone calls are not supported on this device');
                }
            })
            .catch((err) => console.error('Error opening phone:', err));
    };

    /**
     * Opens the maps app with the given address for navigation
     * Uses different URL schemes for iOS (Apple Maps) and Android (Google Maps)
     */
    const handleAddressPress = (address) => {
        if (!address) return;

        const encodedAddress = encodeURIComponent(address);

        // Use platform-specific maps URL
        const url = Platform.select({
            ios: `maps:0,0?q=${encodedAddress}`,
            android: `geo:0,0?q=${encodedAddress}`
        });

        Linking.canOpenURL(url)
            .then((supported) => {
                if (supported) {
                    Linking.openURL(url);
                } else {
                    // Fallback to Google Maps web URL
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
                }
            })
            .catch((err) => {
                console.error('Error opening maps:', err);
                // Fallback to Google Maps web URL
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
            });
    };

    // Maximum number of stops allowed per ride
    const MAX_STOPS = 10;

    /**
     * Get list of stops that exist for this ride
     */
    const getStops = () => {
        const stops = [];
        if (call?.route?.stop1) stops.push({ index: 1, address: call.route.stop1 });
        if (call?.route?.stop2) stops.push({ index: 2, address: call.route.stop2 });
        if (call?.route?.stop3) stops.push({ index: 3, address: call.route.stop3 });
        if (call?.route?.stop4) stops.push({ index: 4, address: call.route.stop4 });
        if (call?.route?.stop5) stops.push({ index: 5, address: call.route.stop5 });
        if (call?.route?.stop6) stops.push({ index: 6, address: call.route.stop6 });
        if (call?.route?.stop7) stops.push({ index: 7, address: call.route.stop7 });
        if (call?.route?.stop8) stops.push({ index: 8, address: call.route.stop8 });
        if (call?.route?.stop9) stops.push({ index: 9, address: call.route.stop9 });
        if (call?.route?.stop10) stops.push({ index: 10, address: call.route.stop10 });
        return stops;
    };

    /**
     * Get total number of stops (existing + pending)
     */
    const getTotalStopsCount = () => {
        return getStops().length + pendingStops.length;
    };

    /**
     * Get number of existing stops on the ride
     */
    const getExistingStopsCount = () => {
        return getStops().length;
    };

    /**
     * Handle the "Picked Up" button press
     * Calls /api/Ride/PickUp and advances to next stage
     */
    const handlePickedUp = async () => {
        setActionLoading(true);
        try {
            console.log('Picking up ride:', rideId);
            await ridesAPI.pickup(rideId);
            setRideStatus('pickedUp');
            setCurrentStopIndex(0);
        } catch (error) {
            console.error('Error picking up:', error);
            Alert.alert('Error', 'Failed to mark as picked up. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    /**
     * Handle stop button press
     * Advances to next stop or to dropoff if no more stops
     */
    const handleStopComplete = () => {
        const stops = getStops();
        const nextIndex = currentStopIndex + 1;
        if (nextIndex <= stops.length) {
            setCurrentStopIndex(nextIndex);
        }
    };

    /**
     * Handle the "Drop Off" button press
     * Calls /api/Ride/DroppedOff and shows payment screen
     */
    const handleDropOff = async () => {
        setActionLoading(true);
        try {
            console.log('Dropping off ride:', rideId);

            // Stop the wait time timer when dropping off
            stopTimer();

            await ridesAPI.dropoff(rideId);

            // Notify dispatchers that ride is completed via SignalR
            try {
                await signalRService.rideCompleted(rideId);
                console.log('✅ Notified dispatchers of ride completion');
            } catch (signalRError) {
                console.warn('Could not notify dispatchers:', signalRError.message);
            }

            setRideStatus('droppedOff');
            setShowPayment(true);
        } catch (error) {
            console.error('Error dropping off:', error);
            Alert.alert('Error', 'Failed to mark as dropped off. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    /**
     * Handle payment completion - return to previous screen
     */
    const handlePaymentComplete = () => {
        setShowPayment(false);
        if (onBack) {
            onBack();
        }
    };

    /**
     * Get the current action button based on ride status
     */
    const getActionButton = () => {
        const stops = getStops();

        if (rideStatus === 'assigned') {
            return {
                label: 'Picked Up',
                onPress: handlePickedUp,
                style: styles.pickedUpButton,
                textStyle: styles.pickedUpButtonText
            };
        }

        if (rideStatus === 'pickedUp') {
            if (currentStopIndex < stops.length) {
                const nextStop = stops[currentStopIndex];
                return {
                    label: `Stop #${nextStop.index}`,
                    onPress: handleStopComplete,
                    style: styles.stopButton,
                    textStyle: styles.stopButtonText
                };
            } else {
                return {
                    label: 'Drop Off',
                    onPress: handleDropOff,
                    style: styles.dropoffButton,
                    textStyle: styles.dropoffButtonText
                };
            }
        }

        return null;
    };

    /**
     * Show cancel options modal
     */
    const handleCancelPress = () => {
        setShowCancelModal(true);
    };

    /**
     * Handle cancel ride option
     * Sends message to dispatcher and shows confirmation
     */
    const handleCancelRide = async () => {
        setShowCancelModal(false);
        try {
            await signalRService.sendMessageToDispatchers(
                `Cancel Ride Request: RideId ${rideId}`,
                rideId
            );
            Alert.alert(
                'Request Sent',
                'The dispatcher has been notified of your cancel request and will handle it shortly.'
            );
        } catch (error) {
            console.error('Error sending cancel ride message:', error);
            Alert.alert(
                'Request Sent',
                'The dispatcher has been notified of your cancel request and will handle it shortly.'
            );
        }
    };

    /**
     * Handle cancel driver option (reassign)
     * Sends message to dispatcher and shows confirmation
     */
    const handleCancelDriver = async () => {
        setShowCancelModal(false);
        try {
            await signalRService.sendMessageToDispatchers(
                `Reassign Ride Request: RideId ${rideId}`,
                rideId
            );
            Alert.alert(
                'Request Sent',
                'The dispatcher has been notified of your reassign request and will handle it shortly.'
            );
        } catch (error) {
            console.error('Error sending reassign ride message:', error);
            Alert.alert(
                'Request Sent',
                'The dispatcher has been notified of your reassign request and will handle it shortly.'
            );
        }
    };

    /**
     * Handle address selection from the AddressAutocomplete component
     * When user selects a validated address from Google Places, add it to pending stops
     * 
     * @param {string} formattedAddress - The validated formatted address from Google
     * @param {object} placeDetails - Additional place details (placeId, lat, lng)
     */
    const handleAddressSelected = (formattedAddress, placeDetails) => {
        if (formattedAddress && formattedAddress.trim()) {
            // Check if we've hit the maximum number of stops
            if (getTotalStopsCount() >= MAX_STOPS) {
                Alert.alert(
                    'Maximum Stops Reached',
                    `You cannot have more than ${MAX_STOPS} stops. Please remove some stops before adding more.`
                );
                setCurrentStopInput('');
                return;
            }

            // Add to pending stops array
            setPendingStops(prev => [...prev, {
                address: formattedAddress,
                placeId: placeDetails?.placeId || null
            }]);
            // Clear the input for next entry
            setCurrentStopInput('');
        }
    };

    /**
     * Remove a pending stop from the list
     * Called when user taps the X button on a pending stop
     * 
     * @param {number} index - Index of the stop to remove
     */
    const handleRemovePendingStop = (index) => {
        setPendingStops(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Confirm and submit all pending stops
     * 
     * This function:
     * 1. Loops through all pending stops
     * 2. Calls /api/Ride/AddStop for each stop
     * 3. Calculates a price adjustment (adds $5 per stop - adjust as needed)
     * 4. Calls /api/Ride/UpdatePrice with the new total
     * 5. Refreshes the call data to show the new stops
     * 6. Clears the pending stops and hides the form
     */
    const handleConfirmStops = async () => {
        if (pendingStops.length === 0) {
            Alert.alert('No Stops', 'Please add at least one stop before confirming.');
            return;
        }

        setConfirmingStops(true);

        try {
            // Add each stop one by one
            for (const stop of pendingStops) {
                console.log('Adding stop:', stop.address);
                await ridesAPI.addStop(rideId, stop.address);
            }

            // Calculate new price: add $5 per additional stop
            // You can adjust this logic based on your business rules
            const pricePerStop = 5;
            const currentPrice = call?.cost || 0;
            const newPrice = Math.round(currentPrice + (pendingStops.length * pricePerStop));

            console.log('Updating price from', currentPrice, 'to', newPrice);
            await ridesAPI.updatePrice(rideId, newPrice);

            // Refresh the call data to show the new stops
            const updatedCall = await ridesAPI.getById(rideId);
            setCall(updatedCall);

            // Clear pending stops and hide form
            setPendingStops([]);
            setShowAddStopForm(false);
            setCurrentStopInput('');

            Alert.alert(
                'Stops Added',
                `Successfully added ${pendingStops.length} stop(s). Price updated to $${newPrice.toFixed(2)}.`
            );
        } catch (error) {
            console.error('Error adding stops:', error);
            Alert.alert(
                'Error',
                'Failed to add stops. Please try again.'
            );
        } finally {
            setConfirmingStops(false);
        }
    };

    /**
     * Cancel adding stops - clear pending and hide form
     */
    const handleCancelAddStops = () => {
        setPendingStops([]);
        setCurrentStopInput('');
        setShowAddStopForm(false);
    };

    // Render content based on state
    const renderContent = () => {
        // Loading state
        if (loading) {
            return (
                <View style={[styles.loadingContainer, { backgroundColor: colors.background || '#f5f5f5' }]}>
                    <ActivityIndicator size="large" color={colors.primary || '#007AFF'} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary || '#666' }]}>Loading call details...</Text>
                </View>
            );
        }

        // Error state
        if (!call) {
            return (
                <View style={[styles.errorContainer, { backgroundColor: colors.background || '#f5f5f5' }]}>
                    <Text style={styles.errorIcon}>❌</Text>
                    <Text style={[styles.errorText, { color: colors.text || '#333' }]}>Failed to load call details</Text>
                    <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.primary || '#007AFF' }]} onPress={onBack}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        // Main content
        return (
            <>
                {/* Header with back button */}
                <View style={[styles.header, { backgroundColor: colors.header || '#fff', borderBottomColor: colors.divider || '#e0e0e0' }]}>
                    <TouchableOpacity onPress={onBack} style={styles.headerBackButton}>
                        <Text style={[styles.headerBackText, { color: colors.headerText || '#007AFF' }]}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.headerText || '#333' }]}>Active Call</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                    {/* Customer Info Section */}
                    <View style={[styles.section, { backgroundColor: colors.card }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Customer</Text>
                        <Text style={[styles.customerName, { color: colors.text }]}>{call.customerName || 'N/A'}</Text>

                        {/* Clickable Phone Number */}
                        <TouchableOpacity
                            style={[styles.phoneButton, { backgroundColor: colors.background }]}
                            onPress={() => handlePhonePress(call.customerPhoneNumber)}
                        >
                            <Text style={styles.phoneIcon}>📞</Text>
                            <Text style={[styles.phoneText, { color: colors.primary }]}>
                                {call.customerPhoneNumber || 'No phone'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Route Section */}
                    <View style={[styles.section, { backgroundColor: colors.card }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Route</Text>

                        {/* Pickup - Clickable */}
                        <TouchableOpacity
                            style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                            onPress={() => handleAddressPress(call.route?.pickup)}
                        >
                            <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                <Text style={styles.addressIcon}>📍</Text>
                                <View style={styles.addressContent}>
                                    <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Pickup</Text>
                                    <Text style={[styles.addressText, { color: colors.text }]}>
                                        {call.route?.pickup || 'N/A'}
                                    </Text>
                                </View>
                                <Text style={styles.mapIcon}>🗺️</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Stops - Clickable (only show if exists) */}
                        {call.route?.stop1 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop1)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 1</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop1}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {call.route?.stop2 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop2)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 2</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop2}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {call.route?.stop3 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop3)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 3</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop3}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {call.route?.stop4 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop4)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 4</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop4}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        {call.route?.stop5 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop5)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 5</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop5}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        {call.route?.stop6 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop6)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 6</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop6}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        {call.route?.stop7 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop7)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 7</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop7}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        {call.route?.stop8 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop8)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 8</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop8}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        {call.route?.stop9 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop9)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 9</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop9}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        {call.route?.stop10 && (
                            <TouchableOpacity
                                style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                                onPress={() => handleAddressPress(call.route.stop10)}
                            >
                                <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                    <Text style={styles.addressIcon}>📌</Text>
                                    <View style={styles.addressContent}>
                                        <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Stop 10</Text>
                                        <Text style={[styles.addressText, { color: colors.text }]}>{call.route.stop10}</Text>
                                    </View>
                                    <Text style={styles.mapIcon}>🗺️</Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Dropoff - Clickable */}
                        <TouchableOpacity
                            style={[styles.addressButton, { borderBottomColor: colors.divider }]}
                            onPress={() => handleAddressPress(call.route?.dropOff)}
                        >
                            <View style={[styles.addressRow, { backgroundColor: colors.background }]}>
                                <Text style={styles.addressIcon}>🏁</Text>
                                <View style={styles.addressContent}>
                                    <Text style={[styles.addressLabel, { color: colors.textMuted }]}>Dropoff</Text>
                                    <Text style={[styles.addressText, { color: colors.text }]}>
                                        {call.route?.dropOff || 'N/A'}
                                    </Text>
                                </View>
                                <Text style={styles.mapIcon}>🗺️</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Round Trip indicator */}
                        {call.route?.roundTrip && (
                            <View style={[styles.roundTripBadge, { backgroundColor: colors.background }]}>
                                <Text style={[styles.roundTripText, { color: colors.primary }]}>🔄 Round Trip</Text>
                            </View>
                        )}
                    </View>

                    {/* Add Stops Section */}
                    <View style={[styles.section, { backgroundColor: colors.card }]}>
                        <View style={styles.addStopHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>
                                Add Stops {getExistingStopsCount() > 0 ? `(${getExistingStopsCount()}/${MAX_STOPS})` : ''}
                            </Text>
                            {!showAddStopForm && (
                                <TouchableOpacity
                                    style={[styles.addStopToggleButton, { backgroundColor: getExistingStopsCount() >= MAX_STOPS ? '#ccc' : (colors.primary || '#007AFF') }]}
                                    onPress={() => {
                                        if (getExistingStopsCount() >= MAX_STOPS) {
                                            Alert.alert(
                                                'Maximum Stops Reached',
                                                `This ride already has ${MAX_STOPS} stops. You cannot add more stops.`
                                            );
                                        } else {
                                            setShowAddStopForm(true);
                                        }
                                    }}
                                >
                                    <Text style={styles.addStopToggleButtonText}>+ Add Stop</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {showAddStopForm && (
                            <View style={styles.addStopForm}>
                                {/* Address Input with Google Places Autocomplete */}
                                <AddressAutocomplete
                                    value={currentStopInput}
                                    onChange={handleAddressSelected}
                                    onInputChange={setCurrentStopInput}
                                    placeholder="Enter stop address..."
                                    label="New Stop Address"
                                    colors={colors}
                                />

                                {/* List of Pending Stops */}
                                {pendingStops.length > 0 && (
                                    <View style={styles.pendingStopsContainer}>
                                        <Text style={[styles.pendingStopsTitle, { color: colors.textSecondary }]}>
                                            Pending Stops ({pendingStops.length}):
                                        </Text>
                                        {pendingStops.map((stop, index) => (
                                            <View key={index} style={[styles.pendingStopItem, { backgroundColor: colors.background }]}>
                                                <Text style={styles.pendingStopIcon}>📌</Text>
                                                <Text style={[styles.pendingStopText, { color: colors.text }]} numberOfLines={2}>
                                                    {stop.address}
                                                </Text>
                                                <TouchableOpacity
                                                    style={styles.removePendingStopButton}
                                                    onPress={() => handleRemovePendingStop(index)}
                                                >
                                                    <Text style={styles.removePendingStopText}>✕</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Action Buttons */}
                                <View style={styles.addStopActions}>
                                    <TouchableOpacity
                                        style={[styles.cancelAddStopButton, { borderColor: colors.divider }]}
                                        onPress={handleCancelAddStops}
                                        disabled={confirmingStops}
                                    >
                                        <Text style={[styles.cancelAddStopText, { color: colors.textSecondary }]}>Cancel</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.confirmStopsButton,
                                            { backgroundColor: pendingStops.length > 0 ? '#2ecc71' : '#ccc' },
                                            confirmingStops && styles.disabledButton
                                        ]}
                                        onPress={handleConfirmStops}
                                        disabled={pendingStops.length === 0 || confirmingStops}
                                    >
                                        {confirmingStops ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.confirmStopsText}>
                                                Confirm {pendingStops.length > 0 ? `(${pendingStops.length})` : ''}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Ride Details Section */}
                    <View style={[styles.section, { backgroundColor: colors.card }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Ride Details</Text>

                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Call Time:</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>
                                {call.callTime ? `${formatDayLabel(call.scheduledFor)} ${new Date(call.callTime).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}` : 'N/A'}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Scheduled For:</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>
                                {call.scheduledFor ? `${formatDayLabel(call.scheduledFor)} ${new Date(call.scheduledFor).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}` : 'N/A'}
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Price:</Text>
                            <Text style={styles.priceValue}>
                                {call.cost ? `$${call.cost.toFixed(2)}` : 'TBD'}
                            </Text>
                        </View>

                        {formatEstimatedDuration(call.estimatedDuration) && (
                            <View style={styles.detailRow}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Trip Duration:</Text>
                                <Text style={[styles.tripDurationValue, { color: colors.primary }]}>
                                    🕐 {formatEstimatedDuration(call.estimatedDuration)}
                                </Text>
                            </View>
                        )}

                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Payment:</Text>
                            <Text style={[styles.detailValue, { color: colors.text }]}>{call.paymentType || 'Cash'}</Text>
                        </View>

                        {call.notes && (
                            <View style={[styles.notesContainer, { backgroundColor: colors.background }]}>
                                <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>📝 Notes:</Text>
                                <Text style={[styles.notesText, { color: colors.text }]}>{call.notes}</Text>
                            </View>
                        )}
                    </View>

                    {/* Wait Time Timer Section - Always visible */}
                    <View style={[styles.section, styles.timerSection, { backgroundColor: colors.card }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>⏱️ Wait Time</Text>

                        <View style={styles.timerDisplay}>
                            <Text style={[styles.timerValue, { color: colors.text }]}>
                                {formattedTime}
                            </Text>
                            {waitTimeMinutes > 0 && (
                                <Text style={[styles.timerMinutes, { color: colors.textSecondary }]}>
                                    ({waitTimeMinutes} min)
                                </Text>
                            )}
                        </View>

                        <View style={styles.timerButtons}>
                            {!isTimerRunning ? (
                                <TouchableOpacity
                                    style={[styles.timerStartButton, { backgroundColor: '#2ecc71' }]}
                                    onPress={() => startTimer(rideId)}
                                >
                                    <Text style={styles.timerButtonText}>▶ Start</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.timerStopButton, { backgroundColor: '#e74c3c' }]}
                                    onPress={stopTimer}
                                >
                                    <Text style={styles.timerButtonText}>⏸ Stop</Text>
                                </TouchableOpacity>
                            )}

                            {/* Reset button - only shown in CurrentCallScreen */}
                            {waitTimeMinutes > 0 && !isTimerRunning && (
                                <TouchableOpacity
                                    style={[styles.timerResetButton, { borderColor: colors.divider }]}
                                    onPress={resetTimer}
                                >
                                    <Text style={[styles.timerResetText, { color: colors.textSecondary }]}>Reset</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <Text style={[styles.timerHint, { color: colors.textMuted }]}>
                            Use this timer to track customer wait time. Charges will be added at $1/min.
                        </Text>
                    </View>
                </ScrollView>

                {/* Bottom Action Buttons */}
                {!showPayment && (
                    <View style={[styles.actionButtons, { backgroundColor: colors.card, borderTopColor: colors.divider }]}>
                        {/* Only show cancel button before pickup */}
                        {rideStatus === 'assigned' && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancelPress}
                                disabled={actionLoading}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        )}

                        {getActionButton() && (
                            <TouchableOpacity
                                style={[getActionButton().style, actionLoading && styles.disabledButton]}
                                onPress={getActionButton().onPress}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={getActionButton().textStyle}>
                                        {getActionButton().label}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}

                        {/* Message Button */}
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={() => onMessage && onMessage(`Re RideId ${rideId}:\n`)}
                        >
                            <Text style={styles.messageButtonText}>💬</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Payment Screen - Full screen replacement */}
                {showPayment && (
                    <View style={styles.paymentFullScreen}>
                        <PaymentScreen
                            rideId={rideId}
                            cost={call?.cost}
                            paymentType={call?.paymentType}
                            call={call}
                            waitTimeMinutes={waitTimeMinutes}
                            onComplete={handlePaymentComplete}
                        />
                    </View>
                )}

                {/* Cancel Options Modal */}
                <Modal
                    visible={showCancelModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowCancelModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Cancel Options</Text>
                            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                                What would you like to cancel?
                            </Text>

                            <TouchableOpacity
                                style={[styles.modalOption, { backgroundColor: colors.background }]}
                                onPress={handleCancelRide}
                            >
                                <Text style={styles.modalOptionIcon}>🚫</Text>
                                <View style={styles.modalOptionContent}>
                                    <Text style={[styles.modalOptionTitle, { color: colors.text }]}>Cancel Ride</Text>
                                    <Text style={[styles.modalOptionDesc, { color: colors.textSecondary }]}>
                                        Cancel the entire ride for the customer
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalOption, { backgroundColor: colors.background }]}
                                onPress={handleCancelDriver}
                            >
                                <Text style={styles.modalOptionIcon}>🔄</Text>
                                <View style={styles.modalOptionContent}>
                                    <Text style={[styles.modalOptionTitle, { color: colors.text }]}>Reassign Call</Text>
                                    <Text style={[styles.modalOptionDesc, { color: colors.textSecondary }]}>
                                        Release this call so another driver can take it
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalCancelButton, { borderTopColor: colors.divider }]}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <Text style={[styles.modalCancelText, { color: colors.primary }]}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background || '#f5f5f5' }]}>
            {renderContent()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    errorIcon: {
        fontSize: 60,
        marginBottom: 15,
    },
    errorText: {
        fontSize: 18,
        color: '#666',
        marginBottom: 20,
    },
    backButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerBackButton: {
        padding: 5,
    },
    headerBackText: {
        fontSize: 16,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    headerSpacer: {
        width: 60,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 15,
        paddingBottom: 30,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    customerName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        marginBottom: 10,
    },
    phoneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f4fd',
        padding: 12,
        borderRadius: 8,
    },
    phoneIcon: {
        fontSize: 20,
        marginRight: 10,
    },
    phoneText: {
        fontSize: 18,
        color: '#007AFF',
        fontWeight: '500',
    },
    addressButton: {
        marginBottom: 10,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
    },
    addressIcon: {
        fontSize: 20,
        marginRight: 10,
    },
    addressContent: {
        flex: 1,
    },
    addressLabel: {
        fontSize: 12,
        marginBottom: 2,
    },
    addressText: {
        fontSize: 16,
    },
    mapIcon: {
        fontSize: 20,
        marginLeft: 10,
    },
    roundTripBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff3cd',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        marginTop: 5,
    },
    roundTripText: {
        fontSize: 14,
        color: '#856404',
        fontWeight: '500',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    detailLabel: {
        fontSize: 16,
        color: '#666',
    },
    detailValue: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 18,
        color: '#2ecc71',
        fontWeight: '700',
    },
    tripDurationValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    notesContainer: {
        marginTop: 10,
        padding: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    notesLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    notesText: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
    },
    actionButtons: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        gap: 15,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#ff4444',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    pickedUpButton: {
        flex: 2,
        backgroundColor: '#2ecc71',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    pickedUpButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    stopButton: {
        flex: 2,
        backgroundColor: '#3498db',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    stopButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    dropoffButton: {
        flex: 2,
        backgroundColor: '#9b59b6',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    dropoffButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    messageButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageButtonText: {
        fontSize: 22,
    },
    disabledButton: {
        opacity: 0.6,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 20,
        width: '100%',
        maxWidth: 350,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
        marginBottom: 5,
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    modalOptionIcon: {
        fontSize: 28,
        marginRight: 15,
    },
    modalOptionContent: {
        flex: 1,
    },
    modalOptionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#333',
        marginBottom: 3,
    },
    modalOptionDesc: {
        fontSize: 13,
        color: '#666',
    },
    modalCancelButton: {
        marginTop: 10,
        padding: 12,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '500',
    },
    paymentFullScreen: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#f5f5f5',
    },
    // Add Stops Section Styles
    addStopHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    addStopToggleButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addStopToggleButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    addStopForm: {
        marginTop: 10,
    },
    pendingStopsContainer: {
        marginTop: 15,
    },
    pendingStopsTitle: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    pendingStopItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    pendingStopIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    pendingStopText: {
        flex: 1,
        fontSize: 14,
    },
    removePendingStopButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#ff4444',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    removePendingStopText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    addStopActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
        gap: 10,
    },
    cancelAddStopButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    cancelAddStopText: {
        fontSize: 16,
        fontWeight: '500',
    },
    confirmStopsButton: {
        flex: 2,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    confirmStopsText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Timer styles
    timerSection: {
        alignItems: 'center',
    },
    timerDisplay: {
        alignItems: 'center',
        marginVertical: 15,
    },
    timerValue: {
        fontSize: 48,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    timerMinutes: {
        fontSize: 16,
        marginTop: 5,
    },
    timerButtons: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 15,
    },
    timerStartButton: {
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    timerStopButton: {
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    timerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    timerResetButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        borderWidth: 1,
    },
    timerResetText: {
        fontSize: 16,
        fontWeight: '500',
    },
    timerHint: {
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});

export default CurrentCallScreen;
