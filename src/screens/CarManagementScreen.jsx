/**
 * CarManagementScreen.jsx
 * 
 * Manages the driver's cars. Allows adding, editing, and setting primary car.
 * 
 * FEATURES:
 * - Lists all cars for the current driver
 * - Add new car button
 * - Edit existing cars
 * - Set primary car (the one used for driving)
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    Modal,
    TextInput,
    ScrollView
} from 'react-native';
import { carsAPI } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';

const CarManagementScreen = ({ onBack }) => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const colors = theme.colors;
    const { showAlert, showToast } = useAlert();
    const [cars, setCars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingCar, setEditingCar] = useState(null);

    // Car type options (matching server enum) with icons
    const CAR_TYPES = [
        { label: 'Car', value: 'Car', icon: '🚗' },
        { label: 'SUV', value: 'SUV', icon: '🚙' },
        { label: 'Mini Van', value: 'MiniVan', icon: '🚐' },
        { label: '12 Passenger', value: 'TwelvePass', icon: '🚌' },
        { label: '15 Passenger', value: 'FifteenPass', icon: '🚋' },
        { label: 'Luxury SUV', value: 'LuxurySUV', icon: '✨' },
        { label: 'Mercedes Sprinter', value: 'MercSprinter', icon: '🚎' }
    ];

    // Form state for add/edit modal
    const [formData, setFormData] = useState({
        make: '',
        model: '',
        year: '',
        color: '',
        licensePlate: '',
        type: 'Car',
        seats: '',
    });

    // Fetch cars from API
    const fetchCars = async () => {
        try {
            const data = await carsAPI.getByDriver(user.userId);
            console.log('Cars fetched:', data);
            setCars(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching cars:', error);
            setCars([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchCars();
    }, []);

    // Pull-to-refresh
    const onRefresh = () => {
        setRefreshing(true);
        fetchCars();
    };

    // Open modal for adding new car
    const handleAddCar = () => {
        setEditingCar(null);
        setFormData({
            make: '',
            model: '',
            year: '',
            color: '',
            licensePlate: '',
            type: 'Car',
            seats: '',
        });
        setModalVisible(true);
    };

    // Open modal for editing existing car
    const handleEditCar = (car) => {
        setEditingCar(car);
        setFormData({
            make: car.make || '',
            model: car.model || '',
            year: car.year ? String(car.year) : '',
            color: car.color || '',
            licensePlate: car.licensePlate || '',
            type: car.type || 'Car',
            seats: car.seats ? String(car.seats) : '',
        });
        setModalVisible(true);
    };

    // Save car (add or update)
    const handleSaveCar = async () => {
        // Validate required fields
        if (!formData.make.trim() || !formData.model.trim() || !formData.year.trim() || !formData.color.trim() || !formData.licensePlate.trim() || !formData.seats.trim()) {
            showAlert('Error',
                `Please fill in ${!formData.make.trim() ? 'Make, ' : ''}${!formData.model.trim() ? 'Model, ' : ''}${!formData.year.trim() ? 'Year, ' : ''}${!formData.color.trim() ? 'Color, ' : ''}${!formData.licensePlate.trim() ? 'License Plate, ' : ''}${!formData.seats.trim() ? 'Seats' : ''}`,
                [{ text: 'OK' }]);
            return;
        }

        const seatsNum = parseInt(formData.seats);
        if (isNaN(seatsNum) || seatsNum < 1) {
            showAlert('Error', 'Seats must be a valid number (at least 1)', [{ text: 'OK' }]);
            return;
        }

        setSaving(true);

        try {
            const carData = {
                ...formData,
                year: formData.year ? parseInt(formData.year) : null,
                seats: seatsNum,
                driverId: user.userId,
                isPrimary: false,

            };

            if (editingCar) {
                // Update existing car
                carData.carId = editingCar.carId;
                await carsAPI.update(carData);
                showToast('Car updated successfully', 'success');
            } else {
                // Add new car
                console.log();
                console.log();
                console.log();
                console.log();
                console.log();

                console.log('Creating car with data:', carData);
                await carsAPI.create(carData);
                showToast('Car added successfully', 'success');
            }

            setModalVisible(false);
            fetchCars(); // Refresh the list
        } catch (error) {
            console.error('Error saving car:', error);
            showAlert('Error', 'Failed to save car. Please try again.', [{ text: 'OK' }]);
        } finally {
            setSaving(false);
        }
    };

    // Set car as primary
    const handleSetPrimary = async (car) => {
        try {
            await carsAPI.setPrimary(car.carId);
            showToast(`${car.make} ${car.model} is now your primary car`, 'success');
            fetchCars(); // Refresh to show updated primary status
        } catch (error) {
            console.error('Error setting primary car:', error);
            showAlert('Error', 'Failed to set primary car. Please try again.', [{ text: 'OK' }]);
        }
    };

    // Helper to get display info for car type (label and icon)
    const getCarTypeInfo = (type) => {
        const found = CAR_TYPES.find(t => t.value === type);
        return found ? { label: found.label, icon: found.icon } : { label: type || 'Car', icon: '🚗' };
    };

    // Render individual car card
    const renderCarItem = ({ item }) => {
        const typeInfo = getCarTypeInfo(item.type);
        return (
            <View style={[styles.carCard, { backgroundColor: colors.card }, item.isPrimary && styles.primaryCard]}>
                {item.isPrimary && (
                    <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>⭐ PRIMARY</Text>
                    </View>
                )}

                <View style={styles.carInfo}>
                    <Text style={[styles.carTitle, { color: colors.text }]}>
                        {item.make} {item.model}
                    </Text>
                    {item.year && (
                        <Text style={[styles.carYear, { color: colors.textSecondary }]}>{item.year}</Text>
                    )}
                    <Text style={[styles.carDetail, { color: colors.textSecondary }]}>
                        {typeInfo.icon} {typeInfo.label}
                    </Text>
                    <Text style={[styles.carDetail, { color: colors.textSecondary }]}>
                        💺 {item.seats || '0'} seat{!item.seats || item.seats != 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.carDetail, { color: colors.textSecondary }]}>
                        🎨 {item.color || 'No color specified'}
                    </Text>
                    <Text style={[styles.carDetail, { color: colors.textSecondary }]}>
                        🔢 {item.licensePlate || 'No plate'}
                    </Text>
                </View>

                <View style={[styles.carActions, { borderTopColor: colors.divider }]}>
                    {!item.isPrimary && (
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => handleSetPrimary(item)}
                        >
                            <Text style={styles.primaryButtonText}>Set Primary</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.editButton, { backgroundColor: colors.primary }]}
                        onPress={() => handleEditCar(item)}
                    >
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Empty state
    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={[styles.emptyText, { color: colors.text }]}>No cars added yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Tap the button below to add your first car</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading cars...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Back Button Header - only shown when accessed from Account */}
            {onBack && (
                <View style={[styles.backHeader, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
                    <TouchableOpacity style={styles.backButton} onPress={onBack}>
                        <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Add Car Button */}
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddCar}>
                <Text style={styles.addButtonText}>+ Add New Car</Text>
            </TouchableOpacity>

            {/* Cars List */}
            <FlatList
                data={cars}
                keyExtractor={(item) => String(item.carId)}
                renderItem={renderCarItem}
                contentContainerStyle={cars.length === 0 ? styles.emptyList : styles.list}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                    />
                }
            />

            {/* Add/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {editingCar ? 'Edit Car' : 'Add New Car'}
                        </Text>

                        <ScrollView style={styles.formContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Make *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                value={formData.make}
                                onChangeText={(text) => setFormData({ ...formData, make: text })}
                                placeholder="e.g., Toyota"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Model *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                value={formData.model}
                                onChangeText={(text) => setFormData({ ...formData, model: text })}
                                placeholder="e.g., Camry"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Year</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                value={formData.year}
                                onChangeText={(text) => setFormData({ ...formData, year: text })}
                                placeholder="e.g., 2023"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Color</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                value={formData.color}
                                onChangeText={(text) => setFormData({ ...formData, color: text })}
                                placeholder="e.g., Black"
                                placeholderTextColor={colors.textMuted}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>License Plate *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                value={formData.licensePlate}
                                onChangeText={(text) => setFormData({ ...formData, licensePlate: text })}
                                placeholder="e.g., ABC-1234"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Seats *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.divider }]}
                                value={formData.seats}
                                onChangeText={(text) => setFormData({ ...formData, seats: text })}
                                placeholder="e.g., 5"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Car Type *</Text>
                            <View style={styles.typeButtonsContainer}>
                                {CAR_TYPES.map((carType) => (
                                    <TouchableOpacity
                                        key={carType.value}
                                        style={[
                                            styles.typeButton,
                                            { borderColor: colors.divider },
                                            formData.type === carType.value && [styles.typeButtonSelected, { backgroundColor: colors.primary, borderColor: colors.primary }]
                                        ]}
                                        onPress={() => setFormData({ ...formData, type: carType.value })}
                                    >
                                        <Text style={[
                                            styles.typeButtonText,
                                            { color: colors.text },
                                            formData.type === carType.value && styles.typeButtonTextSelected
                                        ]}>
                                            {carType.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={[styles.modalButtons, { borderTopColor: colors.divider }]}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: colors.background }]}
                                onPress={() => setModalVisible(false)}
                                disabled={saving}
                            >
                                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
                                onPress={handleSaveCar}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveButtonText}>
                                        {editingCar ? 'Update' : 'Add'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    backHeader: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    addButton: {
        backgroundColor: '#007AFF',
        margin: 15,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    list: {
        paddingHorizontal: 15,
        paddingTop: 15,
        paddingBottom: 15,
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    carCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    primaryCard: {
        borderColor: '#FFD700',
        borderWidth: 2,
    },
    primaryBadge: {
        position: 'absolute',
        top: -10,
        right: 10,
        backgroundColor: '#FFD700',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    primaryBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#333',
    },
    carInfo: {
        marginBottom: 10,
    },
    carTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    carYear: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    carDetail: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    carActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10,
    },
    primaryButton: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 6,
    },
    primaryButtonText: {
        color: '#333',
        fontWeight: '600',
    },
    editButton: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 6,
    },
    editButtonText: {
        color: '#333',
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 15,
    },
    emptyText: {
        fontSize: 18,
        color: '#666',
        marginBottom: 5,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 20,
        width: '90%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    formContainer: {
        maxHeight: 350,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 15,
    },
    typeButtonsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 15,
    },
    typeButton: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#f0f0f0',
    },
    typeButtonSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    typeButtonText: {
        fontSize: 14,
        color: '#333',
    },
    typeButtonTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 15,
        borderRadius: 8,
        marginRight: 10,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        marginLeft: 10,
        alignItems: 'center',
    },
    saveButtonDisabled: {
        backgroundColor: '#99c9ff',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CarManagementScreen;
