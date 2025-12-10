/**
 * App.js - Main Entry Point
 * 
 * This is the "brain" of your app. It decides what screen to show.
 * 
 * HOW NAVIGATION WORKS:
 * Instead of using a navigation library, we use a simple approach:
 * 
 * 1. AuthContext keeps track of whether the user is logged in (isAuthenticated)
 * 2. App.js checks isAuthenticated:
 *    - If FALSE → show LoginScreen
 *    - If TRUE → show HomeScreen
 * 3. When the user logs in, AuthContext sets isAuthenticated = true
 * 4. React automatically re-renders App.js with the new value
 * 5. Now isAuthenticated is true, so HomeScreen is shown instead
 * 
 * This is called "conditional rendering" - we render different 
 * components based on some condition.
 * 
 * STRUCTURE:
 * App
 * └── AuthProvider (provides authentication state to all children)
 *     └── AppContent (decides which screen to show)
 *         ├── LoginScreen (if not logged in)
 *         └── HomeScreen (if logged in)
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { WaitTimeProvider } from './src/contexts/WaitTimeContext';

// Import our screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

/**
 * AppContent - The component that decides which screen to show
 * 
 * This is separated from App because it needs to use useAuth(),
 * and useAuth() can only be used INSIDE the AuthProvider.
 */
const AppContent = () => {
  // Get authentication state from AuthContext
  const { isAuthenticated, loading } = useAuth();
  // Get theme for StatusBar styling
  const { isDarkMode, theme } = useTheme();

  // ============================================
  // LOADING STATE
  // ============================================
  // When the app first opens, AuthContext checks AsyncStorage
  // to see if the user was previously logged in.
  // While checking, we show a loading spinner.
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // ============================================
  // CONDITIONAL RENDERING
  // ============================================
  // This is the key part - show different screens based on auth state
  // 
  // If isAuthenticated is false → show LoginScreen
  // If isAuthenticated is true → show HomeScreen
  //
  // When the user logs in:
  // 1. AuthContext.login() succeeds
  // 2. AuthContext sets isAuthenticated = true
  // 3. This component re-renders
  // 4. Now isAuthenticated is true, so HomeScreen is shown
  //
  // When the user logs out:
  // 1. AuthContext.logout() is called
  // 2. AuthContext sets isAuthenticated = false
  // 3. This component re-renders
  // 4. Now isAuthenticated is false, so LoginScreen is shown

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {isAuthenticated ? <HomeScreen /> : <LoginScreen />}
    </>
  );
};

/**
 * App - The root component
 * 
 * This wraps everything in AuthProvider and ThemeProvider so that any component
 * can access authentication state and theme using useAuth() and useTheme().
 */
const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WaitTimeProvider>
          <AppContent />
        </WaitTimeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default App;
