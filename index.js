//index.js
/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';

import App from './App';
import { name as appName } from './app.json';

import {
  handleBackgroundNotificationEvent,
} from './src/services/notificationHandlers';

// ============================================================================
// NOTIFEE BACKGROUND HANDLER
// ============================================================================

// Register exactly once, outside React components.
notifee.onBackgroundEvent(
  handleBackgroundNotificationEvent,
);

// ============================================================================
// REGISTER APPLICATION
// ============================================================================

AppRegistry.registerComponent(appName, () => App);
