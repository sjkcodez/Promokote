from django.urls import path
from . import views

urlpatterns = [
    path("send-sms/", views.SendSmsView.as_view()),
    path("send-email/", views.SendEmailView.as_view()),
    path("messages/", views.MessageListView.as_view()),
    path("messages/<uuid:pk>/", views.MessageDetailView.as_view()),
    path("usage/", views.UsageView.as_view()),
]
