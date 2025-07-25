from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Make a user an admin by username"

    def add_arguments(self, parser):
        parser.add_argument(
            "username", type=str, help="Username of the user to make admin"
        )
        parser.add_argument(
            "--django-admin",
            action="store_true",
            help="Also grant Django admin access (is_staff=True)",
        )
        parser.add_argument(
            "--superuser",
            action="store_true",
            help="Make the user a superuser (implies --django-admin)",
        )

    def handle(self, *args, **options):
        username = options["username"]

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" does not exist'))
            return

        # Set role to admin
        user.role = "admin"

        # Handle Django admin access
        if options["superuser"]:
            user.is_staff = True
            user.is_superuser = True
            self.stdout.write(
                self.style.SUCCESS(
                    f'User "{username}" is now a superuser with full admin rights'
                )
            )
        elif options["django_admin"]:
            user.is_staff = True
            self.stdout.write(
                self.style.SUCCESS(f'User "{username}" now has Django admin access')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'User "{username}" is now an app admin (role=admin)'
                )
            )

        user.save()

        self.stdout.write(self.style.SUCCESS(f'Successfully updated user "{username}"'))
        self.stdout.write(f"  - Role: {user.role}")
        self.stdout.write(f"  - Django Staff: {user.is_staff}")
        self.stdout.write(f"  - Superuser: {user.is_superuser}")
