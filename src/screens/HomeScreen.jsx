/**
 * HomeScreen.jsx
 * 
 * Main screen after login with bottom tab navigation.
 * 
 * STRUCTURE:
 * - Four tabs at the bottom with icons
 * - Each tab shows a different screen component
 * - When viewing a specific call, shows CurrentCallScreen
 * - Open Calls tab is disabled while a call is in progress
 * 
 * TABS:
 * 1. Open Calls - List of available rides (disabled during active call)
 * 2. Cars - Manage your vehicles
 * 3. Messages - Messaging with dispatch
 * 4. Account - Profile and settings
 * 
 * NAVIGATION:
 * - When driver accepts a call → show CurrentCallScreen
 * - Driver can press back but Open Calls tab is disabled
 * - Banner shows at top to return to active call
 * - When ride is completed → return to Open Calls tab
 * 
 * SIGNALR EVENTS:
 * - CallUnassigned: This driver was removed from call → show alert, close active call
 * - CallAvailableAgain: A call became available → add to open calls list
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    SafeAreaView
} from 'react-native';

// Import tab screens
import OpenCallsScreen from './OpenCallsScreen';
import ActiveCallsScreen from './ActiveCallsScreen';
import CarManagementScreen from './CarManagementScreen';
import SettingsScreen from './SettingsScreen';
import AccountDetailsScreen from './AccountDetailsScreen';
import NotificationsScreen from './NotificationsScreen';
import MessagingScreen from './MessagingScreen';
import CurrentCallScreen from './CurrentCallScreen';
import RideHistoryScreen from './RideHistoryScreen';
import signalRService from '../services/signalRService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWaitTime } from '../contexts/WaitTimeContext';
import { communicationAPI } from '../services/apiService';

const HomeScreen = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const colors = theme.colors;
    const { isTimerRunning, formattedTime, startTimer, stopTimer, clearTimer } = useWaitTime();

    // ALL useState hooks at the very top
    const [activeTab, setActiveTab] = useState('calls');
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeCallId, setActiveCallId] = useState(null);
    const [viewingActiveCall, setViewingActiveCall] = useState(true);
    const [messagePrefill, setMessagePrefill] = useState("");
    const [openedMessagingFromCall, setOpenedMessagingFromCall] = useState(false);

    // Ref to track active call ID for SignalR callbacks (avoids stale closure)
    const activeCallIdRef = useRef(null);

    // Ref to track active tab for SignalR callbacks (avoids stale closure)
    const activeTabRef = useRef(activeTab);

    // Keep refs in sync with state
    useEffect(() => {
        activeCallIdRef.current = activeCallId;
    }, [activeCallId]);

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    // Clear messagePrefill when switching away from messages tab
    useEffect(() => {
        if (activeTab !== 'messages' && messagePrefill) {
            setMessagePrefill("");
            setOpenedMessagingFromCall(false);
        }
    }, [activeTab, messagePrefill]);

    // Set up SignalR listeners for call reassignment
    useEffect(() => {
        // Handle when THIS driver is removed from a call
        const unsubscribeUnassigned = signalRService.onCallUnassigned((data) => {
            console.log('CallUnassigned received:', data);
            console.log('Current activeCallIdRef:', activeCallIdRef.current);

            // Check if this is our active call (compare as numbers to handle type differences)
            const receivedRideId = Number(data.rideId);
            const currentActiveId = Number(activeCallIdRef.current);

            if (currentActiveId && receivedRideId === currentActiveId) {
                // Show alert to driver
                Alert.alert(
                    'Call Reassigned',
                    data.message || 'You have been removed from this call by dispatch.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                // Close active call and return to open calls
                                setActiveCallId(null);
                                setViewingActiveCall(false);
                                setActiveTab('calls');
                            }
                        }
                    ]
                );
            }
        });

        return () => {
            unsubscribeUnassigned();
        };
    }, []);

    // Fetch unread message count on mount and set up SignalR listener for new messages
    useEffect(() => {
        const fetchUnreadCount = async () => {
            if (user?.userId) {
                try {
                    console.log('Fetching unread message count for user:', user.userId);
                    const count = await communicationAPI.getUnreadCount(user.userId);
                    setUnreadCount(count || 0);
                } catch (error) {
                    console.error('Error fetching unread count:', error);
                    setUnreadCount(0);
                }
            }
        };

        fetchUnreadCount();

        // Listen for new messages to increment unread count (always increment, even on messages tab)
        // The MessagingScreen will call onUnreadCountChange to reset when messages are marked read
        const unsubscribeMessage = signalRService.onMessageReceived((messageData) => {
            console.log('New message received in HomeScreen:', messageData);
            // Always increment - let MessagingScreen reset when opened/read
            // Only increment for dispatcher/broadcast messages, not our own
            // Handle both camelCase and PascalCase from server
            const from = (messageData.from || messageData.From || '').toLowerCase();
            if (!from.startsWith('driver')) {
                setUnreadCount(prev => prev + 1);
            }
        });

        return () => {
            unsubscribeMessage();
        };
    }, [user]);

    /**
     * Handle unread count changes from MessagingScreen
     */
    const handleUnreadCountChange = (count) => {
        setUnreadCount(count);
    };

    /**
     * Called when the ride is fully completed (after payment)
     * Returns to the Open Calls tab
     */
    const handleRideComplete = () => {
        console.log('Ride completed, returning to Open Calls');
        clearTimer(); // Clear wait time timer when ride is completed
        setActiveCallId(null);
        setActiveTab('active');
    };

    /**
     * Called when driver presses back from CurrentCallScreen
     * Returns to the Active Calls tab where they can select the call again if needed
     */
    const handleBackFromActiveCall = () => {
        console.log('Going back from current call screen to active calls tab');
        setActiveCallId(null);
        setViewingActiveCall(false);
        setActiveTab('active');
    };

    /**
     * Navigate to messaging (opens Messages tab)
     * When called from CurrentCallScreen, we need to hide the call screen and show the tab view
     */
    const handleOpenMessages = (prefill) => {
        setMessagePrefill(prefill || "");
        setOpenedMessagingFromCall(true);
        setViewingActiveCall(false); // Hide CurrentCallScreen so tab view shows
        setActiveTab('messages');
    };

    // If we have an active call AND we're viewing it, show the CurrentCallScreen
    if (activeCallId !== null && viewingActiveCall) {
        return (
            <SafeAreaView style={styles.container}>
                <CurrentCallScreen
                    rideId={activeCallId}
                    onBack={handleBackFromActiveCall}
                    onComplete={handleRideComplete}
                    onMessage={handleOpenMessages}
                />
            </SafeAreaView>
        );
    }

    /**
     * Navigate to Car Management screen (called from Settings screen)
     */
    const handleManageCars = () => {
        setActiveTab('cars');
    };

    /**
     * Navigate to Account Details screen (called from Settings screen)
     */
    const handleNavigateToAccountDetails = () => {
        setActiveTab('accountDetails');
    };

    /**
     * Navigate to Notifications screen (called from Settings screen)
     */
    const handleNavigateToNotifications = () => {
        setActiveTab('notifications');
    };

    /**
     * Go back to Settings screen
     */
    const handleBackToSettings = () => {
        setActiveTab('settings');
    };

    /**
     * Called when a call is selected from ActiveCallsScreen
     * Opens the CurrentCallScreen to show/manage that specific call
     */
    const handleActiveCallSelect = (rideId) => {
        console.log('Opening call from active calls list:', rideId);
        setActiveCallId(rideId);
        setViewingActiveCall(true);
    };

    // Normal tab view
    const renderActiveScreen = () => {
        switch (activeTab) {
            case 'calls':
                return <OpenCallsScreen />;
            case 'active':
                return <ActiveCallsScreen onCallSelect={handleActiveCallSelect} />;
            case 'history':
                return <RideHistoryScreen />;
            case 'cars':
                // Car Management screen (accessed via Settings → Manage Cars)
                return <CarManagementScreen onBack={handleBackToSettings} />;
            case 'messages':
                return (
                    <MessagingScreen
                        onUnreadCountChange={handleUnreadCountChange}
                        initialMessage={messagePrefill}
                        showBackButton={openedMessagingFromCall}
                        onBack={() => {
                            // Return to the current call screen
                            setViewingActiveCall(true);
                            setOpenedMessagingFromCall(false);
                            setMessagePrefill("");
                        }}
                    />
                );
            case 'settings':
                return (
                    <SettingsScreen
                        onNavigateToAccountDetails={handleNavigateToAccountDetails}
                        onNavigateToManageCars={handleManageCars}
                        onNavigateToNotifications={handleNavigateToNotifications}
                    />
                );
            case 'accountDetails':
                return <AccountDetailsScreen onBack={handleBackToSettings} />;
            case 'notifications':
                return <NotificationsScreen onBack={handleBackToSettings} />;
            default:
                return <OpenCallsScreen />;
        }
    };

    // Tab configuration (for rendering tab bar)
    const TABS = [
        { key: 'calls', label: 'Open Calls', icon: '📞' },
        { key: 'active', label: 'Active', icon: '🚗' },
        { key: 'messages', label: 'Messages', icon: '💬' },
        { key: 'history', label: 'History', icon: '📋' },
        { key: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    // Handle tab press
    const handleTabPress = (tabKey) => {
        setActiveTab(tabKey);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.header }]}>
                <Text style={[styles.headerTitle, { color: colors.headerText }]}>
                    {TABS.find(tab => tab.key === activeTab)?.label || 'Settings'}
                </Text>
            </View>

            {/* Active Screen Content */}
            <View style={styles.content}>
                {renderActiveScreen()}
            </View>

            {/* Bottom Tab Bar */}
            <View style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
                {TABS.map((tab) => {
                    const showBadge = tab.key === 'messages' && unreadCount > 0;
                    const isActive = activeTab === tab.key ||
                        (tab.key === 'settings' && ['settings', 'cars', 'accountDetails', 'notifications'].includes(activeTab));
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[
                                styles.tab,
                                isActive && styles.activeTab
                            ]}
                            onPress={() => handleTabPress(tab.key)}
                        >
                            <View style={styles.tabIconContainer}>
                                <Text style={styles.tabIcon}>
                                    {tab.icon}
                                </Text>
                                {showBadge && (
                                    <View style={[styles.badge, { backgroundColor: colors.error }]}>
                                        <Text style={styles.badgeText}>
                                            {unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[
                                styles.tabLabel,
                                { color: colors.tabInactive },
                                isActive && [styles.activeTabLabel, { color: colors.tabActive }]
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Floating Wait Time Timer Widget - shows only when timer is running */}
            {isTimerRunning && (
                <View style={styles.floatingTimerContainer}>
                    <View style={[styles.floatingTimer, { backgroundColor: '#2ecc71' }]}>
                        <Text style={styles.floatingTimerIcon}>⏱️</Text>
                        <Text style={styles.floatingTimerText}>{formattedTime}</Text>
                        <TouchableOpacity
                            style={styles.floatingTimerButton}
                            onPress={stopTimer}
                        >
                            <Text style={styles.floatingTimerButtonText}>⏸</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
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
        paddingTop: 50, // Extra space for status bar
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
    },
    content: {
        flex: 1,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        paddingBottom: 20, // Extra padding for home indicator on newer phones
        paddingTop: 10,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
    },
    activeTab: {
        // Could add background color for active tab if desired
    },
    tabIconContainer: {
        position: 'relative',
        marginBottom: 4,
    },
    tabIcon: {
        fontSize: 24,
    },
    badge: {
        position: 'absolute',
        top: -5,
        right: -12,
        backgroundColor: '#e74c3c',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    tabLabel: {
        fontSize: 12,
        color: '#999',
    },
    activeTabLabel: {
        color: '#007AFF',
        fontWeight: '600',
    },
    disabledTab: {
        opacity: 0.4,
    },
    disabledTabIcon: {
        opacity: 0.5,
    },
    disabledTabLabel: {
        color: '#ccc',
    },
    // Floating timer widget styles
    floatingTimerContainer: {
        position: 'absolute',
        top: 100,
        right: 15,
        zIndex: 1000,
    },
    floatingTimer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    floatingTimerIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    floatingTimerText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        marginRight: 8,
    },
    floatingTimerButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingTimerButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default HomeScreen;
