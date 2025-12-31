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
import ChangePasswordScreen from '../components/ChangePasswordScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import signalRService from '../services/signalRService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWaitTime } from '../contexts/WaitTimeContext';
import { useNotifications } from '../contexts/NotificationContext';
import { communicationAPI, ridesAPI } from '../services/apiService';

const HomeScreen = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const colors = theme.colors;
    const {
        isTimerRunning,
        formattedTime,
        activeRideId,
        timerState,
        pauseTimer,
        resumeTimer,
        resetTimer
    } = useWaitTime();
    const { pendingNavigation, clearPendingNavigation } = useNotifications();
    const { showAlert } = useAlert();

    // ALL useState hooks at the very top
    const [activeTab, setActiveTab] = useState('calls');
    const [unreadCount, setUnreadCount] = useState(0);
    const [assignedCallsCount, setAssignedCallsCount] = useState(0);
    const [activeCallId, setActiveCallId] = useState(null);
    const [viewingActiveCall, setViewingActiveCall] = useState(true);
    const [messagePrefill, setMessagePrefill] = useState("");
    const [openedMessagingFromCall, setOpenedMessagingFromCall] = useState(false);

    // State for scrolling to a specific ride (from push notification)
    const [scrollToRideId, setScrollToRideId] = useState(null);

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

    // Handle navigation from push notifications
    // When pendingNavigation changes, navigate to the appropriate tab
    useEffect(() => {
        if (pendingNavigation) {
            console.log('📱 Handling pending navigation:', pendingNavigation);

            switch (pendingNavigation.screen) {
                case 'openCalls':
                    // Navigate to Open Calls tab
                    // Only if there's no active call or allow navigation anyway
                    if (!activeCallId) {
                        setActiveTab('calls');
                    }
                    // Set the rideId to scroll to (OpenCallsScreen will handle scrolling)
                    if (pendingNavigation.rideId) {
                        setScrollToRideId(pendingNavigation.rideId);
                    }
                    break;

                case 'messages':
                    // Navigate to Messages tab
                    setActiveTab('messages');
                    break;

                case 'home':
                    // Just go to the default tab (calls)
                    if (!activeCallId) {
                        setActiveTab('calls');
                    }
                    break;

                default:
                    console.log('Unknown navigation screen:', pendingNavigation.screen);
            }

            // Clear the pending navigation after handling
            clearPendingNavigation();
        }
    }, [pendingNavigation, activeCallId, clearPendingNavigation]);

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
                showAlert(
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

        // Handle when a call is canceled (remove from open calls and active call)
        const unsubscribeCanceled = signalRService.onCallCanceled((data) => {
            console.log('CallCanceled received:', data);
            console.log('Current activeCallIdRef:', activeCallIdRef.current);

            // Check if this is our active call (compare as numbers to handle type differences)
            const receivedRideId = Number(data.rideId);
            const currentActiveId = Number(activeCallIdRef.current);

            if (currentActiveId && receivedRideId === currentActiveId) {
                // Show alert to driver
                showAlert(
                    'Call Canceled',
                    data.message || 'This call has been canceled by dispatch.',
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
            unsubscribeCanceled();
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

        // Listen for new messages to increment unread count
        // Don't increment if messaging screen is active - it will mark as read immediately
        const unsubscribeMessage = signalRService.onMessageReceived((messageData) => {
            console.log('New message received in HomeScreen:', messageData);
            // Only increment for dispatcher/broadcast messages, not our own
            // Handle both camelCase and PascalCase from server
            const from = (messageData.from || messageData.From || '').toLowerCase();
            // Don't increment if on messaging screen - MessagingScreen will handle it
            if (!from.startsWith('driver') && activeTabRef.current !== 'messages') {
                setUnreadCount(prev => prev + 1);
            }
        });

        return () => {
            unsubscribeMessage();
        };
    }, [user]);

    // Fetch assigned calls count on mount and listen for changes
    useEffect(() => {
        const fetchAssignedCallsCount = async () => {
            if (user?.userId) {
                try {
                    const data = await ridesAPI.getAssignedByDriver(user.userId);
                    setAssignedCallsCount(data?.length || 0);
                } catch (error) {
                    console.error('Error fetching assigned calls count:', error);
                    setAssignedCallsCount(0);
                }
            }
        };

        fetchAssignedCallsCount();

        // Listen for call assigned/unassigned to update count
        const unsubscribeAssigned = signalRService.onCallAssigned((data) => {
            console.log('Call assigned, refreshing count');
            fetchAssignedCallsCount();
        });

        const unsubscribeUnassigned = signalRService.onCallUnassigned((data) => {
            console.log('Call unassigned, refreshing count');
            fetchAssignedCallsCount();
        });

        return () => {
            unsubscribeAssigned();
            unsubscribeUnassigned();
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
     * Navigate to Change Password screen (called from Settings screen)
     */
    const handleNavigateToChangePassword = () => {
        setActiveTab('changePassword');
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
                return (
                    <OpenCallsScreen
                        scrollToRideId={scrollToRideId}
                        onScrollComplete={() => setScrollToRideId(null)}
                        onNavigateToCars={handleManageCars}
                    />
                );
            case 'active':
                return <ActiveCallsScreen onCallSelect={handleActiveCallSelect} onCountChange={setAssignedCallsCount} />;
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
                return <AccountDetailsScreen onBack={handleBackToSettings} onNavigateToChangePassword={handleNavigateToChangePassword} />;
            case 'notifications':
                return (
                    <ErrorBoundary onReset={handleBackToSettings}>
                        <NotificationsScreen onBack={handleBackToSettings} />
                    </ErrorBoundary>
                );
            case 'changePassword':
                return <ChangePasswordScreen navigation={{ goBack: handleBackToSettings }} />;
            default:
                return (
                    <OpenCallsScreen
                        scrollToRideId={scrollToRideId}
                        onScrollComplete={() => setScrollToRideId(null)}
                        onNavigateToCars={handleManageCars}
                    />
                );
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
                    const showMessagesBadge = tab.key === 'messages' && unreadCount > 0;
                    const showActiveBadge = tab.key === 'active' && assignedCallsCount > 0;
                    const badgeCount = tab.key === 'messages' ? unreadCount : (tab.key === 'active' ? assignedCallsCount : 0);
                    const showBadge = showMessagesBadge || showActiveBadge;
                    const isActive = activeTab === tab.key ||
                        (tab.key === 'settings' && ['settings', 'cars', 'accountDetails', 'notifications', 'changePassword'].includes(activeTab));
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
                                            {badgeCount}
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

            {/* Floating Wait Time Timer Widget - shows when timer is active (running or paused) */}
            {(timerState === 'waiting' || timerState === 'paused') && activeRideId && (
                <View style={styles.floatingTimerContainer}>
                    <View style={[styles.floatingTimer, { backgroundColor: isTimerRunning ? '#e74c3c' : '#f39c12' }]}>
                        <Text style={styles.floatingTimerLabel}>⏱️ WAIT TIME</Text>
                        <View style={styles.floatingTimerInfo}>
                            <Text style={styles.floatingTimerText}>{formattedTime}</Text>
                            <Text style={styles.floatingTimerRideId}>Call #{activeRideId}</Text>
                        </View>
                        <View style={styles.floatingTimerButtons}>
                            {isTimerRunning ? (
                                <TouchableOpacity
                                    style={styles.floatingTimerButton}
                                    onPress={() => pauseTimer(activeRideId)}
                                >
                                    <Text style={styles.floatingTimerButtonText}>⏸</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.floatingTimerButton}
                                    onPress={() => resumeTimer(activeRideId)}
                                >
                                    <Text style={styles.floatingTimerButtonText}>▶</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.floatingTimerButton, styles.floatingTimerResetButton]}
                                onPress={() => resetTimer(activeRideId)}
                            >
                                <Text style={styles.floatingTimerButtonText}>↺</Text>
                            </TouchableOpacity>
                        </View>
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
    floatingTimerLabel: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        marginRight: 6,
    },
    floatingTimerInfo: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginRight: 8,
    },
    floatingTimerText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    floatingTimerRideId: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 11,
        fontWeight: '500',
    },
    floatingTimerButtons: {
        flexDirection: 'row',
        gap: 4,
    },
    floatingTimerButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingTimerResetButton: {
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    floatingTimerButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default HomeScreen;
