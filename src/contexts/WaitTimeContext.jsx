/**
 * WaitTimeContext.jsx
 * 
 * Global context for managing wait time timer that persists across screens.
 * The timer is TIED TO A SPECIFIC RIDE and continues running even when navigating away.
 * 
 * WAIT TIME FLOW:
 * 1. At Pickup: 5 minutes FREE wait time, then billable wait time starts
 * 2. At Stop 1-N: 3 minutes FREE wait time per stop, then billable wait time continues
 * 
 * The FREE wait time is NOT added to the total billable wait time.
 * Only time AFTER the free period counts.
 * 
 * PRICING (calculated in PaymentScreen):
 * - Sedan, Minivan: $0.50/min
 * - Lux SUV, 12-pass, 15-pass: $1.00/min
 * 
 * States:
 * - 'idle': No timer running, no ride association
 * - 'freeWait': In free wait period (5min pickup, 3min stops)
 * - 'billableWait': Free period ended, now accumulating billable time
 * - 'paused': Timer paused
 * - 'stopped': At a stop, waiting to click next button
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const WaitTimeContext = createContext(null);

// Free wait time constants (in seconds)
const FREE_WAIT_PICKUP_SECONDS = 5 * 60; // 5 minutes at pickup
const FREE_WAIT_STOP_SECONDS = 3 * 60;   // 3 minutes at each stop

export const useWaitTime = () => {
    const context = useContext(WaitTimeContext);
    if (!context) {
        throw new Error('useWaitTime must be used within a WaitTimeProvider');
    }
    return context;
};

export const WaitTimeProvider = ({ children }) => {
    // Core state
    const [billableWaitSeconds, setBillableWaitSeconds] = useState(0);  // Only billable time (after free period)
    const [freeWaitSeconds, setFreeWaitSeconds] = useState(0);          // Current free wait elapsed
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [activeRideId, setActiveRideId] = useState(null);
    const [timerState, setTimerState] = useState('idle');

    // Track which location we're at (for display purposes)
    const [currentLocation, setCurrentLocation] = useState(null); // 'pickup' | 'stop1' | 'stop2' | etc.
    const [currentFreeWaitMax, setCurrentFreeWaitMax] = useState(0); // Max free time for current location

    const timerRef = useRef(null);

    // Timer effect - runs when timer is started/stopped
    useEffect(() => {
        if (isTimerRunning) {
            timerRef.current = setInterval(() => {
                if (timerState === 'freeWait') {
                    // In free wait period - count up until we hit the max
                    setFreeWaitSeconds(prev => {
                        const newVal = prev + 1;
                        if (newVal >= currentFreeWaitMax) {
                            // Free period ended, switch to billable
                            setTimerState('billableWait');
                            console.log(`⏱️ Free wait period ended, now billing`);
                            return currentFreeWaitMax; // Cap at max
                        }
                        return newVal;
                    });
                } else if (timerState === 'billableWait') {
                    // In billable period - accumulate billable time
                    setBillableWaitSeconds(prev => prev + 1);
                }
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isTimerRunning, timerState, currentFreeWaitMax]);

    /**
     * Format seconds into MM:SS display
     */
    const formatTime = useCallback((totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    /**
     * Get formatted billable time string
     */
    const getFormattedBillableTime = useCallback(() => {
        return formatTime(billableWaitSeconds);
    }, [billableWaitSeconds, formatTime]);

    /**
     * Get formatted free time remaining
     */
    const getFormattedFreeTimeRemaining = useCallback(() => {
        const remaining = Math.max(0, currentFreeWaitMax - freeWaitSeconds);
        return formatTime(remaining);
    }, [freeWaitSeconds, currentFreeWaitMax, formatTime]);

    /**
     * Get formatted current timer display (shows free countdown or billable time)
     */
    const getFormattedTime = useCallback(() => {
        if (timerState === 'freeWait') {
            // Show remaining free time as countdown
            const remaining = Math.max(0, currentFreeWaitMax - freeWaitSeconds);
            return formatTime(remaining);
        }
        return formatTime(billableWaitSeconds);
    }, [timerState, freeWaitSeconds, currentFreeWaitMax, billableWaitSeconds, formatTime]);

    /**
     * Get wait time in minutes (rounded up) - billable only
     */
    const getWaitTimeMinutes = useCallback(() => {
        return Math.ceil(billableWaitSeconds / 60);
    }, [billableWaitSeconds]);

    /**
     * Check if a specific ride can start/control the timer
     */
    const canControlTimer = useCallback((rideId) => {
        if (!activeRideId) return true;
        return activeRideId === rideId;
    }, [activeRideId]);

    /**
     * Check if the timer has any accumulated billable time
     */
    const hasAccumulatedTime = useCallback((rideId) => {
        return activeRideId === rideId && billableWaitSeconds > 0;
    }, [activeRideId, billableWaitSeconds]);

    /**
     * Check if we're currently in free wait period
     */
    const isInFreeWaitPeriod = useCallback(() => {
        return timerState === 'freeWait';
    }, [timerState]);

    /**
     * Start "At Pickup" - driver arrived at pickup location
     * Starts 5-minute free wait, then billable wait
     */
    const startAtPickup = useCallback((rideId) => {
        if (!rideId) {
            console.warn('startAtPickup called without rideId');
            return false;
        }

        if (activeRideId && activeRideId !== rideId) {
            console.warn(`Timer already active for ride ${activeRideId}, cannot start for ride ${rideId}`);
            return false;
        }

        setActiveRideId(rideId);
        setCurrentLocation('pickup');
        setCurrentFreeWaitMax(FREE_WAIT_PICKUP_SECONDS);
        setFreeWaitSeconds(0);
        setIsTimerRunning(true);
        setTimerState('freeWait');
        console.log(`⏱️ At Pickup started for ride ${rideId} - 5 min free wait`);
        return true;
    }, [activeRideId]);

    /**
     * Start "At Stop X" - driver arrived at a stop
     * Starts 3-minute free wait, then continues billable wait
     */
    const startAtStop = useCallback((rideId, stopNumber) => {
        if (!rideId) {
            console.warn('startAtStop called without rideId');
            return false;
        }

        if (activeRideId && activeRideId !== rideId) {
            console.warn(`Timer already active for ride ${activeRideId}, cannot start for ride ${rideId}`);
            return false;
        }

        // Set or keep the active ride
        if (!activeRideId) {
            setActiveRideId(rideId);
        }

        setCurrentLocation(`stop${stopNumber}`);
        setCurrentFreeWaitMax(FREE_WAIT_STOP_SECONDS);
        setFreeWaitSeconds(0);
        setIsTimerRunning(true);
        setTimerState('freeWait');
        console.log(`⏱️ At Stop ${stopNumber} started for ride ${rideId} - 3 min free wait`);
        return true;
    }, [activeRideId]);

    /**
     * Pause the timer
     */
    const pauseTimer = useCallback((rideId) => {
        if (activeRideId !== rideId) return false;

        setIsTimerRunning(false);
        setTimerState('paused');
        console.log(`⏱️ Timer paused for ride ${rideId}`);
        return true;
    }, [activeRideId]);

    /**
     * Resume the timer
     */
    const resumeTimer = useCallback((rideId) => {
        if (activeRideId !== rideId) return false;
        if (timerState !== 'paused') return false;

        setIsTimerRunning(true);
        // Resume in free wait if we haven't exhausted it, otherwise billable
        if (freeWaitSeconds < currentFreeWaitMax) {
            setTimerState('freeWait');
        } else {
            setTimerState('billableWait');
        }
        console.log(`⏱️ Timer resumed for ride ${rideId}`);
        return true;
    }, [activeRideId, timerState, freeWaitSeconds, currentFreeWaitMax]);

    /**
     * Stop timer at current location (moving to next phase)
     * Called when driver clicks "Picked Up" or "Stop X" button
     */
    const stopAtCurrentLocation = useCallback((rideId) => {
        if (activeRideId !== rideId) return false;

        setIsTimerRunning(false);
        setTimerState('stopped');
        console.log(`⏱️ Timer stopped at ${currentLocation} for ride ${rideId}, billable: ${billableWaitSeconds}s`);
        return true;
    }, [activeRideId, currentLocation, billableWaitSeconds]);

    /**
     * Reset the timer - clears everything
     */
    const resetTimer = useCallback((rideId) => {
        if (activeRideId !== rideId) return false;

        setIsTimerRunning(false);
        setBillableWaitSeconds(0);
        setFreeWaitSeconds(0);
        setCurrentLocation(null);
        setCurrentFreeWaitMax(0);
        setActiveRideId(null);
        setTimerState('idle');
        console.log(`⏱️ Timer reset for ride ${rideId}`);
        return true;
    }, [activeRideId]);

    /**
     * Mark as picked up - stop any running timer at pickup
     */
    const markPickedUp = useCallback((rideId) => {
        if (activeRideId !== rideId) {
            return true;
        }

        // Stop timer when picked up
        setIsTimerRunning(false);
        setTimerState('stopped');
        console.log(`⏱️ Picked up for ride ${rideId}, billable wait: ${billableWaitSeconds}s`);
        return true;
    }, [activeRideId, billableWaitSeconds]);

    /**
     * Mark stop as complete - stop timer at this stop
     */
    const markStopComplete = useCallback((rideId, stopNumber) => {
        if (activeRideId !== rideId) return true;

        setIsTimerRunning(false);
        setTimerState('stopped');
        console.log(`⏱️ Stop ${stopNumber} complete for ride ${rideId}, total billable: ${billableWaitSeconds}s`);
        return true;
    }, [activeRideId, billableWaitSeconds]);

    /**
     * Get billable wait time for a specific ride (returns 0 if not the active ride)
     */
    const getWaitTimeForRide = useCallback((rideId) => {
        if (activeRideId !== rideId) return 0;
        return Math.ceil(billableWaitSeconds / 60);
    }, [activeRideId, billableWaitSeconds]);

    /**
     * Clear timer completely - called when ride is completed
     */
    const clearTimer = useCallback((rideId) => {
        if (activeRideId && activeRideId !== rideId) {
            return false;
        }

        setIsTimerRunning(false);
        setBillableWaitSeconds(0);
        setFreeWaitSeconds(0);
        setCurrentLocation(null);
        setCurrentFreeWaitMax(0);
        setActiveRideId(null);
        setTimerState('idle');
        console.log(`⏱️ Timer cleared for ride ${rideId}`);
        return true;
    }, [activeRideId]);

    /**
     * Check if timer is active for this ride (in any wait state)
     */
    const isTimerActiveForRide = useCallback((rideId) => {
        return activeRideId === rideId &&
            (timerState === 'freeWait' || timerState === 'billableWait' || timerState === 'paused');
    }, [activeRideId, timerState]);

    /**
     * Check if timer was ever started for this ride
     */
    const wasTimerStartedForRide = useCallback((rideId) => {
        return activeRideId === rideId && timerState !== 'idle';
    }, [activeRideId, timerState]);

    // Legacy compatibility - map old waitTimeSeconds to billableWaitSeconds
    const waitTimeSeconds = billableWaitSeconds;
    const startTimer = useCallback((rideId) => startAtPickup(rideId), [startAtPickup]);
    const stopTimer = useCallback(() => {
        setIsTimerRunning(false);
        setTimerState('paused');
    }, []);

    const value = {
        // State
        billableWaitSeconds,
        freeWaitSeconds,
        waitTimeSeconds, // Legacy compatibility
        isTimerRunning,
        activeRideId,
        timerState,
        currentLocation,
        currentFreeWaitMax,

        // Computed values
        formattedTime: getFormattedTime(),
        formattedBillableTime: getFormattedBillableTime(),
        formattedFreeTimeRemaining: getFormattedFreeTimeRemaining(),
        waitTimeMinutes: getWaitTimeMinutes(),
        isInFreeWait: timerState === 'freeWait',

        // New flow methods
        startAtPickup,
        startAtStop,
        stopAtCurrentLocation,
        markPickedUp,
        markStopComplete,
        pauseTimer,
        resumeTimer,
        resetTimer,
        clearTimer,

        // Query methods
        canControlTimer,
        hasAccumulatedTime,
        isInFreeWaitPeriod,
        getWaitTimeForRide,
        isTimerActiveForRide,
        wasTimerStartedForRide,

        // Legacy compatibility
        startTimer,
        stopTimer,
        formatTime,
    };

    return (
        <WaitTimeContext.Provider value={value}>
            {children}
        </WaitTimeContext.Provider>
    );
};

export default WaitTimeContext;
