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
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen = () => {
    // ============================================
    // STATE VARIABLES
    // ============================================
    // These store what the user types
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // This shows a loading spinner when logging in
    const [isLoading, setIsLoading] = useState(false);

    // Get the login function from AuthContext
    const { login } = useAuth();

    // ============================================
    // HANDLE LOGIN
    // ============================================
    const handleLogin = async () => {
        // Don't allow empty fields
        if (!username.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter both username and password');
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
                Alert.alert('Login Failed', result.message || 'Invalid credentials');
            }
        } catch (error) {
            // Something went wrong (network error, server error, etc.)
            Alert.alert('Error', 'Something went wrong. Please try again.');
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
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                />

                {/* Password Input */}
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={true}
                    editable={!isLoading}
                />

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
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 15,
        fontSize: 16,
        marginBottom: 15,
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
});

export default LoginScreen;
