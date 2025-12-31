/**
 * NotificationsScreen.jsx
 * 
 * Manage push notification preferences with individual toggles for each notification type.
 * Includes master toggle to enable/disable all notifications at once.
 * Preferences are stored both locally (AsyncStorage) and on server.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    ScrollView,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationAPI } from '../services/apiService';

const STORAGE_KEY = '@notification_preferences';

const NotificationsScreen = ({ onBack }) => {
    console.log('NotificationsScreen rendering...');

    const { theme } = useTheme();
    const { user } = useAuth();
    const colors = theme?.colors || {};

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preferences, setPreferences] = useState({
        messagesEnabled: true,
        broadcastMessagesEnabled: true,
        newCallEnabled: true,
        callAvailableAgainEnabled: true,
        myCallReassignedEnabled: true,
        myCallCanceledEnabled: true,
    });

    // Calculate if all notifications are enabled
    const allNotificationsEnabled =
        preferences.messagesEnabled &&
        preferences.broadcastMessagesEnabled &&
        preferences.newCallEnabled &&
        preferences.callAvailableAgainEnabled &&
        preferences.myCallReassignedEnabled &&
        preferences.myCallCanceledEnabled;

    // Load preferences on mount
    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            setLoading(true);
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                console.log('Loaded preferences from storage:', stored);
                setPreferences(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
            console.error('Error stack:', error.stack);
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async (newPreferences) => {
        try {
            setSaving(true);

            // Save to local storage immediately
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));

            // Save to server
            if (user?.userId && notificationAPI) {
                await notificationAPI.updatePreferences(user.userId, newPreferences);
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
            console.error('Error stack:', error.stack);
            Alert.alert(
                'Error',
                'Failed to save notification preferences. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setSaving(false);
        }
    };

    const handleMasterToggle = (value) => {
        console.log('Master toggle changed to:', value);
        const newPreferences = {
            messagesEnabled: value,
            broadcastMessagesEnabled: value,
            newCallEnabled: value,
            callAvailableAgainEnabled: value,
            myCallReassignedEnabled: value,
            myCallCanceledEnabled: value,
        };
        setPreferences(newPreferences);
        savePreferences(newPreferences);
    };

    const handleIndividualToggle = (key, value) => {
        console.log(`Toggle ${key} changed to:`, value);
        const newPreferences = {
            ...preferences,
            [key]: value,
        };
        setPreferences(newPreferences);
        savePreferences(newPreferences);
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: colors.header }]}>
                    <TouchableOpacity style={styles.backButton} onPress={onBack}>
                        <Text style={[styles.backButtonText, { color: colors.headerText }]}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.headerText }]}>Notifications</Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Back Button */}
            <View style={[styles.header, { backgroundColor: colors.header }]}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text style={[styles.backButtonText, { color: colors.headerText }]}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.headerText }]}>Notifications</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Master Toggle Section */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
                        <View style={styles.toggleInfo}>
                            <Text style={[styles.toggleLabel, { color: colors.text }]}>All Notifications</Text>
                            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                Enable or disable all push notifications
                            </Text>
                        </View>
                        <Switch
                            value={allNotificationsEnabled}
                            onValueChange={handleMasterToggle}
                            disabled={saving}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor='#f4f3f4'
                        />
                    </View>
                </View>

                {/* Individual Notification Types */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Types</Text>
                        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                            Customize which notifications you receive
                        </Text>
                    </View>

                    {/* Messages */}
                    <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
                        <View style={styles.toggleInfo}>
                            <Text style={[styles.toggleLabel, { color: colors.text }]}>💬 Messages</Text>
                            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                Direct messages from dispatch
                            </Text>
                        </View>
                        <Switch
                            value={preferences.messagesEnabled}
                            onValueChange={(value) => handleIndividualToggle('messagesEnabled', value)}
                            disabled={saving}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor='#f4f3f4'
                        />
                    </View>

                    {/* Broadcast Messages */}
                    <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
                        <View style={styles.toggleInfo}>
                            <Text style={[styles.toggleLabel, { color: colors.text }]}>📢 Broadcast Messages</Text>
                            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                Messages sent to all drivers
                            </Text>
                        </View>
                        <Switch
                            value={preferences.broadcastMessagesEnabled}
                            onValueChange={(value) => handleIndividualToggle('broadcastMessagesEnabled', value)}
                            disabled={saving}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor='#f4f3f4'
                        />
                    </View>

                    {/* New Call */}
                    <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
                        <View style={styles.toggleInfo}>
                            <Text style={[styles.toggleLabel, { color: colors.text }]}>🚗 New Call Available</Text>
                            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                New calls that you can accept
                            </Text>
                        </View>
                        <Switch
                            value={preferences.newCallEnabled}
                            onValueChange={(value) => handleIndividualToggle('newCallEnabled', value)}
                            disabled={saving}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor='#f4f3f4'
                        />
                    </View>

                    {/* Call Available Again */}
                    <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
                        <View style={styles.toggleInfo}>
                            <Text style={[styles.toggleLabel, { color: colors.text }]}>🔄 Call Available Again</Text>
                            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                Calls reassigned and now available
                            </Text>
                        </View>
                        <Switch
                            value={preferences.callAvailableAgainEnabled}
                            onValueChange={(value) => handleIndividualToggle('callAvailableAgainEnabled', value)}
                            disabled={saving}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor='#f4f3f4'
                        />
                    </View>

                    {/* My Call Reassigned */}
                    <View style={[styles.toggleItem, { borderBottomColor: colors.border }]}>
                        <View style={styles.toggleInfo}>
                            <Text style={[styles.toggleLabel, { color: colors.text }]}>⚠️ My Call Reassigned</Text>
                            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                When you're removed from a call
                            </Text>
                        </View>
                        <Switch
                            value={preferences.myCallReassignedEnabled}
                            onValueChange={(value) => handleIndividualToggle('myCallReassignedEnabled', value)}
                            disabled={saving}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor='#f4f3f4'
                        />
                    </View>

                    {/* My Call Canceled */}
                    <View style={[styles.toggleItem, { borderBottomColor: 'transparent' }]}>
                        <View style={styles.toggleInfo}>
                            <Text style={[styles.toggleLabel, { color: colors.text }]}>❌ My Call Canceled</Text>
                            <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
                                When your assigned call is canceled
                            </Text>
                        </View>
                        <Switch
                            value={preferences.myCallCanceledEnabled}
                            onValueChange={(value) => handleIndividualToggle('myCallCanceledEnabled', value)}
                            disabled={saving}
                            trackColor={{ false: '#767577', true: colors.primary }}
                            thumbColor='#f4f3f4'
                        />
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <Text style={[styles.infoText, { color: colors.textMuted }]}>
                        ℹ️ The master toggle turns all notifications on or off at once.
                        Changes are saved automatically.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        paddingVertical: 4,
        paddingRight: 16,
    },
    backButtonText: {
        fontSize: 17,
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    headerSpacer: {
        width: 60,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingVertical: 16,
    },
    section: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
    },
    toggleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    toggleInfo: {
        flex: 1,
        marginRight: 12,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    toggleDescription: {
        fontSize: 14,
    },
    infoSection: {
        marginHorizontal: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    infoText: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
});

export default NotificationsScreen;
