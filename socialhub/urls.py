from django.contrib import admin
from django.urls import path
from social import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", views.home, name="home"),
    path("api/register/", views.api_register),
    path("api/login/", views.api_login),
    path("api/logout/", views.api_logout),
    path("api/me/", views.api_me),
    path("api/feed/", views.api_feed),
    path("api/posts/", views.api_create_post),
    path("api/posts/<int:post_id>/", views.api_delete_post),
    path("api/posts/<int:post_id>/like/", views.api_like_post),
    path("api/posts/<int:post_id>/comment/", views.api_comment),
    path("api/users/<int:user_id>/follow/", views.api_follow),
    path("api/users/<int:user_id>/", views.api_profile),
]
