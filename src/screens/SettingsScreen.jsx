/**
 * SettingsScreen.jsx
 * 
 * Main settings screen with clickable rows for navigation.
 * Each row navigates to a sub-screen or toggles a setting.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Modal
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import {
    getPreferredMapsApp,
    setPreferredMapsApp,
    getAvailableMapsOptions,
    MAPS_APP_LABELS
} from '../services/mapsService';

const SettingsScreen = ({
    onNavigateToAccountDetails,
    onNavigateToManageCars,
    onNavigateToNotifications
}) => {
    const { user, logout } = useAuth();
    const { theme, isDarkMode, toggleTheme } = useTheme();
    const colors = theme.colors;
    const { showAlert } = useAlert();

    // Maps preference state
    const [preferredMapsApp, setPreferredMapsAppState] = useState('default');
    const [showMapsModal, setShowMapsModal] = useState(false);

    // Load maps preference on mount
    useEffect(() => {
        const loadMapsPreference = async () => {
            const pref = await getPreferredMapsApp();
            setPreferredMapsAppState(pref);
        };
        loadMapsPreference();
    }, []);

    // Handle maps app selection
    const handleMapsAppSelect = async (appValue) => {
        await setPreferredMapsApp(appValue);
        setPreferredMapsAppState(appValue);
        setShowMapsModal(false);
    };

    // Handle logout with confirmation
    const handleLogout = () => {
        showAlert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    }
                }
            ]
        );
    };

    // Clickable settings row component
    const SettingsRow = ({ icon, label, subtitle, onPress, rightElement }) => (
        <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.divider }]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.6 : 1}
        >
            <Text style={styles.rowIcon}>{icon}</Text>
            <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
                {subtitle && (
                    <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
                )}
            </View>
            {rightElement || (
                onPress && <Text style={[styles.rowArrow, { color: colors.textMuted }]}>›</Text>
            )}
        </TouchableOpacity>
    );

    // Section header component
    const SectionHeader = ({ title }) => (
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Profile Summary */}


            {/* Account Section */}
            <SectionHeader title="ACCOUNT" />
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                <SettingsRow
                    icon="👤"
                    label="Account Details"
                    subtitle="View your profile information"
                    onPress={onNavigateToAccountDetails}
                />
                <SettingsRow
                    icon="🚗"
                    label="Manage Cars"
                    subtitle="Add or edit your vehicles"
                    onPress={onNavigateToManageCars}
                />
            </View>

            {/* Preferences Section */}
            <SectionHeader title="PREFERENCES" />
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                <SettingsRow
                    icon="🔔"
                    label="Notifications"
                    subtitle="Manage push notifications"
                    onPress={onNavigateToNotifications}
                />
                <SettingsRow
                    icon="🗺️"
                    label="Navigation App"
                    subtitle={MAPS_APP_LABELS[preferredMapsApp] || 'System Default'}
                    onPress={() => setShowMapsModal(true)}
                />
                <SettingsRow
                    icon="🌙"
                    label="Dark Mode"
                    subtitle={isDarkMode ? 'On' : 'Off'}
                    rightElement={
                        <Switch
                            value={isDarkMode}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#e0e0e0', true: colors.primary }}
                            thumbColor="#fff"
                        />
                    }
                />
            </View>

            {/* App Info Section */}
            <SectionHeader title="ABOUT" />
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                <SettingsRow
                    icon="📱"
                    label="App Version"
                    rightElement={
                        <Text style={[styles.rowValue, { color: colors.textMuted }]}>1.0.0</Text>
                    }
                />
                <SettingsRow
                    icon="🔧"
                    label="Build"
                    rightElement={
                        <Text style={[styles.rowValue, { color: colors.textMuted }]}>Development</Text>
                    }
                />
            </View>

            {/* Logout Button */}
            <TouchableOpacity
                style={[styles.logoutButton, { backgroundColor: colors.error }]}
                onPress={handleLogout}
            >
                <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>

            {/* Bottom spacing */}
            <View style={{ height: 40 }} />

            {/* Maps App Selection Modal */}
            <Modal
                visible={showMapsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowMapsModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMapsModal(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            Navigation App
                        </Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                            Choose which app to open when tapping on addresses
                        </Text>

                        {getAvailableMapsOptions().map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.modalOption,
                                    { borderBottomColor: colors.divider },
                                    preferredMapsApp === option.value && styles.modalOptionSelected
                                ]}
                                onPress={() => handleMapsAppSelect(option.value)}
                            >
                                <Text style={[
                                    styles.modalOptionText,
                                    { color: colors.text },
                                    preferredMapsApp === option.value && { color: colors.primary, fontWeight: '600' }
                                ]}>
                                    {option.label}
                                </Text>
                                {preferredMapsApp === option.value && (
                                    <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>
                                )}
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={[styles.modalCancelButton, { backgroundColor: colors.background }]}
                            onPress={() => setShowMapsModal(false)}
                        >
                            <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    profileInfo: {
        flex: 1,
        marginLeft: 16,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
    },
    profileSubtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 24,
        marginBottom: 8,
        marginHorizontal: 16,
        letterSpacing: 0.5,
    },
    card: {
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    rowIcon: {
        fontSize: 22,
        marginRight: 16,
    },
    rowContent: {
        flex: 1,
    },
    rowLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    rowSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    rowArrow: {
        fontSize: 24,
        fontWeight: '300',
    },
    rowValue: {
        fontSize: 15,
    },
    logoutButton: {
        marginHorizontal: 16,
        marginTop: 32,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
    },
    modalOptionSelected: {
        backgroundColor: 'rgba(0, 122, 255, 0.08)',
        borderRadius: 8,
        marginHorizontal: -12,
        paddingHorizontal: 24,
    },
    modalOptionText: {
        fontSize: 16,
    },
    modalCancelButton: {
        marginTop: 16,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '500',
    },
});

export default SettingsScreen;
