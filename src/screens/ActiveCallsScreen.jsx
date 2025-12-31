/**
 * ActiveCallsScreen.jsx
 * 
 * Displays a list of all active calls assigned to this driver that have not been dropped off.
 * This is the main screen for viewing and managing the driver's current workload.
 * 
 * FEATURES:
 * - Fetches calls from /api/Ride/AssignedRidesByDriver
 * - Groups calls by day (Today, Tomorrow, specific dates)
 * - Each day group is collapsible
 * - Shows list ordered by scheduledFor (soonest first)
 * - Each call card shows status chip (Assigned, Picked Up, etc.)
 * - Click on a call opens CurrentCallScreen
 * - Pull to refresh
 * - Real-time updates via SignalR (assigned, unassigned, canceled)
 * 
 * STATUS CHIPS:
 * - "Assigned" - Call assigned but not picked up (blue)
 * - "Picked Up" - Customer picked up (green)
 * 
 * PROPS:
 * - onCallSelect: Function called with rideId when a call is clicked
 * - onRefresh: Optional callback when refresh completes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    ActivityIndicator
} from 'react-native';
import { ridesAPI } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import signalRService from '../services/signalRService';
import { formatTime, formatEstimatedDuration, formatDate, formatTimeOnly } from '../utils/dateHelpers';

/**
 * Helper to format day label for grouping
 * Returns "Today", "Tomorrow", or the full date
 */
