import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePasswordScreen({ navigation }) {
    const { user } = useAuth();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const result = await userAPI.updatePassword(user.userId, oldPassword, newPassword);
            if (result.success) {
                Alert.alert('Success', 'Password updated successfully', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            } else {
                Alert.alert('Error', result.message || 'Failed to update password');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        Alert.alert(
            'Reset Password',
            'A new password will be sent to your email address on file.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const result = await userAPI.forgotPassword(user.userId);
                            Alert.alert('Success', result.message);
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Failed to reset password');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>Change Password</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Current Password</Text>
                    <View style={styles.passwordInput}>
                        <TextInput
                            style={styles.input}
                            value={oldPassword}
                            onChangeText={setOldPassword}
                            secureTextEntry={!showOldPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)}>
                            <Ionicons
                                name={showOldPassword ? 'eye-off' : 'eye'}
                                size={24}
                                color="#666"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.passwordInput}>
                        <TextInput
                            style={styles.input}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showNewPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                            <Ionicons
                                name={showNewPassword ? 'eye-off' : 'eye'}
                                size={24}
                                color="#666"
                            />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.hint}>Must be at least 6 characters</Text>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <View style={styles.passwordInput}>
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                            <Ionicons
                                name={showConfirmPassword ? 'eye-off' : 'eye'}
                                size={24}
                                color="#666"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Update Password</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.forgotButton}
                    onPress={handleForgotPassword}
                    disabled={loading}
                >
                    <Text style={styles.forgotButtonText}>Forgot Password? Reset via Email</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0'
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    form: {
        padding: 16
    },
    inputContainer: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333'
    },
    passwordInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingRight: 12
    },
    input: {
        flex: 1,
        padding: 12,
        fontSize: 16
    },
    hint: {
        fontSize: 12,
        color: '#666',
        marginTop: 4
    },
    submitButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    forgotButton: {
        padding: 16,
        alignItems: 'center'
    },
    forgotButtonText: {
        color: '#007AFF',
        fontSize: 14
    }
});
