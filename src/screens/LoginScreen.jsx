/**
 * LoginScreen.jsx
 * 
 * This is the login page. Users enter their username and password here.
 * 
 * HOW IT WORKS:
 * 1. User types username and password
 * 2. User presses "Login" button
 * 3. We call AuthContext's login() function
 * 4. If successful, AuthContext updates isAuthenticated to true
 * 5. App.js sees this change and automatically shows HomeScreen instead
 * 
 * We don't need to manually navigate - the App.js handles that
 * based on the authentication state.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';

const LoginScreen = () => {
    // ============================================
    // STATE VARIABLES
    // ============================================
    // These store what the user types
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // This shows a loading spinner when logging in
    const [isLoading, setIsLoading] = useState(false);
    // This controls password visibility
    const [showPassword, setShowPassword] = useState(false);

    // Get the login function from AuthContext
    const { login } = useAuth();
    const { showAlert } = useAlert();

    // ============================================
    // HANDLE LOGIN
    // ============================================
    const handleLogin = async () => {
        // Don't allow empty fields
        if (!username.trim() || !password.trim()) {
            showAlert('Error', 'Please enter both username and password', [{ text: 'OK' }]);
            return;
        }

        // Show loading spinner
        setIsLoading(true);

        try {
            // Call the login function from AuthContext
            // This sends the credentials to the server
            const result = await login(username, password);

            if (result.success) {
                // Login succeeded!
                // We don't need to do anything here because:
                // - AuthContext sets isAuthenticated = true
                // - App.js is watching isAuthenticated
                // - App.js will automatically switch to HomeScreen
                console.log('Login successful! User ID:', result.userId);
            } else {
                // Login failed - show error message
                showAlert('Login Failed', result.message || 'Invalid credentials', [{ text: 'OK' }]);
            }
        } catch (error) {
            // Something went wrong (network error, server error, etc.)
            showAlert('Error', 'Something went wrong. Please try again.', [{ text: 'OK' }]);
            console.error('Login error:', error);
        } finally {
            // Hide loading spinner
            setIsLoading(false);
        }
    };

    // ============================================
    // RENDER THE UI
    // ============================================
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.loginBox}>
                {/* Title */}
                <Text style={styles.title}>Driver App</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>

                {/* Username Input */}
                <TextInput
                    style={styles.input}
                    placeholder="Name or Email"
                    placeholderTextColor="#999"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                />

                {/* Password Input */}
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor="#999"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        editable={!isLoading}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                    >
                        <Ionicons
                            name={showPassword ? 'eye-off' : 'eye'}
                            size={24}
                            color="#666"
                        />
                    </TouchableOpacity>
                </View>

                {/* Login Button */}
                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.buttonText}>Login</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Become a Driver Section */}
            <View style={styles.becomeDriverSection}>
                <Text style={styles.becomeDriverTitle}>Want to become a driver?</Text>
                <Text style={styles.becomeDriverText}>
                    If you don't have an account yet, contact us to get started.
                </Text>
                <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => {
                        const subject = encodeURIComponent('Interested in Becoming a Driver');
                        const body = encodeURIComponent(
                            `Hello,\n\nI am interested in becoming a driver for Shia's Transportation.\n\nPlease find my information below:\n\nFull Name: \nPhone Number: \nEmail: \nCity/Area: \nVehicle Type: \nYears of Driving Experience: \n\nI look forward to hearing from you.\n\nThank you!`
                        );
                        Linking.openURL(`mailto:contact@shiastransport.com?subject=${subject}&body=${body}`);
                    }}
                >
                    <Ionicons name="mail-outline" size={20} color="#007AFF" style={{ marginRight: 8 }} />
                    <Text style={styles.contactButtonText}>Contact Us</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loginBox: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5, // Shadow for Android
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 15,
        fontSize: 16,
        marginBottom: 15,
        color: '#333',
    },
    passwordContainer: {
        position: 'relative',
        marginBottom: 15,
    },
    passwordInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 15,
        paddingRight: 50,
        fontSize: 16,
        color: '#333',
    },
    eyeIcon: {
        position: 'absolute',
        right: 15,
        top: '50%',
        transform: [{ translateY: -12 }],
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 8,
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#99c9ff',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    becomeDriverSection: {
        marginTop: 30,
        padding: 20,
        alignItems: 'center',
    },
    becomeDriverTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    becomeDriverText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f8ff',
        borderWidth: 1,
        borderColor: '#007AFF',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    contactButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LoginScreen;
