import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { Colors, Typography, Spacing } from '../config/constants';
import apiClient from '../api/client';
import { Post, AIResponse } from '../types';
import { FeedStackParamList } from '../navigation/types';

type RouteProps = RouteProp<FeedStackParamList, 'PostDetail'>;

const AIResponseCard: React.FC<{ response: AIResponse }> = ({ response }) => {
  const providerColors: Record<string, string> = {
    openai: Colors.providerOpenai,
    google: Colors.providerGoogle,
    anthropic: Colors.providerAnthropic,
    xai: Colors.providerXai,
    deepseek: Colors.providerDeepseek,
  };

  const getProviderColor = (modelName: string) => {
    const provider = Object.keys(providerColors).find(key => 
      modelName.toLowerCase().includes(key)
    );
    return provider ? providerColors[provider] : Colors.brandPrimary;
  };

  return (
    <View style={styles.aiCard}>
      <View style={[styles.aiHeader, { borderLeftColor: getProviderColor(response.model_name) }]}>
        <Text style={styles.modelName}>{response.model_name}</Text>
        {response.response_time_ms && (
          <Text style={styles.responseTime}>{response.response_time_ms}ms</Text>
        )}
      </View>

      <View style={styles.aiContent}>
        <View style={styles.aiSection}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.sectionContent}>{response.response_data.summary}</Text>
        </View>

        <View style={styles.aiSection}>
          <Text style={styles.sectionTitle}>Historical Context</Text>
          <Text style={styles.sectionContent}>{response.response_data.historical_context}</Text>
        </View>

        <View style={styles.aiSection}>
          <Text style={styles.sectionTitle}>Future Development</Text>
          <Text style={styles.sectionContent}>{response.response_data.future_development}</Text>
        </View>

        <View style={styles.aiSection}>
          <Text style={styles.sectionTitle}>Opinions</Text>
          <Text style={styles.sectionContent}>{response.response_data.opinions}</Text>
        </View>
      </View>
    </View>
  );
};

export const PostDetailScreen = () => {
  const route = useRoute<RouteProps>();
  const { postId } = route.params;

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await apiClient.get(`/posts/${postId}/`);
      return response.data as Post;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.brandPrimary} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load post</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Post Header */}
        <Text style={styles.title}>{post.title}</Text>
        
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="person-circle-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.metaText}>{post.user.username}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.metaText}>
              {format(new Date(post.created_at), 'MMM dd, yyyy')}
            </Text>
          </View>
        </View>

        {/* Post Content */}
        <Text style={styles.postContent}>{post.content}</Text>

        {/* Source Link */}
        <TouchableOpacity
          style={styles.sourceLink}
          onPress={() => Linking.openURL(post.source_url)}
        >
          <Ionicons name="link-outline" size={20} color={Colors.brandPrimary} />
          <Text style={styles.sourceLinkText}>View Source</Text>
        </TouchableOpacity>

        {/* AI Responses */}
        {post.ai_responses && post.ai_responses.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>AI Analysis</Text>
            {post.ai_responses.map((response) => (
              <AIResponseCard key={response.id} response={response} />
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundPrimary,
  },
  content: {
    padding: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSizes['2xl'],
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  meta: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textTertiary,
  },
  postContent: {
    fontSize: Typography.fontSizes.base,
    lineHeight: Typography.fontSizes.base * Typography.lineHeights.relaxed,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xl,
  },
  sourceLinkText: {
    fontSize: Typography.fontSizes.base,
    color: Colors.brandPrimary,
    fontWeight: Typography.fontWeights.medium,
  },
  sectionHeader: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSizes.lg,
    color: Colors.textPrimary,
  },
  
  // AI Response Card Styles
  aiCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderLeftWidth: 4,
  },
  modelName: {
    fontSize: Typography.fontSizes.base,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  responseTime: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textTertiary,
  },
  aiContent: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  aiSection: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    fontSize: Typography.fontSizes.base,
    lineHeight: Typography.fontSizes.base * Typography.lineHeights.relaxed,
    color: Colors.textPrimary,
  },
});