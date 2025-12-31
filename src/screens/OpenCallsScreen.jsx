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
    ActivityIndicator
} from 'react-native';
import * as Location from 'expo-location';
import { ridesAPI, carsAPI } from '../services/apiService';
import signalRService from '../services/signalRService';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { formatDayLabel, formatTime, formatEstimatedDuration, formatTimeOnly, formatDate } from '../utils/dateHelpers';
import { calculateDistanceToPickup } from '../services/distanceService';

/**
 * OpenCallsScreen - Displays available calls for the driver
 * 
 * Props:
 * @param {number} scrollToRideId - Optional. If set, scroll to this ride and highlight it
 * @param {function} onScrollComplete - Optional. Called after scrolling is complete
 * @param {function} onNavigateToCars - Optional. Callback to navigate to car management
 */
const OpenCallsScreen = ({ scrollToRideId, onScrollComplete, onNavigateToCars }) => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const { showAlert, showToast } = useAlert();
    const colors = theme.colors;
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Car status - to check if driver has a primary car
    const [hasPrimaryCar, setHasPrimaryCar] = useState(true); // Assume true until checked
    const [carsLoading, setCarsLoading] = useState(true);

    // Distance tracking state
    const [userLocation, setUserLocation] = useState(null);
    const [distanceCache, setDistanceCache] = useState({}); // { rideId: { distance, duration, loading } }
    const [locationPermission, setLocationPermission] = useState(null);

    const [assigningCallId, setAssigningCallId] = useState(null); // Track which call is being assigned

    // Highlighted call state (for push notification scroll-to)
    const [highlightedRideId, setHighlightedRideId] = useState(null);

    // Ref for the FlatList to enable scrolling
    const flatListRef = useRef(null);

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

    // Check if driver has cars with a primary car set
    useEffect(() => {
        const checkDriverCars = async () => {
            try {
                const driverId = user?.userId || signalRService.getDriverId();
                if (!driverId) {
                    setCarsLoading(false);
                    setHasPrimaryCar(false);
                    return;
                }

                const response = await carsAPI.getByDriver(driverId);
                // API returns 204 (No Content) when no cars, so response may be undefined/empty
                const cars = Array.isArray(response) ? response : [];
                const primaryCar = cars.find(car => car.isPrimary);
                console.log('Driver cars fetched:', cars);
                setHasPrimaryCar(!!primaryCar);
                console.log('Driver cars check:', { totalCars: cars.length, hasPrimary: !!primaryCar });
            } catch (error) {
                console.error('Error checking driver cars:', error);
                // On error, assume they have cars to avoid blocking
                setHasPrimaryCar(true);
            } finally {
                setCarsLoading(false);
            }
        };

        checkDriverCars();
    }, [user?.userId]);

    // Calculate distance to pickup for a specific call (on-demand)
    const calculateDistance = async (rideId, pickupAddress) => {
        // Get current location or request it
        let location = userLocation;

        if (!location) {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Location Required', 'Please enable location to see distance to pickup.', [{ text: 'OK' }]);
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
            //console.log('Open calls fetched:', data);
            const sortedData = Array.isArray(data)
                ? data.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
                : [];
            setCalls(sortedData);
        } catch (error) {
            console.error('Error fetching open calls:', error);
            setCalls([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Handle scroll-to-ride from push notification
    // When scrollToRideId is set, find the ride and scroll to it
    useEffect(() => {
        if (scrollToRideId && calls.length > 0 && flatListRef.current) {
            // Find the index of the ride to scroll to
            const rideIndex = calls.findIndex(call => call.rideId === scrollToRideId);

            if (rideIndex !== -1) {
                console.log(`📱 Scrolling to ride ${scrollToRideId} at index ${rideIndex}`);

                // Scroll to the item with a small delay to ensure list is rendered
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                        index: rideIndex,
                        animated: true,
                        viewPosition: 0.3 // Position near top but not at very top
                    });

                    // Highlight the item briefly
                    setHighlightedRideId(scrollToRideId);

                    // Remove highlight after 3 seconds
                    setTimeout(() => {
                        setHighlightedRideId(null);
                    }, 3000);
                }, 300);
            } else {
                console.log(`📱 Ride ${scrollToRideId} not found in list - may have been taken`);
                showToast('This call may have already been taken by another driver.', 'warning');
            }

            // Notify parent that scroll is complete
            if (onScrollComplete) {
                onScrollComplete();
            }
        }
    }, [scrollToRideId, calls, onScrollComplete]);

    // Initial fetch on mount
    useEffect(() => {
        fetchOpenCalls();
    }, []);

    // SignalR setup - DO NOT cleanup listeners (persist across tab switches)
    useEffect(() => {
        // Listen for new calls
        const unsubNewCall = signalRService.onNewCallReceived((call) => {
            console.log('New call received:', call);

            // Check if this call is pre-assigned to us
            // Pre-assigned calls should go to Active calls, not Open calls
            const myDriverId = user?.userId || signalRService.getDriverId();
            const isPreassignedToMe = call.assignedToId && String(call.assignedToId) === String(myDriverId);

            if (isPreassignedToMe) {
                console.log('Call is pre-assigned to us, not adding to Open calls:', call.rideId);
                // Don't add to open calls - it will show in Active calls
                return;
            }

            setCalls(prev => {
                // Avoid duplicates
                if (prev.some(c => c.rideId === call.rideId)) {
                    return prev;
                }
                return [...prev, call].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
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
                        showToast('Call assigned! View it in the Active tab.', 'success');
                        // Reload open calls to filter out any now-overlapping calls
                        fetchOpenCalls();
                    }
                } else {
                    // Someone else got it before us
                    console.log('Someone else got the call we were trying to take:', data.rideId);
                    setAssigningCallId(null);
                    showToast('This call was just taken by another driver.', 'warning');
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

        // Listen for canceled calls (remove from list)
        const unsubCanceled = signalRService.onCallCanceled((data) => {
            console.log('Call canceled, removing from list:', data);
            // Remove the canceled call from the open calls list
            setCalls(prev => prev.filter(call => call.rideId !== data.rideId));
        });

        // Listen for calls becoming available again (reassigned - add to open calls list)
        const unsubCallAvailable = signalRService.onCallAvailableAgain((data) => {
            console.log('Call available again, adding to list:', data);
            setCalls(prev => {
                // Avoid duplicates
                if (prev.some(c => c.rideId === data.rideId)) {
                    return prev;
                }
                // Server sends the full Ride object, so we can use it directly
                // Just normalize the property names to match what the UI expects (lowercase first letter)
                const call = {
                    rideId: data.rideId,
                    customerName: data.customerName,
                    customerPhoneNumber: data.customerPhoneNumber,
                    route: data.route, // Full route object already included
                    callTime: data.callTime,
                    scheduledFor: data.scheduledFor,
                    cost: data.cost,
                    paymentType: data.paymentType,
                    notes: data.notes,
                    passengers: data.passengers,
                    carType: data.carType,
                    estimatedDuration: data.route?.estimatedDuration
                };
                return [...prev, call].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
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
                showToast('Call assigned! View it in the Active tab.', 'success');
                // Reload open calls to filter out any now-overlapping calls
                fetchOpenCalls();
            }
        });

        // Listen for when call is already assigned to someone else
        // This is a direct response to OUR request when the call was already taken
        const unsubAlreadyAssigned = signalRService.onCallAlreadyAssigned((data) => {
            console.log('Call already assigned (direct response):', data);
            setAssigningCallId(null);
            showToast(data.message || 'This call has already been taken by another driver.', 'warning');
            // Remove this call from our list since it's taken
            setCalls(prev => prev.filter(call => call.rideId !== data.rideId));
        });

        // DO NOT cleanup listeners - they should persist across tab switches
        // Only cleanup when component is truly destroyed (app logout)
        return () => {
            // NO-OP - listeners persist
        };
    }, []); // Empty deps - set up once and never cleanup

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
            showAlert(
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
            showAlert(
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
        const isHighlighted = highlightedRideId === item.rideId;

        // Count the number of stops
        const stopCount = [item.route?.stop1, item.route?.stop2, item.route?.stop3,
        item.route?.stop4, item.route?.stop5, item.route?.stop6, item.route?.stop7,
        item.route?.stop8, item.route?.stop9, item.route?.stop10]
            .filter(stop => stop && stop.trim() !== '').length;

        // Check if distance is already calculated for this call
        const hasDistance = distanceCache[item.rideId]?.duration && distanceCache[item.rideId]?.distance;
        const isLoadingDistance = distanceCache[item.rideId]?.loading;

        return (
            <View
                style={[
                    styles.callCard,
                    { backgroundColor: colors.card },
                    isAssigning && styles.callCardAssigning,
                    isHighlighted && { borderColor: colors.primary, borderWidth: 3 }
                ]}
            >
                {/* Highlight badge for push notification scroll */}
                {isHighlighted && (
                    <View style={[styles.highlightBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.highlightBadgeText}>📍 New Call</Text>
                    </View>
                )}

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

                {/* Recurring Ride Badge */}
                {item.isRecurring && (
                    <View style={styles.recurringBadge}>
                        <Text style={styles.recurringBadgeText}>🔁 RECURRING RIDE</Text>
                        {item.recurring && (
                            <Text style={styles.recurringDetails}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item.recurring.dayOfWeek]} at {formatTimeOnly(item.recurring.time)} until {formatDate(item.recurring.endDate)}
                            </Text>
                        )}
                    </View>
                )}

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
                        {item.carSeat && (
                            <View style={styles.carSeatChip}>
                                <Text style={styles.carSeatChipText}>🚼 Car Seat</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.rightSection}>
                        <Text style={[styles.paymentType, { backgroundColor: colors.background, color: colors.textSecondary }]}>
                            {item.paymentType || 'Cash'}
                        </Text>
                        {formatEstimatedDuration(item.route?.estimatedDuration) && (
                            <Text style={[styles.tripDuration, { color: colors.primary }]}>
                                🕐 {formatEstimatedDuration(item.route?.estimatedDuration)}
                            </Text>
                        )}
                        {/* Show distance info if already calculated */}
                        {hasDistance && (
                            <>
                                <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                                    🚗 {distanceCache[item.rideId].duration} away
                                </Text>
                                <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                                    📍 {distanceCache[item.rideId].distance}
                                </Text>
                            </>
                        )}
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtonsRow}>
                    {/* Accept Button - Green */}
                    <TouchableOpacity
                        style={[styles.acceptButton, isDisabled && styles.buttonDisabled]}
                        onPress={() => handleCallPress(item)}
                        disabled={isDisabled}
                    >
                        {isAssigning ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.acceptButtonText}>✓ Accept</Text>
                        )}
                    </TouchableOpacity>

                    {/* Show Distance Button - Blue */}
                    <TouchableOpacity
                        style={[styles.distanceActionButton, isLoadingDistance && styles.buttonDisabled]}
                        onPress={() => calculateDistance(item.rideId, item.route?.pickup)}
                        disabled={isLoadingDistance}
                    >
                        {isLoadingDistance ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.distanceActionButtonText}>
                                {hasDistance ? '↻ Refresh' : '📍 Distance'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
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

    // No cars / no primary car state
    const renderNoCarsState = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No Vehicle Set Up</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20 }]}>
                You need to add a car and set it as your primary vehicle before you can see and accept calls.
            </Text>
            {onNavigateToCars && (
                <TouchableOpacity
                    style={[styles.addCarButton, { backgroundColor: colors.primary }]}
                    onPress={onNavigateToCars}
                >
                    <Text style={styles.addCarButtonText}>Add a Car</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading || carsLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading calls...</Text>
            </View>
        );
    }

    // Show "no cars" message if driver doesn't have a primary car
    if (!hasPrimaryCar) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {renderNoCarsState()}
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                ref={flatListRef}
                data={calls}
                keyExtractor={(item) => String(item.rideId)}
                renderItem={renderCallItem}
                contentContainerStyle={calls.length === 0 ? styles.emptyList : styles.list}
                ListEmptyComponent={renderEmptyState}
                scrollEnabled={!assigningCallId}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        enabled={!assigningCallId}
                    />
                }
                // Handle scroll to index failures gracefully
                onScrollToIndexFailed={(info) => {
                    console.log('Scroll to index failed:', info);
                    // Scroll to approximate position based on average item height
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: true
                    });
                }}
            />
            {/* Blocking overlay when assigning a call */}
            {assigningCallId && (
                <View style={styles.blockingOverlay}>
                    <View style={styles.overlayContent}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.overlayText, { color: colors.text }]}>Accepting call...</Text>
                    </View>
                </View>
            )}
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
    recurringBadge: {
        backgroundColor: '#FFF3E0',
        borderLeftWidth: 4,
        borderLeftColor: '#FF9800',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginTop: 10,
        marginBottom: 5,
        borderRadius: 4,
    },
    recurringBadgeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#E65100',
        marginBottom: 2,
    },
    recurringDetails: {
        fontSize: 12,
        color: '#EF6C00',
        fontWeight: '600',
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
    carSeatChip: {
        backgroundColor: '#ffb4b4ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ff0000ff',
        marginLeft: 8,
    },
    carSeatChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#d21e1eff',
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
    addCarButton: {
        marginTop: 20,
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 10,
    },
    addCarButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
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
    // Highlight badge for push notification scroll-to
    highlightBadge: {
        position: 'absolute',
        top: -10,
        right: 10,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 10,
    },
    highlightBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // Action buttons row
    actionButtonsRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 10,
    },
    acceptButton: {
        flex: 1,
        backgroundColor: '#2ecc71',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    distanceActionButton: {
        flex: 1,
        backgroundColor: '#3498db',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceActionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    blockingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    overlayContent: {
        backgroundColor: '#fff',
        padding: 30,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    overlayText: {
        marginTop: 15,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default OpenCallsScreen;
