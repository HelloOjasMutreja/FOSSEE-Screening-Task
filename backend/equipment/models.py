from django.db import models

# Create your models here.

class Dataset(models.Model):
    name = models.CharField(max_length=200)
    csv_file = models.FileField(upload_to='uploads/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    summary = models.JSONField()

    def __str__(self):
        return f"{self.name} @ {self.uploaded_at.isoformat()}"
