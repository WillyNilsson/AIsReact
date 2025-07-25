"""
Management command to create test posts without triggering AI analysis.
"""

import random
from datetime import datetime, timedelta

from api.models import Post
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Creates test posts for verification queue without AI analysis"

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=30,
            help="Number of posts to create (default: 30)",
        )
        parser.add_argument(
            "--user",
            type=str,
            help="Username to create posts for (creates test user if not specified)",
        )
        parser.add_argument(
            "--status",
            type=str,
            default="pending_verification",
            choices=["pending_verification", "pending_moderation", "live", "rejected"],
            help="Status of created posts (default: pending_verification)",
        )

    def handle(self, *args, **options):
        count = options["count"]
        username = options["user"]
        status = options["status"]

        # Get or create user
        if username:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"User '{username}' does not exist"))
                return
        else:
            # Create a test user
            user, created = User.objects.get_or_create(
                username="testuser",
                defaults={
                    "email": "testuser@example.com",
                    "is_verified": True,
                },
            )
            if created:
                user.set_password("testpass123")
                user.save()
                self.stdout.write(
                    self.style.SUCCESS(f"Created test user: {user.username}")
                )

        # Sample data for generating posts
        titles = [
            "Breaking: Major Scientific Discovery Announced",
            "New Study Reveals Surprising Health Benefits",
            "Technology Giant Announces Revolutionary Product",
            "Climate Scientists Report Concerning New Data",
            "Economic Forecast Shows Unexpected Trends",
            "Space Mission Discovers Unusual Phenomenon",
            "Medical Breakthrough Offers Hope for Patients",
            "Political Leaders Meet for Historic Summit",
            "Artificial Intelligence Achieves New Milestone",
            "Environmental Initiative Shows Promising Results",
        ]

        content_templates = [
            "Researchers at {institution} have announced a groundbreaking discovery "
            "that could revolutionize {field}. The findings, published in {journal}, "
            "suggest that {discovery} may have far-reaching implications for "
            "{application}.",
            "A new study conducted by {institution} has revealed surprising benefits "
            "of {subject}. The research, which analyzed data from {number} "
            "participants over {duration}, found that {finding} could lead to "
            "{outcome}.",
            "In a surprising turn of events, {company} has announced "
            "{announcement}. Industry experts believe this could {impact} the "
            "{industry} sector, with potential implications for {stakeholder}.",
            "Scientists studying {subject} have reported {finding} that challenges "
            "previous understanding. The data, collected over {duration}, indicates "
            "that {implication} may require a fundamental rethink of {concept}.",
        ]

        institutions = [
            "MIT",
            "Stanford University",
            "Oxford University",
            "Harvard Medical School",
            "NASA",
            "CERN",
            "Johns Hopkins",
            "UC Berkeley",
            "Cambridge University",
        ]

        fields = [
            "quantum physics",
            "renewable energy",
            "biotechnology",
            "neuroscience",
            "climate science",
            "artificial intelligence",
            "medicine",
            "astronomy",
        ]

        # Create posts
        created_posts = []
        for i in range(count):
            # Randomly select title and content
            title = random.choice(titles) + f" #{i+1}"
            template = random.choice(content_templates)

            # Fill in template
            content = template.format(
                institution=random.choice(institutions),
                field=random.choice(fields),
                journal="Nature" if random.random() > 0.5 else "Science",
                discovery=f"Discovery {i+1}",
                application=random.choice(
                    ["healthcare", "technology", "education", "industry"]
                ),
                subject=f"Subject {i+1}",
                number=random.randint(1000, 10000),
                duration=f"{random.randint(1, 10)} years",
                finding=f"Finding {i+1}",
                outcome=random.choice(
                    ["improved health outcomes", "cost savings", "efficiency gains"]
                ),
                company=random.choice(
                    ["TechCorp", "InnovateCo", "FutureTech", "GlobalDynamics"]
                ),
                announcement=f"Announcement {i+1}",
                impact=random.choice(
                    ["transform", "disrupt", "enhance", "revolutionize"]
                ),
                industry=random.choice(
                    ["technology", "healthcare", "finance", "energy"]
                ),
                stakeholder=random.choice(
                    ["consumers", "businesses", "investors", "researchers"]
                ),
                implication=f"Implication {i+1}",
                concept=random.choice(
                    ["current models", "existing theories", "standard practices"]
                ),
            )

            # Create post with specified status
            post = Post.objects.create(
                user=user,
                title=title,
                content=content,
                source_url=f"https://example.com/article-{i+1}",
                status=status,
                created_at=datetime.now() - timedelta(minutes=random.randint(0, 1440)),
            )

            # If rejected, add a rejection reason
            if status == "rejected":
                post.rejection_reason = random.choice(
                    [
                        "Content contains misinformation",
                        "Unreliable source",
                        "Duplicate content",
                        "Violates community guidelines",
                    ]
                )
                post.save()

            created_posts.append(post)

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully created {len(created_posts)} test posts "
                f"with status '{status}'"
            )
        )
        self.stdout.write(
            self.style.WARNING(
                "Note: No AI analysis was triggered for these posts to save costs."
            )
        )
