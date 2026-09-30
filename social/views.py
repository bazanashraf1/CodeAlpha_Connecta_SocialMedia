import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import render, get_object_or_404
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.contrib.auth.decorators import login_required
from .models import Profile, Follow, Post, Like, Comment

def ensure_profile(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile

def user_data(user, viewer=None):
    ensure_profile(user)
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "bio": user.profile.bio,
        "avatar": user.profile.avatar,
        "followers": Follow.objects.filter(following=user).count(),
        "following": Follow.objects.filter(follower=user).count(),
        "is_following": bool(
            viewer and viewer.is_authenticated and
            Follow.objects.filter(follower=viewer, following=user).exists()
        ),
    }

def post_data(post, viewer=None):
    return {
        "id": post.id,
        "username": post.author.username,
        "author_id": post.author.id,
        "content": post.content,
        "image_url": post.image_url,
        "created_at": post.created_at.strftime("%Y-%m-%d %H:%M"),
        "likes": post.likes.count(),
        "liked": bool(
            viewer and viewer.is_authenticated and
            Like.objects.filter(user=viewer, post=post).exists()
        ),
        "comments": [{
            "id": c.id,
            "username": c.user.username,
            "text": c.text,
            "created_at": c.created_at.strftime("%Y-%m-%d %H:%M"),
        } for c in post.comments.select_related("user").all()],
    }

def body(request):
    try:
        return json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return {}

def home(request):
    get_token(request)
    return render(request, "index.html")

@require_POST
def api_register(request):
    data = body(request)
    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    first_name = str(data.get("first_name", "")).strip()

    if not username or not email or not password:
        return JsonResponse({"message": "Username, email and password are required."}, status=400)
    if len(password) < 6:
        return JsonResponse({"message": "Password must contain at least 6 characters."}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"message": "Username already exists."}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"message": "Email already exists."}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password, first_name=first_name)
    ensure_profile(user)
    return JsonResponse({"message": "Account created.", "user": user_data(user, user)}, status=201)

@require_POST
def api_login(request):
    data = body(request)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = User.objects.filter(email__iexact=email).first()

    if not user or authenticate(username=user.username, password=password) is None:
        return JsonResponse({"message": "Invalid email or password."}, status=401)

    login(request, user)
    return JsonResponse({"message": "Login successful.", "user": user_data(user, user)})

@require_POST
def api_logout(request):
    logout(request)
    return JsonResponse({"message": "Logged out."})

@require_GET
def api_me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"message": "Authentication required."}, status=401)
    return JsonResponse({"user": user_data(request.user, request.user)})

@require_GET
def api_feed(request):
    posts = Post.objects.select_related("author").prefetch_related("likes", "comments__user")
    return JsonResponse({"posts": [post_data(p, request.user) for p in posts[:100]]})

@login_required
@require_POST
def api_create_post(request):
    data = body(request)
    content = str(data.get("content", "")).strip()
    image_url = str(data.get("image_url", "")).strip()
    if not content:
        return JsonResponse({"message": "Post content cannot be empty."}, status=400)
    if len(content) > 1000:
        return JsonResponse({"message": "Post is too long."}, status=400)
    post = Post.objects.create(author=request.user, content=content, image_url=image_url)
    return JsonResponse({"post": post_data(post, request.user)}, status=201)

@login_required
@require_POST
def api_like_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    like = Like.objects.filter(user=request.user, post=post).first()
    if like:
        like.delete()
        liked = False
    else:
        Like.objects.create(user=request.user, post=post)
        liked = True
    return JsonResponse({"liked": liked, "likes": post.likes.count()})

@login_required
@require_POST
def api_comment(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    text = str(body(request).get("text", "")).strip()
    if not text:
        return JsonResponse({"message": "Comment cannot be empty."}, status=400)
    comment = Comment.objects.create(user=request.user, post=post, text=text)
    return JsonResponse({"comment": {
        "id": comment.id, "username": request.user.username,
        "text": comment.text,
        "created_at": comment.created_at.strftime("%Y-%m-%d %H:%M")
    }}, status=201)

@login_required
@require_POST
def api_follow(request, user_id):
    target = get_object_or_404(User, id=user_id)
    if target == request.user:
        return JsonResponse({"message": "You cannot follow yourself."}, status=400)
    relation = Follow.objects.filter(follower=request.user, following=target).first()
    if relation:
        relation.delete()
        following = False
    else:
        try:
            Follow.objects.create(follower=request.user, following=target)
            following = True
        except IntegrityError:
            following = True
    return JsonResponse({
        "following": following,
        "followers": Follow.objects.filter(following=target).count()
    })

@require_GET
def api_profile(request, user_id):
    target = get_object_or_404(User, id=user_id)
    return JsonResponse({"user": user_data(target, request.user)})

@login_required
@require_http_methods(["DELETE"])
def api_delete_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    if post.author_id != request.user.id:
        return JsonResponse({"message": "You can delete only your own posts."}, status=403)
    post.delete()
    return JsonResponse({"message": "Post deleted."})
