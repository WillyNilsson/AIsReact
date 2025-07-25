# aisreact Mobile App

React Native mobile application for aisreact - observe how different AI models react to real-world news and events.

## Features

- 📱 **Native Mobile Experience**: Built with React Native and Expo
- 🔐 **Secure Authentication**: JWT token management with Expo SecureStore
- 📰 **Live Feed**: Browse AI-analyzed news and events
- 🤖 **AI Comparisons**: View side-by-side AI model responses
- 🎨 **Dark Theme**: Consistent with web app design
- ⚡ **Optimized Performance**: Virtual scrolling and image optimization

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation v6
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **UI Components**: Custom components with React Native Paper
- **Forms**: React Hook Form with Zod validation
- **Authentication**: JWT with Expo SecureStore

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

1. Navigate to the mobile directory:

   ```bash
   cd mobile
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm start
   ```

4. Run on your preferred platform:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on your device

## Project Structure

```
mobile/
├── src/
│   ├── api/          # API client and configuration
│   ├── components/   # Reusable UI components
│   ├── config/       # App configuration and constants
│   ├── navigation/   # Navigation setup and types
│   ├── screens/      # Screen components
│   ├── store/        # Zustand stores
│   └── types/        # TypeScript type definitions
├── App.tsx           # Root component
├── app.json         # Expo configuration
└── package.json     # Dependencies
```

## Development

### API Configuration

The app connects to the backend API. Update the API URL in `src/config/constants.ts`:

```typescript
export const API_BASE_URL = Platform.select({
  ios: "http://localhost:8000/api",
  android: "http://10.0.2.2:8000/api",
  default: "http://localhost:8000/api",
});
```

### Authentication Flow

1. User enters credentials on login screen
2. App sends credentials to `/auth/token/` endpoint
3. Receives JWT tokens (access & refresh)
4. Stores tokens securely using Expo SecureStore
5. Includes access token in all API requests
6. Automatically refreshes token when expired

### Key Components

- **FeedCard**: Displays post preview with status badge
- **AIResponseCard**: Shows individual AI model response
- **VirtualList**: Optimized scrolling for long lists
- **SecureTextInput**: Password input with visibility toggle

## Building for Production

### iOS

1. Configure app.json with your bundle identifier
2. Run `expo build:ios`
3. Follow Expo's guide for App Store submission

### Android

1. Configure app.json with your package name
2. Run `expo build:android`
3. Upload APK/AAB to Google Play Console

## Troubleshooting

### Common Issues

1. **Metro bundler issues**: Clear cache with `expo start -c`
2. **iOS Simulator not opening**: Run `sudo xcode-select -s /Applications/Xcode.app`
3. **Android Emulator connection**: Ensure emulator is running before starting app

### Debug Mode

Enable debug mode in the app by shaking device or pressing:

- iOS: Cmd + D
- Android: Cmd + M (Mac) or Ctrl + M (Windows/Linux)

## Contributing

1. Follow the same code style as the web app
2. Write TypeScript types for all props and state
3. Test on both iOS and Android
4. Ensure accessibility features work properly

## Future Enhancements

- [ ] Push notifications for new analyses
- [ ] Offline support with data persistence
- [ ] Biometric authentication
- [ ] Image upload from camera/gallery
- [ ] Share functionality
- [ ] Dark/Light theme toggle
- [ ] Localization support
