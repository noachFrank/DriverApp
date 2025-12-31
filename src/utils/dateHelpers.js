export const formatDayLabel = (dateString) => {
    if (!dateString) return '';

    // Parse UTC datetime and convert to local timezone
    // SQL Server datetimes don't include 'Z', so we append it to treat as UTC
    const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const scheduledDate = new Date(utcString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Compare just the date parts in local timezone (ignore time)
    const isSameDay = (d1, d2) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

    if (isSameDay(scheduledDate, today)) {
        return 'Today';
    } else if (isSameDay(scheduledDate, tomorrow)) {
        return 'Tomorrow';
    } else {
        // Return day of week (e.g., "Monday") in local timezone
        return scheduledDate.toLocaleDateString('en-US', { weekday: 'long' });
    }
};

export const formatTime = (dateString) => {
    if (!dateString) return '--';
    try {
        // SQL Server datetimes don't include 'Z', so we append it to treat as UTC
        const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
        const date = new Date(utcString);
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
        // SQL Server datetimes don't include 'Z', so we append it to treat as UTC
        const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
        const date = new Date(utcString);
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

/**
 * Format a TimeOnly string (HH:mm:ss) to 12-hour format (e.g., "2:30 PM")
 */
export const formatTimeOnly = (timeString) => {
    if (!timeString) return '--';
    try {
        // Parse time string (format: "HH:mm:ss" or "HH:mm")
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12; // Convert 0 to 12, keep 1-11, convert 13-23
        const minuteStr = minutes.toString().padStart(2, '0');
        return `${hour12}:${minuteStr} ${period}`;
    } catch {
        return '--';
    }
};