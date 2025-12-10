/**
 * AddressAutocomplete.jsx
 * 
 * A React Native component that provides Google Places autocomplete functionality.
 * 
 * HOW IT WORKS:
 * 1. User types in the text input
 * 2. After 3+ characters, we call Google Places Autocomplete API via HTTP
 * 3. We show a dropdown list of matching addresses
 * 4. When user taps an address, we call Google Places Details API to get the full address
 * 5. We call onChange with the validated, formatted address
 * 
 * WHY HTTP FETCH INSTEAD OF SDK:
 * - React Native cannot use the Google Maps JavaScript API (that's for web browsers)
 * - Using the REST API directly works on all platforms (iOS, Android, web)
 * - The Google Maps API key supports both web and REST API calls
 * 
 * PROPS:
 * - value: Current address value (string)
 * - onChange: Called when user selects a valid address - receives (formattedAddress, placeDetails)
 * - onInputChange: Called when user types - receives the raw input value
 * - placeholder: Placeholder text
 * - label: Label text to show above input
 * - disabled: Boolean to disable input
 * - colors: Theme colors object
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Keyboard,
    ScrollView
} from 'react-native';
import { GOOGLE_MAPS_API_KEY } from '../config/googleMapsConfig';

const AddressAutocomplete = ({
    value = '',
    onChange,
    onInputChange,
    placeholder = 'Enter address...',
    label,
    disabled = false,
    colors = {}
}) => {
    // State for the input value and predictions
    const [inputValue, setInputValue] = useState(value);
    const [predictions, setPredictions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // Debounce timer ref to avoid too many API calls
    const debounceTimer = useRef(null);

    // Update input value when external value changes
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    /**
     * Fetch address predictions from Google Places Autocomplete API
     * 
     * This is the same API that the web version uses, but we call it directly via HTTP
     * instead of using the JavaScript SDK.
     */
    const fetchPredictions = async (searchText) => {
        if (!searchText || searchText.length < 3) {
            setPredictions([]);
            setShowDropdown(false);
            return;
        }

        setIsLoading(true);

        try {
            // Google Places Autocomplete API endpoint
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchText)}&key=${GOOGLE_MAPS_API_KEY}&types=address&components=country:us`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.predictions) {
                setPredictions(data.predictions);
                setShowDropdown(true);
            } else {
                console.log('Places API response:', data.status);
                setPredictions([]);
                setShowDropdown(false);
            }
        } catch (error) {
            console.error('Error fetching address predictions:', error);
            setPredictions([]);
            setShowDropdown(false);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Handle text input change
     * Debounces the API call to avoid hitting the API on every keystroke
     */
    const handleInputChange = (text) => {
        setInputValue(text);

        // Notify parent of raw input change
        if (onInputChange) {
            onInputChange(text);
        }

        // Clear previous debounce timer
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Set new debounce timer (300ms delay)
        debounceTimer.current = setTimeout(() => {
            fetchPredictions(text);
        }, 300);
    };

    /**
     * Handle selection of a prediction
     * Fetches the full place details to get the formatted address
     */
    const handleSelect = async (prediction) => {
        setShowDropdown(false);
        setIsLoading(true);
        Keyboard.dismiss();

        try {
            // Google Places Details API endpoint
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=formatted_address,geometry&key=${GOOGLE_MAPS_API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.result) {
                const formattedAddress = data.result.formatted_address;
                setInputValue(formattedAddress);
                setPredictions([]);

                // Call onChange with the validated address and details
                if (onChange) {
                    onChange(formattedAddress, {
                        placeId: prediction.place_id,
                        formattedAddress: formattedAddress,
                        lat: data.result.geometry?.location?.lat,
                        lng: data.result.geometry?.location?.lng
                    });
                }
            } else {
                console.error('Places Details API error:', data.status);
                // Use the prediction description as fallback
                setInputValue(prediction.description);
                if (onChange) {
                    onChange(prediction.description, {
                        placeId: prediction.place_id,
                        formattedAddress: prediction.description
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching place details:', error);
            // Use prediction description as fallback
            setInputValue(prediction.description);
            if (onChange) {
                onChange(prediction.description, {
                    placeId: prediction.place_id,
                    formattedAddress: prediction.description
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Label */}
            {label && (
                <Text style={[styles.label, { color: colors.textSecondary || '#666' }]}>{label}</Text>
            )}

            {/* Input Container */}
            <View style={[
                styles.inputContainer,
                {
                    backgroundColor: colors.background || '#f5f5f5',
                    borderColor: showDropdown ? (colors.primary || '#007AFF') : (colors.divider || '#e0e0e0')
                }
            ]}>
                <TextInput
                    style={[styles.input, { color: colors.text || '#333' }]}
                    value={inputValue}
                    onChangeText={handleInputChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted || '#999'}
                    editable={!disabled}
                    autoCapitalize="words"
                    autoCorrect={false}
                    onFocus={() => {
                        if (predictions.length > 0) {
                            setShowDropdown(true);
                        }
                    }}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color={colors.primary || '#007AFF'} style={styles.loader} />
                )}
            </View>

            {/* Predictions Dropdown - Using ScrollView + map instead of FlatList to avoid nesting VirtualizedLists */}
            {showDropdown && predictions.length > 0 && (
                <View style={[styles.dropdown, { backgroundColor: colors.card || '#fff', borderColor: colors.divider || '#e0e0e0' }]}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                        style={styles.predictionsList}
                    >
                        {predictions.map((item) => (
                            <TouchableOpacity
                                key={item.place_id}
                                style={[styles.predictionItem, { backgroundColor: colors.card || '#fff' }]}
                                onPress={() => handleSelect(item)}
                            >
                                <Text style={styles.predictionIcon}>📍</Text>
                                <View style={styles.predictionTextContainer}>
                                    <Text style={[styles.predictionMain, { color: colors.text || '#333' }]} numberOfLines={1}>
                                        {item.structured_formatting?.main_text || item.description}
                                    </Text>
                                    <Text style={[styles.predictionSecondary, { color: colors.textSecondary || '#666' }]} numberOfLines={1}>
                                        {item.structured_formatting?.secondary_text || ''}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 10,
        zIndex: 1000, // Ensure dropdown appears above other elements
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 6,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        height: 44,
        fontSize: 16,
    },
    loader: {
        marginLeft: 8,
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        borderWidth: 1,
        borderRadius: 8,
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 5,
    },
    predictionsList: {
        maxHeight: 200,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    predictionIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    predictionTextContainer: {
        flex: 1,
    },
    predictionMain: {
        fontSize: 15,
        fontWeight: '500',
    },
    predictionSecondary: {
        fontSize: 13,
        marginTop: 2,
    },
});

export default AddressAutocomplete;
