import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FeedCard } from '../FeedCard';
import { PostFeedItem, PostStatus } from '../../types';

const mockPost: PostFeedItem = {
  id: 1,
  user: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    is_active: true,
    is_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  title: 'Test Post Title',
  content: 'This is a test post content that should be displayed in the feed card.',
  source_url: 'https://example.com',
  status: PostStatus.LIVE,
  created_at: '2024-01-01T00:00:00Z',
  verification_score: 85,
  verification_count: 10,
  ai_response_count: 5,
};

describe('FeedCard', () => {
  it('renders post information correctly', () => {
    const onPress = jest.fn();
    const { getByText, queryByText } = render(<FeedCard post={mockPost} onPress={onPress} />);

    // Check if title is rendered
    expect(getByText('Test Post Title')).toBeTruthy();
    
    // Check if content is rendered
    expect(getByText('This is a test post content that should be displayed in the feed card.')).toBeTruthy();
    
    // Check if username is rendered
    expect(getByText('testuser')).toBeTruthy();
    
    // Check if status is rendered (case insensitive)
    const statusElement = queryByText(/live/i);
    expect(statusElement).toBeTruthy();
  });

  it('calls onPress when card is tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<FeedCard post={mockPost} onPress={onPress} />);

    fireEvent.press(getByText('Test Post Title'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('displays AI response count when available', () => {
    const onPress = jest.fn();
    const { queryByText } = render(<FeedCard post={mockPost} onPress={onPress} />);

    // AI response count might be rendered with additional text
    const aiCountElement = queryByText(/5/);
    expect(aiCountElement).toBeTruthy();
  });

  it('handles posts without AI responses', () => {
    const postWithoutAI = { ...mockPost, ai_response_count: 0 };
    const onPress = jest.fn();
    const { queryByText } = render(<FeedCard post={postWithoutAI} onPress={onPress} />);

    // Should still render but not show 0
    expect(queryByText('0')).toBeNull();
  });
});