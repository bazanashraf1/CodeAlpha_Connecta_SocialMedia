# Connecta — Internship Task 2

Complete mini Social Media Platform.

## Features
- User registration/login/logout
- User profiles
- Posts
- Comments
- Like/unlike
- Follow/unfollow
- Delete own posts
- Community feed
- Django Admin
- SQLite database
- HTML/CSS/JavaScript frontend
- Django backend

## Run
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Open http://127.0.0.1:8000/

Admin: http://127.0.0.1:8000/admin/

## Console
```javascript
CONNECTA.getUser()
CONNECTA.getPosts()
CONNECTA.reload()
```
