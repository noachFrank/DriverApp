/**
 * AccountDetailsScreen.jsx
 * 
 * Displays detailed user account information (read-only).
 * Accessed from Settings → Account Details.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate } from '../utils/dateHelpers';

const AccountDetailsScreen = ({ onBack, onNavigateToChangePassword }) => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const colors = theme.colors;

    // Helper to render an info row
    const InfoRow = ({ label, value, icon }) => (
        <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
            <Text style={styles.infoIcon}>{icon}</Text>
            <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{value || 'N/A'}</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Back Button */}
            <View style={[styles.header, { backgroundColor: colors.header }]}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text style={[styles.backButtonText, { color: colors.headerText }]}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.headerText }]}>Account Details</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content}>
                {/* Profile Header */}
                <View style={[styles.profileHeader, { backgroundColor: colors.primary }]}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                        </Text>
                    </View>
                    <Text style={styles.name}>{user?.name || 'Driver'}</Text>
                    <Text style={styles.role}>Driver</Text>
                </View>

                {/* Account Info */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        PERSONAL INFORMATION
                    </Text>

                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <InfoRow
                            icon="👤"
                            label="Full Name"
                            value={user?.name}
                        />
                        <InfoRow
                            icon="🔑"
                            label="Username"
                            value={user?.username}
                        />
                        <InfoRow
                            icon="📧"
                            label="Email"
                            value={user?.email}
                        />
                        <InfoRow
                            icon="📱"
                            label="Phone"
                            value={user?.phoneNumber}
                        />
                    </View>
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        SECURITY
                    </Text>

                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <TouchableOpacity
                            style={[styles.actionRow, { borderBottomColor: colors.divider }]}
                            onPress={onNavigateToChangePassword}
                        >
                            <Text style={styles.infoIcon}>🔐</Text>
                            <View style={styles.infoContent}>
                                <Text style={[styles.actionLabel, { color: colors.text }]}>Change Password</Text>
                                <Text style={[styles.actionSubtitle, { color: colors.textMuted }]}>Update your account password</Text>
                            </View>
                            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>›</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Driver Info */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        DRIVER INFORMATION
                    </Text>

                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <InfoRow
                            icon="🪪"
                            label="License Number"
                            value={user?.license}
                        />
                        <InfoRow
                            icon="📅"
                            label="Member Since"
                            value={user?.joinedDate ? formatDate(user.joinedDate) : null}
                        />
                        <InfoRow
                            icon="🆔"
                            label="Driver ID"
                            value={user?.userId?.toString()}
                        />
                    </View>
                </View>



                {/* Bottom spacing */}
                <View style={{ height: 40 }} />
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
        width: 60, // Balance the back button
    },
    content: {
        flex: 1,
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
    },
    name: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 5,
    },
    role: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    section: {
        marginTop: 20,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    card: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    infoIcon: {
        fontSize: 22,
        marginRight: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 16,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    actionSubtitle: {
        fontSize: 13,
    },
    rowArrow: {
        fontSize: 24,
        marginLeft: 8,
    },
});

export default AccountDetailsScreen;
