/**
 * SettingsScreen.jsx
 * 
 * Main settings screen with clickable rows for navigation.
 * Each row navigates to a sub-screen or toggles a setting.
 */

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Alert
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const SettingsScreen = ({
    onNavigateToAccountDetails,
    onNavigateToManageCars,
    onNavigateToNotifications
}) => {
    const { user, logout } = useAuth();
    const { theme, isDarkMode, toggleTheme } = useTheme();
    const colors = theme.colors;

    // Handle logout with confirmation
    const handleLogout = () => {
        Alert.alert(
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
            <TouchableOpacity
                style={[styles.profileCard, { backgroundColor: colors.card }]}
                onPress={onNavigateToAccountDetails}
                activeOpacity={0.6}
            >
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>
                        {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                    </Text>
                </View>
                <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: colors.text }]}>
                        {user?.name || 'Driver'}
                    </Text>
                    <Text style={[styles.profileSubtitle, { color: colors.textMuted }]}>
                        View account details
                    </Text>
                </View>
                <Text style={[styles.rowArrow, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>

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
});

export default SettingsScreen;
