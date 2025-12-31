import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Toast Notification Component
 * Used for non-blocking notifications (success, info, warning, error)
 */
const Toast = ({ visible, message, type = 'success', duration = 3000, onDismiss }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible) {
            // Slide in and fade in
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss after duration
            const timer = setTimeout(() => {
                dismissToast();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    const dismissToast = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    if (!visible) return null;

    const backgroundColor = {
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FF9800',
        info: '#2196F3',
    }[type] || '#4CAF50';

    const icon = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
    }[type] || '✓';

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            <TouchableOpacity
                style={styles.content}
                onPress={dismissToast}
                activeOpacity={0.9}
            >
                <Text style={styles.icon}>{icon}</Text>
                <Text style={styles.message}>{message}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    icon: {
        fontSize: 20,
        color: '#fff',
        marginRight: 12,
        fontWeight: 'bold',
    },
    message: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
    },
});

export default Toast;
