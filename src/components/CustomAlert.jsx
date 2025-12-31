import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Custom Alert Dialog Component (MessageBox.Show style)
 * Used for confirmations and errors that require user acknowledgment
 */
const CustomAlert = ({ visible, title, message, buttons, onDismiss }) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <View style={styles.alertBox}>
                    {/* Title */}
                    <Text style={styles.title}>{title}</Text>

                    {/* Message */}
                    <Text style={styles.message}>{message}</Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        {buttons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.button,
                                    button.style === 'cancel' && styles.cancelButton,
                                    button.style === 'destructive' && styles.destructiveButton,
                                ]}
                                onPress={() => {
                                    button.onPress && button.onPress();
                                    onDismiss();
                                }}
                            >
                                <Text
                                    style={[
                                        styles.buttonText,
                                        button.style === 'cancel' && styles.cancelButtonText,
                                        button.style === 'destructive' && styles.destructiveButtonText,
                                    ]}
                                >
                                    {button.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertBox: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '80%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    message: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 6,
        backgroundColor: '#007AFF',
        minWidth: 80,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        backgroundColor: '#E0E0E0',
    },
    cancelButtonText: {
        color: '#333',
    },
    destructiveButton: {
        backgroundColor: '#FF3B30',
    },
    destructiveButtonText: {
        color: '#fff',
    },
});

export default CustomAlert;
