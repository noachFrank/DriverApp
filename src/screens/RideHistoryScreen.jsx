/**
 * RideHistoryScreen.jsx
 * 
 * PURPOSE:
 * Displays the driver's ride history (completed rides) grouped by week.
 * Each week is collapsible to show/hide the rides within that week.
 * 
 * HOW IT WORKS:
 * 1. On mount, fetches all completed rides from /api/Ride/DriverRideHistory
 * 2. Groups rides by week (Sunday to Saturday)
 * 3. Displays weeks as collapsible sections with ride details inside
 * 4. Most recent week appears first
 * 
 * DATA STRUCTURE:
 * - Ride object from server has: RideId, CustomerName, CallTime, PickupTime, 
 *   DropOffTime, Cost, DriversCompensation, Route (with RouteName), etc.
 * 
 * UI COMPONENTS:
 * - FlatList for efficient scrolling
 * - TouchableOpacity for collapsible week headers
 * - Card-style UI for each ride
 * 
 * WEEK GROUPING LOGIC:
 * - Uses getWeekStart() to find the Sunday of each ride's week
 * - Groups rides by that week's start date
 * - Sorts weeks in descending order (newest first)
 * - Sorts rides within each week by CallTime (newest first)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ridesAPI } from '../services/apiService';
import { formatDate, formatTime } from '../utils/dateHelpers';

const RideHistoryScreen = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const colors = theme.colors;

    // State for rides data
    const [weeklyGroups, setWeeklyGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Track which weeks are expanded (default: first week expanded)
    const [expandedWeeks, setExpandedWeeks] = useState({});

    const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
        d.setDate(d.getDate() - day); // Go back to Sunday
        d.setHours(0, 0, 0, 0); // Set to midnight
        return d;
    };

    const formatWeekRange = (weekStart) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // Saturday

        const options = { month: 'short', day: 'numeric' };
        const startStr = weekStart.toLocaleDateString('en-US', options);
        const endStr = weekEnd.toLocaleDateString('en-US', options);
        const year = weekEnd.getFullYear();

        return `${startStr} - ${endStr}, ${year}`;
    };

    const groupRidesByWeek = (rides) => {
        if (!rides || rides.length === 0) return [];

        // Create a map of weekKey -> rides array
        const weekMap = {};

        rides.forEach(ride => {
            // Handle both camelCase and PascalCase from server
            const scheduledFor = ride.scheduledFor;
            if (!scheduledFor) return;

            const weekStart = getWeekStart(new Date(scheduledFor));
            const weekKey = weekStart.toISOString(); // Unique key for this week

            if (!weekMap[weekKey]) {
                weekMap[weekKey] = {
                    weekKey,
                    weekStart,
                    weekLabel: formatWeekRange(weekStart),
                    rides: [],
                    totalEarnings: 0,
                };
            }

            weekMap[weekKey].rides.push(ride);
            // Add driver's compensation to total (handle both cases)
            const compensation = ride.driversCompensation || ride.DriversCompensation || 0;
            weekMap[weekKey].totalEarnings += compensation;
        });

        // Convert to array and sort by week (newest first)
        const sorted = Object.values(weekMap).sort((a, b) =>
            new Date(b.weekStart) - new Date(a.weekStart)
        );

        // Sort rides within each week (newest first)
        sorted.forEach(week => {
            week.rides.sort((a, b) => {
                const aTime = new Date(a.scheduledFor);
                const bTime = new Date(b.scheduledFor);
                return bTime - aTime;
            });
        });

        return sorted;
    };

    const fetchHistory = async () => {
        if (!user?.userId) {
            setError('User not logged in');
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const rides = await ridesAPI.getDriverHistory(user.userId);
            console.log('Fetched ride history:', rides?.length || 0, 'rides');

            const grouped = groupRidesByWeek(rides || []);
            setWeeklyGroups(grouped);

            // Auto-expand the first (most recent) week
            if (grouped.length > 0) {
                setExpandedWeeks({ [grouped[0].weekKey]: true });
            }
        } catch (err) {
            console.error('Error fetching ride history:', err);
            if (err.response?.status === 204) {
                // No content - no rides yet
                setWeeklyGroups([]);
            } else {
                setError('Failed to load ride history');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch on mount
    useEffect(() => {
        fetchHistory();
    }, [user?.userId]);

    // Pull to refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchHistory();
    }, [user?.userId]);

    const toggleWeek = (weekKey) => {
        setExpandedWeeks(prev => ({
            ...prev,
            [weekKey]: !prev[weekKey]
        }));
    };


    const renderRide = (ride) => {
        // Handle both camelCase and PascalCase
        const rideId = ride.rideId || ride.RideId;
        const customerName = ride.customerName || ride.CustomerName || '';
        const callTime = ride.callTime || ride.CallTime;
        const scheduledFor = ride.scheduledFor;
        const pickupTime = ride.pickupTime || ride.PickupTime;
        const dropOffTime = ride.dropOffTime || ride.DropOffTime;
        const cost = ride.cost || ride.Cost || 0;
        const compensation = ride.driversCompensation || ride.DriversCompensation || 0;
        const route = ride.route || ride.Route;
        const stopCount = [route?.stop1, route?.stop2, route?.stop3, route?.stop4,
        route?.stop5, route?.stop6, route?.stop7, route?.stop8,
        route?.stop9, route?.stop10]
            .filter(stop => stop && stop.trim() !== '').length;

        return (
            <View key={rideId} style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
                <View style={styles.rideHeader}>
                    <Text style={styles.addressIcon}>📍</Text>
                    <Text style={[styles.routeName, { color: colors.text }]}>{` ${route.pickup}`}</Text>
                </View>
                <View style={styles.rideHeader} >
                    {stopCount >= 1 &&
                        <>
                            <Text style={styles.addressIcon}>📌</Text>
                            <Text style={[styles.routeName, { color: colors.text }]}>{` ${stopCount} Stop${stopCount !== 1 ? 's' : ''}`}</Text>
                        </>}
                </View>
                <View style={styles.rideHeader} >
                    <Text style={styles.addressIcon}>🏁</Text>
                    <Text style={[styles.routeName, { color: colors.text }]}>{` ${route.dropOff}`}</Text>
                </View>

                <View style={styles.rideHeader} >
                    <Text style={[styles.customerName, { color: colors.text }]} > {customerName}</Text >
                    <Text style={[styles.rideDate, { color: colors.textSecondary }]}>{formatDate(scheduledFor)}</Text>
                </View>

                {/* Times row */}
                < View style={[styles.timesRow, { borderTopColor: colors.divider }]} >
                    {/* <View style={styles.timeBlock}>
                        <Text style={styles.timeLabel}>Called</Text>
                        <Text style={styles.timeValue}>{formatTime(callTime)}</Text>
                    </View> */}
                    <View style={styles.timeBlock}>
                        <Text style={[styles.timeLabel, { color: colors.textMuted }]}>Call Time</Text>
                        <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(scheduledFor)}</Text>
                    </View>
                    <View style={styles.timeBlock}>
                        <Text style={[styles.timeLabel, { color: colors.textMuted }]}>Pickup Time</Text>
                        <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(pickupTime)}</Text>
                    </View>
                    <View style={styles.timeBlock}>
                        <Text style={[styles.timeLabel, { color: colors.textMuted }]}>Drop-off Time</Text>
                        <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(dropOffTime)}</Text>
                    </View>
                </View >

                {/* Earnings */}
                < View style={[styles.earningsRow, { borderTopColor: colors.divider }]} >
                    <View style={styles.earningsLeft}>
                        <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>Cost:</Text>
                        <Text style={[styles.costValue, { color: colors.text }]}>${cost}</Text>
                    </View>
                    <View style={styles.earningsRight}>
                        <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>Earnings:</Text>
                        <Text style={styles.earningsValue}>${compensation}</Text>
                    </View>
                </View >
            </View >
        );
    };

    const renderWeek = ({ item: week }) => {
        const isExpanded = expandedWeeks[week.weekKey] || false;

        return (
            <View style={styles.weekContainer}>
                {/* Week Header - Tappable to expand/collapse */}
                <TouchableOpacity
                    style={[styles.weekHeader, { backgroundColor: colors.primary }]}
                    onPress={() => toggleWeek(week.weekKey)}
                    activeOpacity={0.7}
                >
                    <View style={styles.weekHeaderLeft}>
                        <Text style={styles.expandIcon}>
                            {isExpanded ? '▼' : '▶'}
                        </Text>
                        <Text style={styles.weekLabel}>{week.weekLabel}</Text>
                    </View>
                    <View style={styles.weekHeaderRight}>
                        <Text style={styles.rideCount}>
                            {week.rides.length} ride{week.rides.length !== 1 ? 's' : ''}
                        </Text>
                        <Text style={styles.weekEarnings}>
                            ${week.totalEarnings}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Rides list - only shown when expanded */}
                {isExpanded && (
                    <View style={styles.ridesContainer}>
                        {week.rides.map(renderRide)}
                    </View>
                )}
            </View>
        );
    };

    // Loading state
    if (loading) {
        return (
            <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading ride history...</Text>
            </View>
        );
    }

    // Error state
    if (error) {
        return (
            <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchHistory}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Empty state
    if (weeklyGroups.length === 0) {
        return (
            <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Ride History</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Your completed rides will appear here
                </Text>
            </View>
        );
    }

    // Main content
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Summary header */}
            <View style={[styles.summaryHeader, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    {weeklyGroups.reduce((sum, w) => sum + w.rides.length, 0)} total rides
                </Text>
            </View>

            {/* Weeks list */}
            <FlatList
                data={weeklyGroups}
                keyExtractor={(item) => item.weekKey}
                renderItem={renderWeek}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
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
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 16,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 10,
    },
    errorText: {
        color: '#e74c3c',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 15,
    },
    retryButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 15,
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
    },
    summaryHeader: {
        backgroundColor: '#fff',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    summaryText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    weekContainer: {
        marginTop: 10,
        marginHorizontal: 10,
        backgroundColor: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    weekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#007AFF',
    },
    weekHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    expandIcon: {
        color: '#fff',
        fontSize: 12,
        marginRight: 10,
    },
    weekLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    weekHeaderRight: {
        alignItems: 'flex-end',
    },
    rideCount: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
    },
    weekEarnings: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    ridesContainer: {
        padding: 10,
    },
    rideCard: {
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    routeName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    rideDate: {
        fontSize: 12,
        color: '#666',
    },
    customerName: {
        fontSize: 14,
        color: '#555',
        marginBottom: 10,
    },
    timesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    timeBlock: {
        alignItems: 'center',
        flex: 1,
    },
    timeLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 2,
    },
    timeValue: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
    },
    earningsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    earningsLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    earningsRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    earningsLabel: {
        fontSize: 14,
        color: '#666',
        marginRight: 4,
    },
    costValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    earningsValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#27ae60',
    },
});

export default RideHistoryScreen;
