"""
Custom validators for the API.
"""

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordComplexityValidator:
    """
    Validate that the password meets complexity requirements.

    The password must contain:
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
    """

    def __init__(self):
        self.requirements = [
            (r"[A-Z]", "uppercase letter"),
            (r"[a-z]", "lowercase letter"),
            (r"[0-9]", "digit"),
            (r'[!@#$%^&*()\-_=+\[\]{}\\|;:\'",.<>/?`~]', "special character"),
        ]

    def validate(self, password, user=None):
        """
        Validate a password against complexity requirements.
        """
        missing = []

        for pattern, description in self.requirements:
            if not re.search(pattern, password):
                missing.append(description)

        if missing:
            if len(missing) == 1:
                message = f"This password must contain at least one {missing[0]}."
            else:
                # Format: "uppercase letter, lowercase letter, and digit"
                message = "This password must contain at least one "
                if len(missing) == 2:
                    message += f"{missing[0]} and {missing[1]}."
                else:
                    message += f"{', '.join(missing[:-1])}, and {missing[-1]}."

            raise ValidationError(
                _(message),
                code="password_no_complexity",
                params={"missing": missing},
            )

    def get_help_text(self):
        """
        Return help text for this validator.
        """
        return _(
            "Your password must contain at least one uppercase letter, "
            "one lowercase letter, one digit, and one special character."
        )
