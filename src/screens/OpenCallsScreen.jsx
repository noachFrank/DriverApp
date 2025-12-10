/**
 * OpenCallsScreen.jsx
 * 
 * Displays a list of open/available calls that the driver can accept.
 * 
 * FEATURES:
 * - Fetches open calls from API on mount
 * - Listens to SignalR for real-time updates:
 *   - NewCallAvailable: Adds new call to the list
 *   - CallAssigned: Removes call from the list (someone took it)
 *   - CallUnassigned: Adds call back to the list (was released)
 * - CLICKING a call:
 *   1. Sends CallAssigned request via SignalR
 *   2. If CallAlreadyAssigned → show alert, stay on this screen
 *   3. If CallAssignmentSuccess → show success alert (driver can view call in Active tab)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    Alert
} from 'react-native';
import * as Location from 'expo-location';
import { ridesAPI } from '../services/apiService';
import signalRService from '../services/signalRService';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDayLabel, formatTime, formatEstimatedDuration } from '../utils/dateHelpers';
import { calculateDistanceToPickup } from '../services/distanceService';

const OpenCallsScreen = () => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const colors = theme.colors;
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Distance tracking state
    const [userLocation, setUserLocation] = useState(null);
    const [distanceCache, setDistanceCache] = useState({}); // { rideId: { distance, duration, loading } }
    const [locationPermission, setLocationPermission] = useState(null);

    const [assigningCallId, setAssigningCallId] = useState(null); // Track which call is being assigned

    // Use refs to avoid stale closure issues with SignalR callbacks
    const assigningCallIdRef = useRef(null);
    const hasShownSuccessRef = useRef(false); // Prevent double alerts

    // Keep the ref in sync with state
    useEffect(() => {
        assigningCallIdRef.current = assigningCallId;
        // Reset success flag when we start a new assignment attempt
        if (assigningCallId !== null) {
            hasShownSuccessRef.current = false;
        }
    }, [assigningCallId]);

    // Request location permission on mount
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationPermission(status === 'granted');

            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                setUserLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
            }
        })();
    }, []);

    // Calculate distance to pickup for a specific call (on-demand)
    const calculateDistance = async (rideId, pickupAddress) => {
        // Get current location or request it
        let location = userLocation;

        if (!location) {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location Required', 'Please enable location to see distance to pickup.');
                return;
            }
            const currentLocation = await Location.getCurrentPositionAsync({});
            location = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude
            };
            setUserLocation(location);
        }

        // Validate we have what we need
        if (!location || !pickupAddress) {
            console.log('Missing location or pickup address');
            return;
        }

        // Mark as loading
        setDistanceCache(prev => ({
            ...prev,
            [rideId]: { loading: true }
        }));

        const result = await calculateDistanceToPickup(location, pickupAddress);
        console.log('Distance calculation result for rideId', rideId, ':', result);

        setDistanceCache(prev => ({
            ...prev,
            [rideId]: {
                loading: false,
                distance: result.distance,
                duration: result.duration,
                error: result.error
            }
        }));
    };

    // Fetch open calls from API
    const fetchOpenCalls = async () => {
        try {
            const driverId = user?.userId || signalRService.getDriverId();
            if (!driverId) {
                console.warn('No driver ID available for fetching open calls');
                setCalls([]);
                return;
            }
            const data = await ridesAPI.getOpen(driverId);
            console.log('Open calls fetched:', data);
            setCalls(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching open calls:', error);
            setCalls([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial fetch and SignalR setup
    useEffect(() => {
        fetchOpenCalls();

        // Listen for new calls
        const unsubNewCall = signalRService.onNewCallReceived((call) => {
            console.log('New call received:', call);
            setCalls(prev => {
                // Avoid duplicates
                if (prev.some(c => c.rideId === call.rideId)) {
                    return prev;
                }
                return [call, ...prev];
            });
        });

        // Listen for assigned calls (remove from list)
        // This fires for ALL drivers when ANY call is assigned
        const unsubAssigned = signalRService.onCallAssigned((data) => {
            console.log('Call assigned event received:', data);

            const currentAssigningId = assigningCallIdRef.current;
            const myDriverId = signalRService.getDriverId();

            // Check if this is the call WE were trying to assign
            if (currentAssigningId === data.rideId) {
                // Check if WE are the one who got assigned
                if (String(data.assignedToDriverId) === String(myDriverId)) {
                    // We got it! Show success alert (if not already shown)
                    if (!hasShownSuccessRef.current) {
                        console.log('We successfully got assigned to call:', data.rideId);
                        hasShownSuccessRef.current = true;
                        setAssigningCallId(null);
                        Alert.alert(
                            'Call Assigned',
                            'This call has been assigned to you. View it in the Active tab.',
                            [{ text: 'OK' }]
                        );
                    }
                } else {
                    // Someone else got it before us
                    console.log('Someone else got the call we were trying to take:', data.rideId);
                    setAssigningCallId(null);
                    Alert.alert(
                        'Call Unavailable',
                        'This call was just taken by another driver.',
                        [{ text: 'OK' }]
                    );
                }
            }

            // Always remove the call from the list (it's no longer available)
            setCalls(prev => prev.filter(call => call.rideId !== data.rideId));
        });

        // Listen for unassigned calls (add back to list) - this is for backward compatibility
        const unsubUnassigned = signalRService.onCallUnassigned((data) => {
            console.log('Call unassigned, adding back:', data);
            // Note: This event is sent to the driver who was removed
            // For adding calls to the list, we listen to CallAvailableAgain below
        });

        // Listen for calls becoming available again (reassigned - add to open calls list)
        const unsubCallAvailable = signalRService.onCallAvailableAgain((data) => {
            console.log('Call available again, adding to list:', data);
            setCalls(prev => {
                // Avoid duplicates
                if (prev.some(c => c.rideId === data.rideId)) {
                    return prev;
                }
                // Reconstruct call object from available data
                const call = {
                    rideId: data.rideId,
                    customerName: data.customerName,
                    customerPhoneNumber: data.customerPhone,
                    route: {
                        pickup: data.pickup,
                        dropOff: data.dropoff,
                        stop1: data.stops?.[0],
                        stop2: data.stops?.[1],
                        stop3: data.stops?.[2],
                        stop4: data.stops?.[3],
                        stop5: data.stops?.[4],
                        stop6: data.stops?.[5],
                        stop7: data.stops?.[6],
                        stop8: data.stops?.[7],
                        stop9: data.stops?.[8],
                        stop10: data.stops?.[9],
                        roundTrip: data.roundTrip
                    },
                    callTime: data.callTime,
                    scheduledFor: data.scheduledFor,
                    cost: data.cost,
                    paymentType: data.paymentType,
                    notes: data.notes
                };
                return [call, ...prev];
            });
        });

        // Listen for when our assignment request is successful
        // This is a direct response to OUR request (Clients.Caller)
        const unsubAssignmentSuccess = signalRService.onCallAssignmentSuccess((data) => {
            console.log('Assignment successful (direct response):', data);
            // Show success alert (if not already shown via CallAssigned broadcast)
            if (!hasShownSuccessRef.current) {
                hasShownSuccessRef.current = true;
                setAssigningCallId(null);
                Alert.alert(
                    'Call Assigned',
                    'This call has been assigned to you. View it in the Active tab.',
                    [{ text: 'OK' }]
                );
            }
        });

        // Listen for when call is already assigned to someone else
        // This is a direct response to OUR request when the call was already taken
        const unsubAlreadyAssigned = signalRService.onCallAlreadyAssigned((data) => {
            console.log('Call already assigned (direct response):', data);
            setAssigningCallId(null);
            Alert.alert(
                'Call Unavailable',
                data.message || 'This call has already been taken by another driver.',
                [{ text: 'OK' }]
            );
            // Remove this call from our list since it's taken
            setCalls(prev => prev.filter(call => call.rideId !== data.rideId));
        });

        // Cleanup listeners on unmount
        return () => {
            unsubNewCall();
            unsubAssigned();
            unsubUnassigned();
            unsubCallAvailable();
            unsubAssignmentSuccess();
            unsubAlreadyAssigned();
        };
    }, []); // Empty deps - we use refs to access current values

    // Pull-to-refresh handler
    const onRefresh = () => {
        setRefreshing(true);
        fetchOpenCalls();
    };

    /**
     * Handle when user clicks on a call to accept it
     * 1. Show loading state on that call card
     * 2. Send assignment request via SignalR
     * 3. Wait for CallAssignmentSuccess or CallAlreadyAssigned response
     */
    const handleCallPress = async (call) => {
        if (assigningCallId) {
            // Already processing another call
            return;
        }

        if (!signalRService.isConnected()) {
            Alert.alert(
                'Connection Error',
                'Not connected to server. Please check your internet connection and try again.',
                [{ text: 'OK' }]
            );
            return;
        }

        try {
            setAssigningCallId(call.rideId);
            console.log('Requesting assignment for call:', call.rideId);
            await signalRService.requestCallAssignment(call.rideId);
            // Response will come via SignalR callbacks (onCallAssignmentSuccess or onCallAlreadyAssigned)
        } catch (error) {
            console.error('Error requesting call assignment:', error);
            setAssigningCallId(null);
            Alert.alert(
                'Error',
                'Failed to request call assignment. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    // Render individual call card
    const renderCallItem = ({ item }) => {
        const isAssigning = assigningCallId === item.rideId;
        const isDisabled = isAssigning || assigningCallId !== null;

        // Count the number of stops
        const stopCount = [item.route?.stop1, item.route?.stop2, item.route?.stop3,
        item.route?.stop4, item.route?.stop5, item.route?.stop6, item.route?.stop7,
        item.route?.stop8, item.route?.stop9, item.route?.stop10]
            .filter(stop => stop && stop.trim() !== '').length;

        return (
            <TouchableOpacity
                style={[styles.callCard, { backgroundColor: colors.card }, isAssigning && styles.callCardAssigning]}
                onPress={() => handleCallPress(item)}
                disabled={isDisabled}
            >
                {isAssigning && (
                    <View style={styles.assigningOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.assigningText}>Taking call...</Text>
                    </View>
                )}

                <View style={styles.callHeader}>
                    <Text style={[styles.customerName, { color: colors.text }]}>{item.customerName || ''}</Text>
                    <View style={styles.timeContainer}>
                        {item.scheduledFor && (
                            <Text style={[styles.dayLabel, { color: colors.primary }]}>{formatDayLabel(item.scheduledFor)}</Text>
                        )}
                        <Text style={[styles.callTime, { color: colors.textSecondary }]}>
                            {item.scheduledFor ? formatTime(item.scheduledFor) : ''}
                        </Text>
                    </View>
                </View>

                <View style={styles.routeContainer}>
                    <View style={styles.routeRow}>
                        <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>📍 Pickup:</Text>
                        <Text style={[styles.routeText, { color: colors.text }]}>{item.route?.pickup || 'N/A'}</Text>
                    </View>
                    {stopCount > 0 && (
                        <View style={styles.routeRow}>
                            <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>📌 Stops:</Text>
                            <Text style={styles.stopCountText}>{stopCount} stop{stopCount > 1 ? 's' : ''}</Text>
                        </View>
                    )}
                    <View style={styles.routeRow}>
                        <Text style={[styles.routeLabel, { color: colors.textSecondary }]}>🏁 Dropoff:</Text>
                        <Text style={[styles.routeText, { color: colors.text }]}>{item.route?.dropOff || 'N/A'}</Text>
                    </View>
                </View>

                <View style={[styles.callFooter, { borderTopColor: colors.divider }]}>
                    <View style={styles.priceSection}>
                        <Text style={styles.cost}>
                            {item.cost ? `$${item.cost.toFixed(2)}` : 'Price TBD'}
                        </Text>
                        <Text style={[styles.paymentType, { backgroundColor: colors.background, color: colors.textSecondary }]}>
                            {item.paymentType || 'Cash'}
                        </Text>
                    </View>
                    <View style={styles.rightSection}>
                        {formatEstimatedDuration(item.estimatedDuration) && (
                            <Text style={[styles.tripDuration, { color: colors.primary }]}>
                                🕐 {formatEstimatedDuration(item.estimatedDuration)}
                            </Text>
                        )}
                        {/* Distance to pickup - on-demand */}
                        {distanceCache[item.rideId]?.loading ? (
                            <ActivityIndicator size="small" color={colors.primary} style={styles.distanceLoader} />
                        ) : distanceCache[item.rideId]?.duration && distanceCache[item.rideId]?.duration ? (
                            <>
                                <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                                    🚗 {distanceCache[item.rideId].duration} away
                                </Text>
                                <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                                    📍 {distanceCache[item.rideId].distance} away
                                </Text>
                            </>
                        ) : (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    calculateDistance(item.rideId, item.route?.pickup);
                                }}
                                style={styles.distanceButton}
                            >
                                <Text style={[styles.distanceButtonText, { color: colors.primary }]}>
                                    Show distance to Pickup
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Tap hint */}
                <View style={styles.tapHint}>
                    <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to accept</Text>
                </View>
            </TouchableOpacity>
        );
    };

    // Empty state
    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No open calls available</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Pull down to refresh</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading calls...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={calls}
                keyExtractor={(item) => String(item.rideId)}
                renderItem={renderCallItem}
                contentContainerStyle={calls.length === 0 ? styles.emptyList : styles.list}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
            />
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
    list: {
        padding: 15,
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    callCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    callHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    customerName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    timeContainer: {
        alignItems: 'flex-end',
    },
    dayLabel: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
        marginBottom: 2,
    },
    callTime: {
        fontSize: 14,
        color: '#666',
    },
    routeContainer: {
        marginBottom: 10,
    },
    routeRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    routeLabel: {
        fontSize: 14,
        color: '#666',
        width: 80,
    },
    routeText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
    },
    stopCountText: {
        fontSize: 14,
        color: '#e67e22',
        fontWeight: '600',
        flex: 1,
    },
    notes: {
        fontSize: 13,
        color: '#666',
        fontStyle: 'italic',
        marginBottom: 10,
    },
    callFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10,
    },
    priceSection: {
        flexDirection: 'column',
    },
    rightSection: {
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    cost: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2ecc71',
    },
    tripDuration: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 4,
    },
    distanceText: {
        fontSize: 13,
    },
    distanceButton: {
        paddingVertical: 2,
    },
    distanceButtonText: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    distanceLoader: {
        marginTop: 4,
    },
    paymentType: {
        fontSize: 14,
        color: '#666',
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginTop: 4,
        alignSelf: 'flex-start',
        borderRadius: 12,
    },
    emptyContainer: {
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 15,
    },
    emptyText: {
        fontSize: 18,
        color: '#666',
        marginBottom: 5,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
    },
    // Styles for call assignment state
    callCardAssigning: {
        opacity: 0.7,
    },
    callCardDisabled: {
        opacity: 0.5,
    },
    assigningOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 122, 255, 0.8)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    assigningText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8,
    },
    tapHint: {
        marginTop: 8,
        alignItems: 'center',
    },
    tapHintText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '500',
    },
});

export default OpenCallsScreen;
