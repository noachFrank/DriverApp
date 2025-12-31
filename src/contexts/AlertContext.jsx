import React, { createContext, useContext, useState } from 'react';
import CustomAlert from '../components/CustomAlert';
import Toast from '../components/Toast';

const AlertContext = createContext();

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within AlertProvider');
    }
    return context;
};

export const AlertProvider = ({ children }) => {
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    /**
     * Show a confirmation dialog (MessageBox.Show style)
     * @param {string} title - Alert title
     * @param {string} message - Alert message
     * @param {Array} buttons - Array of button objects with text, onPress, and optional style
     * 
     * @example
     * showAlert('Confirm', 'Are you sure?', [
     *   { text: 'Cancel', style: 'cancel' },
     *   { text: 'OK', onPress: () => console.log('OK pressed') }
     * ]);
     */
    const showAlert = (title, message, buttons = [{ text: 'OK' }]) => {
        setAlert({ visible: true, title, message, buttons });
    };

    /**
     * Show a toast notification (auto-dismisses)
     * @param {string} message - Toast message
     * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in ms (default: 3000)
     * 
     * @example
     * showToast('Call accepted successfully!', 'success');
     * showToast('Failed to connect', 'error');
     */
    const showToast = (message, type = 'success', duration = 3000) => {
        setToast({ visible: true, message, type, duration });
    };

    const hideAlert = () => {
        setAlert({ visible: false, title: '', message: '', buttons: [] });
    };

    const hideToast = () => {
        setToast({ visible: false, message: '', type: 'success' });
    };

    return (
        <AlertContext.Provider value={{ showAlert, showToast }}>
            {children}
            <CustomAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                buttons={alert.buttons}
                onDismiss={hideAlert}
            />
            {toast.visible && (
                <Toast
                    visible={toast.visible}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onDismiss={hideToast}
                />
            )}
        </AlertContext.Provider>
    );
};
