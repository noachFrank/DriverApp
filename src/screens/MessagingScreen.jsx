/**
 * MessagingScreen.jsx
 * 
 * Full messaging screen for driver-dispatcher communication.
 * 
 * FEATURES:
 * - Fetches today's conversation from /api/Communication/TodaysCom
 * - Chat-style UI with driver messages on right side, dispatcher messages on left
 * - Text input at bottom with send button
 * - Messages sent via SignalR to notify all dispatchers in real-time
 * - Auto-scrolls to latest message
 * - Refreshes conversation after sending a message
 * 
 * REAL-TIME:
 * - Listens for ReceiveMessage SignalR events for incoming messages
 * - Incoming messages are added to the conversation immediately
 * 
 * DATA STRUCTURE (Communication from server):
 * - id: number
 * - message: string
 * - driverId: number
 * - from: string ("Driver-{id}" or "Dispatcher-{id}" or "Broadcast")
 * - date: string (ISO date)
 * - read: boolean
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { communicationAPI } from '../services/apiService';
import signalRService from '../services/signalRService';

const MessagingScreen = ({ onUnreadCountChange, initialMessage = '', onBack, showBackButton }) => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const colors = theme.colors;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState(initialMessage);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [firstUnreadIndex, setFirstUnreadIndex] = useState(-1); // Index of first unread message
    const flatListRef = useRef(null);
    const hasInitiallyScrolled = useRef(false);

    // Fetch today's messages on mount
    useEffect(() => {
        if (user?.userId) {
            fetchMessages();
        }
    }, [user]);

    // Set up SignalR listener for incoming messages
    useEffect(() => {
        const unsubscribe = signalRService.onMessageReceived((messageData) => {
            console.log('New message received:', messageData);

            // Handle both camelCase and PascalCase from server
            const newMsg = {
                id: messageData.id,
                message: messageData.message,
                driverId: user?.userId,
                from: messageData.from || messageData.From || 'Dispatcher',
                date: messageData.timestamp || messageData.Date || new Date().toISOString(),
                read: false
            };

            // Add to beginning for inverted list (newest messages are at index 0)
            setMessages(prev => [newMsg, ...prev]);

            // Scroll to top (which is visually the bottom in inverted list)
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);
        });

        return () => {
            unsubscribe();
        };
    }, [user]);

    // Prefill input if initialMessage changes (e.g., when coming from ride)
    useEffect(() => {
        if (initialMessage) {
            setNewMessage(initialMessage);
        }
    }, [initialMessage]);

    /**
     * Fetch today's messages from the API and mark unread as read
     */
    const fetchMessages = async () => {
        try {
            setLoading(true);
            const allMessages = await communicationAPI.getAllMessages(user.userId);
            console.log('Fetched messages:', allMessages);

            const msgArray = allMessages || [];

            // Helper to check if message is read (handle both camelCase and PascalCase)
            const isMessageRead = (msg) => msg.read === true || msg.Read === true;
            const getMessageFrom = (msg) => (msg.from || msg.From || '').toLowerCase();

            // Find first unread message index (from dispatcher/broadcast, not driver)
            const firstUnreadIdx = msgArray.findIndex(
                msg => !isMessageRead(msg) && !getMessageFrom(msg).startsWith('driver')
            );
            console.log('First unread index:', firstUnreadIdx, 'Total messages:', msgArray.length);
            setFirstUnreadIndex(firstUnreadIdx);

            // Reset scroll flag so we scroll on next render
            hasInitiallyScrolled.current = false;

            // Reverse messages for inverted FlatList (newest at bottom visually)
            // In inverted list, index 0 is at the bottom, so we reverse the array
            const reversedMessages = [...msgArray].reverse();

            // Calculate the reversed index for showing the unread divider
            // Original: [read, read, UNREAD, UNREAD] - firstUnreadIdx = 2
            // Reversed: [UNREAD, UNREAD, read, read] - we want divider AFTER index that corresponds to LAST unread
            // In reversed array, the LAST unread is at index (total - 1 - firstUnreadIdx)
            // The divider should appear AFTER this message (which visually appears ABOVE it due to inversion)
            // So we show divider at the index of the LAST unread message in reversed array
            const reversedUnreadIdx = firstUnreadIdx >= 0
                ? msgArray.length - 1 - firstUnreadIdx
                : -1;
            console.log('Reversed unread index:', reversedUnreadIdx, 'will show divider after this index');

            setMessages(reversedMessages);
            // Store the reversed index for the divider position
            setFirstUnreadIndex(reversedUnreadIdx);

            // Find unread messages from dispatcher (not from driver)
            const unreadIds = msgArray
                .filter(msg => !isMessageRead(msg) && !getMessageFrom(msg).startsWith('driver'))
                .map(msg => msg.id || msg.Id);

            // Mark unread messages as read after a short delay (so user sees them as unread first)
            if (unreadIds.length > 0) {
                setTimeout(async () => {
                    try {
                        await communicationAPI.markAsRead(unreadIds);
                        console.log('Marked messages as read:', unreadIds);
                        // Notify parent that unread count changed
                        onUnreadCountChange?.(0);
                    } catch (error) {
                        console.error('Error marking messages as read:', error);
                    }
                }, 1000); // Wait 1 second so user can see unread indicator
            } else {
                // No unread messages, still notify parent
                onUnreadCountChange?.(0);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            // Don't show error for 204 No Content (empty messages)
            if (error.response?.status !== 204) {
                Alert.alert('Error', 'Failed to load messages. Please try again.');
            }
            setMessages([]);
            setFirstUnreadIndex(-1);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Send a message to all dispatchers via SignalR
     */
    const handleSendMessage = async () => {
        if (!newMessage.trim()) {
            return;
        }

        const messageText = newMessage.trim();
        setNewMessage(''); // Clear input immediately for better UX
        setSending(true);

        try {
            // Send via SignalR - this will:
            // 1. Save to database on server
            // 2. Notify all connected dispatchers
            await signalRService.sendMessageToDispatchers(messageText);

            // Add the message to our local list immediately (optimistic update)
            // Add to beginning for inverted list (newest at index 0)
            const sentMessage = {
                id: Date.now(), // Temporary ID until we refresh
                message: messageText,
                driverId: user?.userId,
                from: `Driver-${user?.userId}`,
                date: new Date().toISOString(),
                read: false
            };

            setMessages(prev => [sentMessage, ...prev]);

            // Scroll to top (which is visually the bottom in inverted list)
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);

            console.log('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message. Please try again.');
            // Restore the message in the input if sending failed
            setNewMessage(messageText);
        } finally {
            setSending(false);
        }
    };

    /**
     * Determine if a message is from the driver (current user)
     */
    const isDriverMessage = (msg) => {
        const from = msg.from || msg.From || '';
        return from.toLowerCase().startsWith('driver');
    };

    /**
     * Format the timestamp for display
     */
    const formatTime = (dateString) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    /**
     * Get a friendly sender name
     */
    const getSenderName = (msg) => {
        const from = (msg.from || msg.From || '').toLowerCase();
        if (!from) return 'Unknown';

        if (from.startsWith('driver')) {
            return 'You';
        } else if (from === 'broadcast') {
            return '📢 Broadcast';
        } else if (from.startsWith('dispatcher')) {
            return 'Dispatch';
        }
        return msg.from || msg.From;
    };

    /**
     * Render unread divider line
     */
    const renderUnreadDivider = () => (
        <View style={styles.unreadDividerContainer}>
            <View style={[styles.unreadDividerLine, { backgroundColor: colors.error }]} />
            <Text style={[styles.unreadDividerText, { color: colors.error }]}>unread</Text>
            <View style={[styles.unreadDividerLine, { backgroundColor: colors.error }]} />
        </View>
    );

    /**
     * Render a single message bubble
     */
    const renderMessage = ({ item, index }) => {
        const isDriver = isDriverMessage(item);
        const msgFrom = (item.from || item.From || '').toLowerCase();
        const isBroadcast = msgFrom === 'broadcast';
        const isRead = item.read === true || item.Read === true;
        const isUnread = !isRead && !isDriver;
        // In inverted list, show divider at index ABOVE the last unread (firstUnreadIndex + 1)
        // This makes the divider appear visually between read and unread messages
        const showUnreadDivider = firstUnreadIndex >= 0 && index === firstUnreadIndex;

        return (
            <View>
                {/* Unread divider - shown BEFORE message in render, appears BELOW in inverted view */}
                {showUnreadDivider && renderUnreadDivider()}

                <View style={[
                    styles.messageContainer,
                    isDriver ? styles.driverMessageContainer : styles.dispatcherMessageContainer
                ]}>
                    {/* Sender label for dispatcher messages */}
                    {!isDriver && (
                        <View style={styles.senderRow}>
                            <Text style={[
                                styles.senderLabel,
                                { color: colors.textSecondary },
                                isBroadcast && styles.broadcastLabel
                            ]}>
                                {getSenderName(item)}
                            </Text>
                            {isUnread && <View style={styles.unreadDot} />}
                        </View>
                    )}

                    {/* Message bubble */}
                    <View style={[
                        styles.messageBubble,
                        isDriver ? styles.driverBubble : [styles.dispatcherBubble, { backgroundColor: colors.card }],
                        isBroadcast && styles.broadcastBubble,
                        isUnread && styles.unreadBubble
                    ]}>
                        <Text style={[
                            styles.messageText,
                            isDriver ? styles.driverMessageText : [styles.dispatcherMessageText, { color: colors.text }],
                            isBroadcast && { color: '#333' }
                        ]}>
                            {item.message || item.Message}
                        </Text>
                    </View>

                    {/* Timestamp and read status for driver messages */}
                    <View style={[
                        styles.timestampRow,
                        isDriver ? styles.driverTimestampRow : styles.dispatcherTimestampRow
                    ]}>
                        <Text style={[
                            styles.timestamp,
                            { color: colors.textMuted },
                            isDriver ? styles.driverTimestamp : styles.dispatcherTimestamp
                        ]}>
                            {formatTime(item.date || item.Date)}
                        </Text>
                        {/* Show read receipt for driver's sent messages */}
                        {isDriver && (
                            <Text style={isRead ? styles.read : styles.unread}>
                                {isRead ? '✓✓' : '✓'}
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    /**
     * Render empty state when no messages
     */
    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Messages Today</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Send a message to dispatch below
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.success} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading messages...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 70}
        >
            {/* Back Button - Only shown when opened from CurrentCallScreen */}
            {showBackButton && onBack && (
                <View style={[styles.backButtonContainer, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
                    <TouchableOpacity style={styles.backButton} onPress={onBack}>
                        <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back to Call</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Messages List - Inverted so newest messages appear at bottom */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item, index) => (item.id || item.Id || index).toString()}
                renderItem={renderMessage}
                inverted={true}
                contentContainerStyle={[
                    styles.messagesList,
                    messages.length === 0 && styles.emptyList
                ]}
                ListEmptyComponent={renderEmptyState}
                onContentSizeChange={() => {
                    // Only scroll once after initial load if there are unread messages
                    if (!hasInitiallyScrolled.current && messages.length > 0 && flatListRef.current) {
                        hasInitiallyScrolled.current = true;
                        if (firstUnreadIndex >= 0) {
                            // Scroll to first unread message (in inverted list)
                            flatListRef.current.scrollToIndex({
                                index: firstUnreadIndex,
                                animated: false,
                                viewPosition: 1 // Position at bottom of view
                            });
                        }
                        // If no unread, inverted list already shows newest at bottom - no scroll needed
                    }
                }}
                onScrollToIndexFailed={() => {
                    // Fallback - just stay at default position (newest messages)
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
            />

            {/* Message Input Area */}
            <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.divider }]}>
                <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.text }]}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="Type a message to dispatch..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={500}
                    editable={!sending}
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!newMessage.trim() || sending) && styles.sendButtonDisabled
                    ]}
                    onPress={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.sendButtonText}>Send</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    messagesList: {
        padding: 15,
        paddingBottom: 10,
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
    },
    messageContainer: {
        marginVertical: 4,
        maxWidth: '80%',
    },
    driverMessageContainer: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    dispatcherMessageContainer: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    senderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
        marginLeft: 8,
    },
    senderLabel: {
        fontSize: 12,
        color: '#666',
    },
    broadcastLabel: {
        color: '#e74c3c',
        fontWeight: '600',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#007AFF',
        marginLeft: 6,
    },
    unreadBubble: {
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    messageBubble: {
        padding: 12,
        borderRadius: 18,
        maxWidth: '100%',
    },
    driverBubble: {
        backgroundColor: '#25D366',
        borderBottomRightRadius: 4,
    },
    dispatcherBubble: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    broadcastBubble: {
        backgroundColor: '#fff3cd',
        borderWidth: 1,
        borderColor: '#ffc107',
    },
    unreadDividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 15,
        paddingHorizontal: 10,
    },
    unreadDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#007AFF',
    },
    unreadDividerText: {
        color: '#007AFF',
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 10,
        textTransform: 'lowercase',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    driverMessageText: {
        color: '#fff',
    },
    dispatcherMessageText: {
        color: '#333',
    },
    timestamp: {
        fontSize: 11,
        color: '#999',
        marginTop: 2,
        marginHorizontal: 8,
    },
    timestampRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        marginHorizontal: 8,
    },
    driverTimestampRow: {
        justifyContent: 'flex-end',
    },
    dispatcherTimestampRow: {
        justifyContent: 'flex-start',
    },
    driverTimestamp: {
        textAlign: 'right',
    },
    dispatcherTimestamp: {
        textAlign: 'left',
    },
    read: {
        fontSize: 12,
        color: '#007AFF',
        marginLeft: 4,
        fontWeight: '600',
    },
    unread: {
        fontSize: 12,
        color: '#818981ff',
        marginLeft: 4,
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        paddingBottom: Platform.OS === 'ios' ? 25 : 10,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        alignItems: 'flex-end',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        paddingTop: 10,
        fontSize: 16,
        maxHeight: 100,
        marginRight: 10,
    },
    sendButton: {
        backgroundColor: '#25D366',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 60,
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 15,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    backButtonContainer: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        backgroundColor: '#fff',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 17,
        fontWeight: '500',
    },
});

export default MessagingScreen;
