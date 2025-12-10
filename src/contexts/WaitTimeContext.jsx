/**
 * WaitTimeContext.jsx
 * 
 * Global context for managing wait time timer that persists across screens.
 * The timer continues running even when the user navigates away from CurrentCallScreen.
 * 
 * FEATURES:
 * - Start/stop timer from anywhere
 * - Timer persists across screen navigation
 * - Provides formatted time and minutes for display/calculation
 * - Reset timer functionality (only from CurrentCallScreen)
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const WaitTimeContext = createContext(null);

export const useWaitTime = () => {
    const context = useContext(WaitTimeContext);
    if (!context) {
        throw new Error('useWaitTime must be used within a WaitTimeProvider');
    }
    return context;
};

export const WaitTimeProvider = ({ children }) => {
    const [waitTimeSeconds, setWaitTimeSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [activeRideId, setActiveRideId] = useState(null);
    const timerRef = useRef(null);

    // Timer effect - runs when timer is started/stopped
    useEffect(() => {
        if (isTimerRunning) {
            timerRef.current = setInterval(() => {
                setWaitTimeSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        // Cleanup on unmount
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isTimerRunning]);

    /**
     * Format seconds into MM:SS display
     */
    const formatTime = useCallback((totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    /**
     * Get formatted time string
     */
    const getFormattedTime = useCallback(() => {
        return formatTime(waitTimeSeconds);
    }, [waitTimeSeconds, formatTime]);

    /**
     * Get wait time in minutes (rounded up)
     */
    const getWaitTimeMinutes = useCallback(() => {
        return Math.ceil(waitTimeSeconds / 60);
    }, [waitTimeSeconds]);

    /**
     * Start the wait time timer for a specific ride
     */
    const startTimer = useCallback((rideId = null) => {
        if (rideId) {
            setActiveRideId(rideId);
        }
        setIsTimerRunning(true);
    }, []);

    /**
     * Stop the wait time timer
     */
    const stopTimer = useCallback(() => {
        setIsTimerRunning(false);
    }, []);

    /**
     * Reset the wait time timer (clears time and stops)
     */
    const resetTimer = useCallback(() => {
        setIsTimerRunning(false);
        setWaitTimeSeconds(0);
    }, []);

    /**
     * Clear timer completely (reset + clear ride association)
     * Called when ride is completed
     */
    const clearTimer = useCallback(() => {
        setIsTimerRunning(false);
        setWaitTimeSeconds(0);
        setActiveRideId(null);
    }, []);

    const value = {
        // State
        waitTimeSeconds,
        isTimerRunning,
        activeRideId,

        // Computed values
        formattedTime: getFormattedTime(),
        waitTimeMinutes: getWaitTimeMinutes(),

        // Actions
        startTimer,
        stopTimer,
        resetTimer,
        clearTimer,

        // Helpers
        formatTime,
    };

    return (
        <WaitTimeContext.Provider value={value}>
            {children}
        </WaitTimeContext.Provider>
    );
};

export default WaitTimeContext;
