import config, { apiClient, tokenManager } from '../config/apiConfig';

// Authentication API calls
export const authAPI = {
    login: async (userType, username, password) => {
        const response = await apiClient.post(config.ENDPOINTS.AUTH.LOGIN, {
            userType: userType,
            nameOrEmail: username,
            password: password
        });

        // Save JWT token if present in response
        if (response.data?.token) {
            tokenManager.setToken(response.data.token);
        }
        console.log('Login response data:', response.data);
        return response.data;
    },

    logout: async (userType, userId) => {
        const response = await apiClient.post(config.ENDPOINTS.AUTH.LOGOUT, {
            userType: userType,
            userId: userId
        });

        // Clear JWT token on logout
        tokenManager.removeToken();

        return response.data;
    },

    refreshToken: async () => {
        const response = await apiClient.post(config.ENDPOINTS.AUTH.REFRESH);

        // Update JWT token if present in response
        if (response.data?.token) {
            tokenManager.setToken(response.data.token);
        }

        return response.data;
    }
};

// Rides API
export const ridesAPI = {
    create: async (rideData) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.CREATE, rideData);
        return response.data;
    },

    getAll: async () => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.GET_ALL);
        return response.data;
    },

    getById: async (id) => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.GET_BY_ID, {
            params: { id }
        });
        return response.data;
    },

    getAssigned: async () => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.GET_ASSIGNED);
        return response.data;
    },

    getInProgress: async () => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.GET_IN_PROGRESS);
        return response.data;
    },

    getFuture: async () => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.GET_FUTURE);
        return response.data;
    },

    getToday: async () => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.GET_TODAY);
        return response.data;
    },

    getOpen: async (UserId) => {
        const response = await apiClient.get(`${config.ENDPOINTS.RIDES.GET_OPEN}/${UserId}`);
        return response.data;
    },

    update: async (id, rideData) => {
        const response = await apiClient.put(`${config.ENDPOINTS.RIDES.UPDATE}/${id}`, rideData);
        return response.data;
    },

    delete: async (id) => {
        const response = await apiClient.delete(`${config.ENDPOINTS.RIDES.DELETE}/${id}`);
        return response.data;
    },

    assign: async (assignData) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.ASSIGN, assignData);
        return response.data;
    },

    cancel: async (cancelData) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.CANCEL, cancelData);
        return response.data;
    },

    reassign: async (reassignData) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.REASSIGN, reassignData);
        return response.data;
    },

    pickup: async (rideId) => {
        // Server expects just the integer, not an object
        const response = await apiClient.post(config.ENDPOINTS.RIDES.PICKUP, rideId);
        return response.data;
    },

    dropoff: async (rideId) => {
        // Server expects just the integer, not an object
        const response = await apiClient.post(config.ENDPOINTS.RIDES.DROPOFF, rideId);
        return response.data;
    },

    updateStatus: async (statusData) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.UPDATE_STATUS, statusData);
        return response.data;
    },

    getDriverHistory: async (driverId) => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.DRIVER_HISTORY, {
            params: { driverId }
        });
        return response.data;
    },

    getAssignedByDriver: async (driverId) => {
        const response = await apiClient.get(config.ENDPOINTS.RIDES.GET_ASSIGNED_BY_DRIVER, {
            params: { driverId }
        });
        return response.data;
    },

    /**
     * Add a stop to an existing ride
     * @param {number} rideId - The ride ID
     * @param {string} address - The validated address to add as a stop
     */
    addStop: async (rideId, address) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.ADD_STOP, {
            RideId: rideId,
            Address: address
        });
        return response.data;
    },

    /**
     * Update the price of a ride
     * @param {number} rideId - The ride ID
     * @param {number} amount - The new total amount
     */
    updatePrice: async (rideId, amount) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.UPDATE_PRICE, {
            RideId: rideId,
            Amount: amount
        });
        return response.data;
    },

    /**
     * Add a tip to a ride
     * @param {number} rideId - The ride ID
     * @param {number} amount - The tip amount
     */
    addTip: async (rideId, amount) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.ADD_TIP, {
            RideId: rideId,
            Amount: amount
        });
        return response.data;
    },

    /**
     * Add wait time charge to a ride
     * @param {number} rideId - The ride ID
     * @param {number} amount - The wait time charge amount
     */
    addWaitTime: async (rideId, amount) => {
        const response = await apiClient.post(config.ENDPOINTS.RIDES.ADD_WAIT_TIME, {
            RideId: rideId,
            Amount: amount
        });
        return response.data;
    }
};

