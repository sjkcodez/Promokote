import time
from django.core.management.base import BaseCommand
from messaging.services import run_due_campaigns


class Command(BaseCommand):
    help = "Launches scheduled campaigns and sends queued campaign messages (also resumes after restarts)."

    def handle(self, *args, **opts):
        self.stdout.write("Promokote worker running. Ctrl+C to stop.")
        while True:
            run_due_campaigns()
            time.sleep(10)
