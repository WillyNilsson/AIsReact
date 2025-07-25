import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { PostFeedItem } from '../types';
import { Colors, Typography, Spacing, PostStatusColors } from '../config/constants';
import { formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

interface FeedCardProps {
  post: PostFeedItem;
  onPress: () => void;
}

export const FeedCard: React.FC<FeedCardProps> = ({ post, onPress }) => {
  const statusConfig = PostStatusColors[post.status] || PostStatusColors.removed;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {post.image_url && (
        <Image source={{ uri: post.image_url }} style={styles.image} />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.text }]}>
              {post.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <Text style={styles.contentText} numberOfLines={3}>
          {post.content}
        </Text>

        <View style={styles.footer}>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.username}>{post.user.username}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.timeAgo}>
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </Text>
          </View>

          <View style={styles.stats}>
            {post.ai_response_count !== undefined && post.ai_response_count > 0 && (
              <View style={styles.stat}>
                <Ionicons name="chatbubbles-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.statText}>{post.ai_response_count}</Text>
              </View>
            )}
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.statText}>{post.verification_score}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  content: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.medium,
    textTransform: 'uppercase',
  },
  contentText: {
    fontSize: Typography.fontSizes.base,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSizes.base * Typography.lineHeights.relaxed,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  username: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
  },
  dot: {
    color: Colors.textTertiary,
    marginHorizontal: Spacing.xs,
  },
  timeAgo: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textTertiary,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textTertiary,
  },
});