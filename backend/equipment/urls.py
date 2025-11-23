from django.urls import path
from .views import UploadCSVView, SummaryView, HistoryView, PDFReportView

urlpatterns = [
    path('upload/', UploadCSVView.as_view(), name='upload'),
    path('summary/', SummaryView.as_view(), name='summary_latest'),
    path('summary/<int:pk>/', SummaryView.as_view(), name='summary_detail'),
    path('history/', HistoryView.as_view(), name='history'),
    path('pdf/<int:pk>/', PDFReportView.as_view(), name='pdf_report'),
]