// Drivers API
export const driversAPI = {
    getAll: async () => {
        const response = await apiClient.get(config.ENDPOINTS.DRIVERS.GET_ALL);
        return response.data;
    },

    getById: async (id) => {
        const response = await apiClient.get(`${config.ENDPOINTS.DRIVERS.GET_BY_ID}?id=${id}`);
        return response.data;
    },

    getActive: async () => {
        const response = await apiClient.get(config.ENDPOINTS.DRIVERS.GET_ACTIVE);
        return response.data;
    },

    getDriving: async () => {
        const response = await apiClient.get(config.ENDPOINTS.DRIVERS.GET_DRIVING);
        return response.data;
    },

    create: async (driverData) => {
        const response = await apiClient.post(config.ENDPOINTS.DRIVERS.CREATE, driverData);
        return response.data;
    },

    update: async (driverData) => {
        const response = await apiClient.put(config.ENDPOINTS.DRIVERS.UPDATE, driverData);
        return response.data;
    },

    getDriverStatus: async (driverId) => {
        const response = await apiClient.get(config.ENDPOINTS.DRIVERS.GET_DRIVER_STATUS, {
            params: { userId: driverId }
        });
        return response.data;
    },

    updateStatus: async (driverId, status) => {
        const response = await apiClient.put(config.ENDPOINTS.DRIVERS.UPDATE_STATUS, {
            driverId,
            status
        });
        return response.data;
    }
};

// Dispatchers API
export const dispatchersAPI = {
    getActive: async () => {
        const response = await apiClient.get(config.ENDPOINTS.DISPATCHERS.GET_ACTIVE);
        return response.data;
    },

    getById: async (id) => {
        const response = await apiClient.get(`${config.ENDPOINTS.DISPATCHERS.GET_BY_ID}/${id}`);
        return response.data;
    },

    create: async (dispatcherData) => {
        const response = await apiClient.post(config.ENDPOINTS.DISPATCHERS.CREATE, dispatcherData);
        return response.data;
    },

    update: async (dispatcherData) => {
        const response = await apiClient.put(config.ENDPOINTS.DISPATCHERS.UPDATE, dispatcherData);
        return response.data;
    },

};

// Cars API
export const carsAPI = {
    getByDriver: async (driverId) => {
        const response = await apiClient.get(`${config.ENDPOINTS.CARS.GET_BY_DRIVER}?userId=${driverId}`);
        return response.data;
    },

    create: async (carData) => {
        const response = await apiClient.post(config.ENDPOINTS.CARS.CREATE, carData);
        return response.data;
    },

    update: async (carData) => {
        const response = await apiClient.post(config.ENDPOINTS.CARS.UPDATE, carData);
        return response.data;
    },

    setPrimary: async (carId) => {
        const response = await apiClient.post(config.ENDPOINTS.CARS.SET_PRIMARY, {
            carId: carId,
        });
        return response.data;
    },
};

export const communicationAPI = {
    getTodaysMessages: async (driverId) => {
        const response = await apiClient.get(config.ENDPOINTS.MESSAGES.GET_TODAY_MESSAGES, {
            params: { driverId }
        });
        return response.data;
    },

    /**
     * Get all messages (history) for a specific driver
     * @param {number} driverId - The driver's ID
     * @returns {Promise<Array>} Array of Communication objects
     */
    getAllMessages: async (driverId) => {
        const response = await apiClient.get(config.ENDPOINTS.MESSAGES.GET_ALL_MESSAGES, {
            params: { driverId }
        });
        return response.data;
    },

    /**
     * Get unread message count for a driver
     * @param {number} driverId - The driver's ID
     * @returns {Promise<number>} Count of unread messages
     */
    getUnreadCount: async (driverId) => {
        const response = await apiClient.get(config.ENDPOINTS.MESSAGES.GET_UNREAD_COUNT, {
            params: { driverId }
        });
        return response.data;
    },

    /**
     * Mark messages as read
     * @param {number[]} messageIds - Array of message IDs to mark as read
     */
    markAsRead: async (messageIds) => {
        const response = await apiClient.post(config.ENDPOINTS.MESSAGES.MARK_READ, messageIds);
        return response.data;
    }
};

// Messages API (legacy - use communicationAPI instead)
export const messagesAPI = {
    send: async (messageData) => {
        const response = await apiClient.post(config.ENDPOINTS.MESSAGES.SEND_MESSAGE, messageData);
        return response.data;
    },

    getTodayMessages: async () => {
        const response = await apiClient.get(config.ENDPOINTS.MESSAGES.GET_TODAY_MESSAGES);
        return response.data;
    },

    getAllMessages: async () => {
        const response = await apiClient.get(config.ENDPOINTS.MESSAGES.GET_ALL_MESSAGES);
        return response.data;
    },

    markAsRead: async (messageId) => {
        const response = await apiClient.post(config.ENDPOINTS.MESSAGES.MARK_READ, { messageId });
        return response.data;
    },

    getUnreadCount: async () => {
        const response = await apiClient.get(config.ENDPOINTS.MESSAGES.GET_UNREAD_COUNT);
        return response.data;
    }
};

// User API
export const userAPI = {
    getProfile: async () => {
        const response = await apiClient.get(config.ENDPOINTS.USER.GET_PROFILE);
        return response.data;
    },

    isAdmin: async (userId) => {
        const response = await apiClient.get(config.ENDPOINTS.USER.IS_ADMIN, {
            params: { userId }
        });
        return response.data;
    }
};

// Export token manager for use in other modules
export { tokenManager };