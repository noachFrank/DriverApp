/**
 * ErrorBoundary.jsx
 * 
 * Catches React errors and displays stack traces for debugging
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error);
        console.error('Error stack:', error.stack);
        console.error('Component stack:', errorInfo.componentStack);

        this.setState({
            error,
            errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerText}>⚠️ Error Occurred</Text>
                    </View>
                    <ScrollView style={styles.content}>
                        <Text style={styles.errorTitle}>Error Message:</Text>
                        <Text style={styles.errorText}>
                            {this.state.error && this.state.error.toString()}
                        </Text>

                        <Text style={styles.errorTitle}>Stack Trace:</Text>
                        <Text style={styles.errorText}>
                            {this.state.error && this.state.error.stack}
                        </Text>

                        <Text style={styles.errorTitle}>Component Stack:</Text>
                        <Text style={styles.errorText}>
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </Text>
                    </ScrollView>

                    {this.props.onReset && (
                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={() => {
                                this.setState({ hasError: false, error: null, errorInfo: null });
                                this.props.onReset();
                            }}
                        >
                            <Text style={styles.resetButtonText}>← Go Back</Text>
                        </TouchableOpacity>
                    )}
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        backgroundColor: '#FF3B30',
        padding: 16,
        paddingTop: 50,
    },
    headerText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: '#000',
    },
    errorText: {
        fontSize: 12,
        fontFamily: 'monospace',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 4,
        color: '#333',
    },
    resetButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        margin: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    resetButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ErrorBoundary;
