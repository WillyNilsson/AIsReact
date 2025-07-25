from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AuditLog, Post
from .permissions import IsModeratorOrAdmin


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsModeratorOrAdmin])
def admin_approve_post(request, post_id):
    """
    Admin action to directly approve a post for AI analysis,
    bypassing community verification.

    Only available to admin users (not moderators).
    """
    # Extra check for admin only (not moderators)
    if request.user.role != "admin":
        return Response(
            {"detail": "Only administrators can directly approve posts"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        with transaction.atomic():
            post = Post.objects.select_for_update().get(id=post_id)

            # Check current status
            if post.status == "live":
                return Response(
                    {"detail": "Post is already live"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if post.status == "removed":
                return Response(
                    {"detail": "Cannot approve a removed post"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Update post status
            old_status = post.status
            post.status = "live"
            post.save()

            # Create audit log
            AuditLog.objects.create(
                user=request.user,
                action=AuditLog.ACTION_ADMIN_OVERRIDE,
                category=AuditLog.ADMINISTRATIVE,
                resource_type="post",
                resource_id=post.id,
                context={
                    "post_id": post.id,
                    "old_status": old_status,
                    "new_status": "live",
                    "action": "admin_direct_approve",
                    "bypassed_verification": True,
                },
            )

            # Trigger AI analysis
            from .tasks import run_ai_analysis

            run_ai_analysis.delay(post.id)

            return Response(
                {
                    "success": True,
                    "post_id": post.id,
                    "message": "Post approved for AI analysis",
                    "ai_analysis_triggered": True,
                }
            )

    except Post.DoesNotExist:
        return Response({"detail": "Post not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response(
            {"detail": f"Error approving post: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsModeratorOrAdmin])
def bulk_admin_approve(request):
    """
    Bulk admin action to directly approve multiple posts for AI analysis.

    Only available to admin users (not moderators).
    """
    # Extra check for admin only (not moderators)
    if request.user.role != "admin":
        return Response(
            {"detail": "Only administrators can directly approve posts"},
            status=status.HTTP_403_FORBIDDEN,
        )

    post_ids = request.data.get("post_ids", [])

    if not post_ids:
        return Response(
            {"detail": "No post IDs provided"}, status=status.HTTP_400_BAD_REQUEST
        )

    if len(post_ids) > 50:
        return Response(
            {"detail": "Maximum 50 posts can be approved at once"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    results = {"approved": [], "skipped": [], "errors": []}

    with transaction.atomic():
        for post_id in post_ids:
            try:
                post = Post.objects.select_for_update().get(id=post_id)

                if post.status == "live":
                    results["skipped"].append({"id": post_id, "reason": "Already live"})
                    continue

                if post.status == "removed":
                    results["skipped"].append(
                        {"id": post_id, "reason": "Post is removed"}
                    )
                    continue

                # Update status
                old_status = post.status
                post.status = "live"
                post.save()

                # Audit log
                AuditLog.objects.create(
                    user=request.user,
                    action=AuditLog.ACTION_ADMIN_OVERRIDE,
                    category=AuditLog.ADMINISTRATIVE,
                    resource_type="post",
                    resource_id=post.id,
                    context={
                        "post_id": post.id,
                        "old_status": old_status,
                        "new_status": "live",
                        "action": "bulk_admin_direct_approve",
                        "bypassed_verification": True,
                    },
                )

                # Trigger AI analysis
                from .tasks import run_ai_analysis

                run_ai_analysis.delay(post.id)

                results["approved"].append(post_id)

            except Post.DoesNotExist:
                results["errors"].append({"id": post_id, "error": "Post not found"})
            except Exception as e:
                results["errors"].append({"id": post_id, "error": str(e)})

    return Response(
        {
            "success": True,
            "results": results,
            "total_approved": len(results["approved"]),
            "ai_analysis_triggered": True,
        }
    )
