/**
 * NotificationsScreen.jsx
 * 
 * Placeholder screen for notification settings.
 * Displays "Feature Coming Soon" message.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const NotificationsScreen = ({ onBack }) => {
    const { theme } = useTheme();
    const colors = theme.colors;

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

            {/* Coming Soon Content */}
            <View style={styles.content}>
                <Text style={styles.icon}>🔔</Text>
                <Text style={[styles.title, { color: colors.text }]}>Coming Soon</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Notification settings will be available in a future update.
                </Text>
                <Text style={[styles.description, { color: colors.textMuted }]}>
                    You'll be able to customize push notifications, sounds, and alerts for new calls, messages, and more.
                </Text>
            </View>
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
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    icon: {
        fontSize: 80,
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 17,
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
});

export default NotificationsScreen;
