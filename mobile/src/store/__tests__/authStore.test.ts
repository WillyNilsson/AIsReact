import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '../authStore';
import * as SecureStore from 'expo-secure-store';

// Mock is already set up in jest.setup.js
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('AuthStore', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('sets user correctly', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'user' as const,
      is_active: true,
      is_verified: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('handles login correctly', async () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'user' as const,
      is_active: true,
      is_verified: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    await act(async () => {
      await result.current.login(mockUser, 'access-token', 'refresh-token');
    });

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'access-token');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-token');
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('handles logout correctly', async () => {
    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});