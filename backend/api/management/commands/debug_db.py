"""Debug database connection and data."""

from api.models import Post, User
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Debug database connection and show data counts"

    def handle(self, *args, **options):
        self.stdout.write(f"Database: {settings.DATABASES['default']}")
        self.stdout.write(f"Total Users: {User.objects.count()}")
        self.stdout.write(f"Total Posts: {Post.objects.count()}")

        # Show recent users
        users = User.objects.all().order_by("-created_at")[:5]
        self.stdout.write("\nRecent Users:")
        for user in users:
            self.stdout.write(
                f"  - {user.username} ({user.email}) - Created: {user.created_at}"
            )

        # Show recent posts
        posts = Post.objects.all().order_by("-created_at")[:5]
        self.stdout.write("\nRecent Posts:")
        for post in posts:
            self.stdout.write(
                f"  - {post.title} by {post.user.username} - Status: {post.status}"
            )
