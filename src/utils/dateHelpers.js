export const formatDayLabel = (dateString) => {
    if (!dateString) return '';

    const scheduledDate = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Compare just the date parts (ignore time)
    const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    if (isSameDay(scheduledDate, today)) {
        return 'Today';
    } else if (isSameDay(scheduledDate, tomorrow)) {
        return 'Tomorrow';
    } else {
        // Return day of week (e.g., "Monday")
        return scheduledDate.toLocaleDateString('en-US', { weekday: 'long' });
    }
};

export const formatTime = (dateString) => {
    if (!dateString) return '--';
    try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return '--';
    }
};

export const formatDate = (dateString) => {
    if (!dateString) return '--';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return '--';
    }
};

/**
 * Format estimated duration from TimeOnly format (HH:mm:ss) to readable string
 * e.g., "01:52:00" -> "1 hr 52 min"
 * e.g., "00:30:00" -> "30 min"
 */
export const formatEstimatedDuration = (timeString) => {
    if (!timeString) return null;

    try {
        // Handle TimeOnly format (HH:mm:ss)
        const parts = timeString.split(':');
        if (parts.length >= 2) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);

            if (hours === 0 && minutes === 0) return null;

            if (hours > 0) {
                return `${hours} hr ${minutes} min`;
            } else {
                return `${minutes} min`;
            }
        }
        return null;
    } catch {
        return null;
    }
};