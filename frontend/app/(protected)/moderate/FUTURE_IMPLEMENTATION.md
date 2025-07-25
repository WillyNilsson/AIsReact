# Future Moderation System Implementation

## Current State (Why This Page is Disabled)

The moderation page is currently disabled because:

1. OpenAI's moderation API already handles initial content screening automatically
2. The current page just duplicates what happens automatically in the submit flow
3. Without sufficient user volume, manual moderation isn't needed
4. Django admin can handle edge cases for now

## When to Re-Enable This Page

Consider implementing a custom moderation interface when:

- You have 100+ posts per day requiring human review
- Users start requesting an appeals process
- You need pattern detection across multiple posts
- Django admin becomes too cumbersome for moderators

## Ideal Future Implementation

### 1. Appeals & Disputes Center

```typescript
interface Appeal {
  id: number;
  post: Post;
  appeal_reason: string;
  user_explanation: string;
  original_rejection: {
    reason: string;
    ai_confidence: number;
    timestamp: Date;
  };
  status: "pending" | "approved" | "denied";
}
```

**Features:**

- Users can appeal rejected posts with additional context
- Moderators see original post, AI's decision, and user's appeal
- Quick approve/deny with template responses
- Track appeal patterns (e.g., "AI too strict on climate posts")

### 2. Edge Case Queue

```typescript
interface EdgeCasePost {
  id: number;
  post: Post;
  flags: {
    ai_confidence: number; // 40-60% = edge case
    community_split: boolean; // 45-55% verification
    multiple_reports: number;
    high_engagement: boolean;
  };
}
```

**Features:**

- AI-flagged borderline content (confidence 40-60%)
- Posts with split community votes
- High-engagement posts needing extra scrutiny
- Ability to override both AI and community decisions

### 3. Pattern Detection Dashboard

```typescript
interface ModerationPattern {
  pattern_type: "topic" | "source" | "user" | "temporal";
  description: string;
  affected_posts: number;
  first_seen: Date;
  severity: "low" | "medium" | "high";
}
```

**Features:**

- "Unusual spike in climate posts being rejected"
- "New misinformation pattern about [topic]"
- "User X has 10 rejected posts this week"
- Source domain reliability tracking

### 4. Moderation Tools

```typescript
interface ModerationAction {
  action: "approve" | "reject" | "edit" | "flag";
  reason: string;
  template_id?: string;
  notes?: string;
  follow_up_required: boolean;
}
```

**Features:**

- Bulk actions with keyboard shortcuts
- Edit capability for minor fixes (typos, broken links)
- Template responses for common issues
- Flag for escalation to admin

### 5. Quality Control

```typescript
interface QualityCheck {
  sample_size: number;
  ai_decisions: Decision[];
  human_decisions: Decision[];
  agreement_rate: number;
  improvement_suggestions: string[];
}
```

**Features:**

- Random sampling of AI decisions
- Compare AI vs human moderator decisions
- Feedback loop to improve AI prompts
- Track moderator agreement rates

## Implementation Steps

1. **Phase 1: Appeals System**

   - Add `PostAppeal` model to Django
   - Create appeal submission form
   - Basic appeals queue interface

2. **Phase 2: Edge Case Detection**

   - Store AI confidence scores
   - Flag posts with split votes
   - Create edge case queue

3. **Phase 3: Pattern Analysis**

   - Implement pattern detection algorithms
   - Create pattern dashboard
   - Add alerting for unusual patterns

4. **Phase 4: Advanced Tools**
   - Bulk moderation actions
   - Keyboard shortcuts
   - Template system
   - Edit capabilities

## Database Changes Needed

```python
class PostAppeal(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    appeal_reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True)
    reviewed_by = models.ForeignKey(User, null=True, related_name='reviewed_appeals')
    status = models.CharField(max_length=20, choices=[...])
    moderator_notes = models.TextField(blank=True)

class ModerationMetrics(models.Model):
    post = models.OneToOneField(Post, on_delete=models.CASCADE)
    ai_confidence = models.FloatField()
    community_agreement = models.FloatField(null=True)
    report_count = models.IntegerField(default=0)
    requires_review = models.BooleanField(default=False)
```

## API Endpoints Needed

```typescript
// Appeals
POST / api / posts / { id } / appeal;
GET / api / moderation / appeals;
PUT / api / moderation / appeals / { id };

// Edge Cases
GET / api / moderation / edge - cases;
GET / api / moderation / patterns;

// Metrics
GET / api / moderation / metrics;
GET / api / moderation / quality - checks;
```

## Why Not Just Use Django Admin?

While Django admin can handle basic moderation, it lacks:

- Specialized UI for quick decisions
- Keyboard shortcuts for efficiency
- Visual content preview
- Pattern detection
- Appeals workflow
- Real-time metrics
- Bulk actions with context

## Current Alternative: Django Admin Setup

For now, admins can use Django admin with:

1. Custom list_display for posts
2. Admin actions for bulk approve/reject
3. Filters for status, date, user
4. Search by title/content
5. Inline moderation history

But this is a stopgap - a proper moderation interface becomes necessary at scale.