const getDayKey = (dateString) => {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Reset time for comparison
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) {
        return 'Today';
    } else if (compareDate.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else {
        // Return formatted date for grouping key
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
};


/**
 * Determine the status of a ride based on its data
 */
const getRideStatus = (ride) => {
    if (!ride.pickupTime) {
        return { label: 'Assigned', color: '#2196F3', bgColor: '#E3F2FD' };
    }

    return { label: 'Picked Up', color: '#4CAF50', bgColor: '#E8F5E9' };
};

/**
 * Group calls by day
 */
const groupCallsByDay = (calls) => {
    if (!calls || calls.length === 0) return [];

    const groups = {};

    calls.forEach(call => {
        const dayKey = getDayKey(call.scheduledFor || call.callTime);
        if (!groups[dayKey]) {
            groups[dayKey] = {
                dayKey,
                date: new Date(call.scheduledFor || call.callTime),
                calls: []
            };
        }
        groups[dayKey].calls.push(call);
    });

    // Convert to array and sort by date (earliest first)
    return Object.values(groups).sort((a, b) => a.date - b.date);
};

const ActiveCallsScreen = ({ onCallSelect, onRefresh, onCountChange }) => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const colors = theme.colors;
    const [calls, setCalls] = useState([]);
    const [dayGroups, setDayGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedDays, setExpandedDays] = useState({});

    /**
     * Fetch active calls for this driver
     */
    const fetchActiveCalls = useCallback(async () => {
        try {
            const data = await ridesAPI.getAssignedByDriver(user.userId);
            console.log('Fetched active calls:', data?.length || 0, 'calls');

            // Sort by scheduledFor (upcoming/soonest first, then later calls)
            const sorted = (data || []).sort((a, b) => {
                const dateA = new Date(a.scheduledFor || a.callTime);
                const dateB = new Date(b.scheduledFor || b.callTime);
                return dateA - dateB; // Earlier dates first
            });

            setCalls(sorted);

            // Notify parent of count change
            if (onCountChange) {
                onCountChange(sorted.length);
            }

            // Group by day
            const groups = groupCallsByDay(sorted);
            setDayGroups(groups);

            // Auto-expand the first day (Today or earliest)
            if (groups.length > 0 && Object.keys(expandedDays).length === 0) {
                setExpandedDays({ [groups[0].dayKey]: true });
            }
        } catch (error) {
            console.error('Error fetching active calls:', error);
            setCalls([]);
            setDayGroups([]);
            if (onCountChange) {
                onCountChange(0);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.userId, onCountChange]);

    // Initial load
    // Fetch calls on mount
    useEffect(() => {
        fetchActiveCalls();
    }, [fetchActiveCalls]);

    // Set up SignalR listeners - DO NOT cleanup (persist across tab switches)
    useEffect(() => {
        // Listen for new pre-assigned calls (calls assigned to us at creation)
        const unsubscribeNewCall = signalRService.onNewCallReceived((call) => {
            // Check if this call is pre-assigned to us
            const myDriverId = user?.userId;
            const isPreassignedToMe = call.assignedToId && String(call.assignedToId) === String(myDriverId);

            if (isPreassignedToMe) {
                console.log('New pre-assigned call received, refreshing active calls list:', call.rideId);
                fetchActiveCalls();
            }
        });

        // When driver is assigned a new call, refresh the list
        const unsubscribeAssigned = signalRService.onCallAssigned((data) => {
            console.log('Call assigned to me, refreshing active calls list');
            fetchActiveCalls();
        });

        // When driver is unassigned from a call, refresh the list
        const unsubscribeUnassigned = signalRService.onCallUnassigned((data) => {
            console.log('Call unassigned from me, refreshing active calls list');
            fetchActiveCalls();
        });

        // When a call is canceled, refresh the list
        const unsubscribeCanceled = signalRService.onCallCanceled((data) => {
            console.log('Call canceled, refreshing active calls list');
            fetchActiveCalls();
        });

        // DO NOT cleanup listeners - they should persist across tab switches
        // Only cleanup when component is truly destroyed (app logout)
        return () => {
            // NO-OP - listeners persist
        };
    }, [fetchActiveCalls, user?.userId]); // Include fetchActiveCalls so we use the latest version

    /**
     * Toggle day group expansion
     */
    const toggleDayExpanded = (dayKey) => {
        setExpandedDays(prev => ({
            ...prev,
            [dayKey]: !prev[dayKey]
        }));
    };

    /**
     * Handle pull to refresh
     */
    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchActiveCalls();
        onRefresh?.();
    }, [fetchActiveCalls, onRefresh]);

    /**
     * Handle clicking on a call card
     */
    const handleCallPress = (rideId) => {
        console.log('Opening call:', rideId);
        onCallSelect?.(rideId);
    };

    /**
     * Render a single call card
     */
    const renderCallCard = (item) => {
        const status = getRideStatus(item);
        const timeLabel = formatTime(item.scheduledFor || item.callTime);
        const stopCount = [item.route?.stop1, item.route?.stop2, item.route?.stop3,
        item.route?.stop4, item.route?.stop5, item.route?.stop6, item.route?.stop7,
        item.route?.stop8, item.route?.stop9, item.route?.stop10]
            .filter(stop => stop && stop.trim() !== '').length;

        return (
            <TouchableOpacity
                key={item.rideId}
                style={[styles.callCard, { backgroundColor: colors.card }]}
                onPress={() => handleCallPress(item.rideId)}
                activeOpacity={0.7}
            >
                {/* Header with customer name and status chip */}
                <View style={styles.cardHeader}>
                    <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                        {item.customerName || ''}
                    </Text>
                    <View style={[styles.statusChip, { backgroundColor: status.bgColor }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>
                            {status.label}
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

                {/* Time */}
                <View style={styles.timeRow}>
                    <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>🕐 {timeLabel}</Text>
                </View>

                {/* Route info */}
                <View style={styles.routeSection}>
                    <View style={styles.routeRow}>
                        <Text style={styles.routeIcon}>📍</Text>
                        <Text style={[styles.routeText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.route?.pickup || 'No pickup address'}
                        </Text>
                    </View>
                    {stopCount >= 1 && (
                        <View style={styles.routeRow}>
                            <Text style={styles.routeIcon}>📌</Text>
                            <Text style={[styles.routeText, { color: colors.textSecondary }]}>{stopCount} Stop{stopCount !== 1 ? 's' : ''}</Text>
                        </View>
                    )}
                    <View style={styles.routeRow}>
                        <Text style={styles.routeIcon}>🏁</Text>
                        <Text style={[styles.routeText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.route?.dropOff || 'No dropoff address'}
                        </Text>
                    </View>
                </View>

                {/* Payment info */}
                <View style={[styles.paymentRow, { borderTopColor: colors.divider }]}>
                    <Text style={styles.paymentLabel}>
                        💰 ${item.cost?.toFixed(2) || '0.00'}
                    </Text>
                    {item.carSeat && (
                        <View style={styles.carSeatChip}>
                            <Text style={styles.carSeatChipText}>🚼</Text>
                        </View>
                    )}
                    {formatEstimatedDuration(item.route?.estimatedDuration) && (
                        <Text style={[styles.tripDuration, { color: colors.primary }]}>
                            🕐 {formatEstimatedDuration(item.route?.estimatedDuration)}
                        </Text>
                    )}
                    <Text style={[styles.paymentType, { backgroundColor: colors.background, color: colors.textSecondary }]}>
                        {item.paymentType?.toUpperCase() || 'CASH'}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    /**
     * Render a day group with collapsible header
     */
    const renderDayGroup = ({ item: group }) => {
        const isExpanded = expandedDays[group.dayKey] || false;
        const callCount = group.calls.length;

        return (
            <View style={styles.dayGroup}>
                {/* Day Header - Tappable to expand/collapse */}
                <TouchableOpacity
                    style={[styles.dayHeader, { backgroundColor: colors.primary }]}
                    onPress={() => toggleDayExpanded(group.dayKey)}
                    activeOpacity={0.7}
                >
                    <View style={styles.dayHeaderLeft}>
                        <Text style={styles.dayHeaderIcon}>{isExpanded ? '▼' : '▶'}</Text>
                        <Text style={styles.dayHeaderTitle}>{group.dayKey}</Text>
                    </View>
                    <View style={styles.dayHeaderRight}>
                        <Text style={styles.dayCallCount}>
                            {callCount} {callCount === 1 ? 'call' : 'calls'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Calls list (shown when expanded) */}
                {isExpanded && (
                    <View style={styles.callsContainer}>
                        {group.calls.map(call => renderCallCard(call))}
                    </View>
                )}
            </View>
        );
    };

    /**
     * Render empty state
     */
    const renderEmpty = () => {
        if (loading) return null;

        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Calls</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Accept calls from the Open Calls tab to see them here
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your calls...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>My Active Calls</Text>
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                    {calls.length} {calls.length === 1 ? 'call' : 'calls'}
                </Text>
            </View>

            {/* Day groups list */}
            <FlatList
                data={dayGroups}
                keyExtractor={(item) => item.dayKey}
                renderItem={renderDayGroup}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#007AFF']}
                        tintColor="#007AFF"
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
        fontSize: 16,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
    },
    headerCount: {
        fontSize: 14,
        color: '#666',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100, // Extra padding for bottom navigation
    },
    dayGroup: {
        marginBottom: 16,
    },
    dayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
    },
    dayHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dayHeaderIcon: {
        fontSize: 12,
        color: '#fff',
        marginRight: 10,
    },
    dayHeaderTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    dayHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dayCallCount: {
        fontSize: 14,
        color: '#fff',
        opacity: 0.9,
    },
    callsContainer: {
        marginTop: 8,
    },
    callCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    customerName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        flex: 1,
        marginRight: 8,
    },
    statusChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    timeLabel: {
        fontSize: 14,
        color: '#666',
    },
    routeSection: {
        marginBottom: 12,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    routeIcon: {
        fontSize: 14,
        marginRight: 8,
        width: 20,
    },
    routeText: {
        fontSize: 14,
        color: '#555',
        flex: 1,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    paymentLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4CAF50',
    },
    tripDuration: {
        fontSize: 14,
        fontWeight: '500',
    },
    paymentType: {
        fontSize: 12,
        color: '#666',
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    carSeatChip: {
        backgroundColor: '#ffb4b4ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fd0202ff',
    },
    carSeatChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#D2691E',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 40,
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
});

export default ActiveCallsScreen;
