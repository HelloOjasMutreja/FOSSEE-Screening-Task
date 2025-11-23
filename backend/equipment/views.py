import io
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status, permissions
from django.http import FileResponse
from .models import Dataset
from .serializers import DatasetSerializer

class UploadCSVView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, format=None):
        f = request.FILES.get('file')
        name = request.data.get('name') or (f.name if f else 'dataset.csv')
        if not f:
            return Response({"detail":"No file uploaded"}, status=400)
        try:
            df = pd.read_csv(f)
        except Exception as e:
            return Response({"detail": f"CSV parse error: {str(e)}"}, status=400)

        numeric_cols = ['Flowrate','Pressure','Temperature']
        for col in numeric_cols:
            if col not in df.columns:
                return Response({"detail": f"Missing column: {col}"}, status=400)
        total_count = int(len(df))
        averages = df[numeric_cols].mean().to_dict()
        type_dist = df['Type'].value_counts().to_dict()
        summary = {
            "total_count": total_count,
            "averages": {k: float(v) for k,v in averages.items()},
            "type_distribution": {str(k): int(v) for k,v in type_dist.items()}
        }
        f.seek(0)
        ds = Dataset.objects.create(name=name, csv_file=f, summary=summary)
        # keep last 5
        qs = Dataset.objects.all().order_by('-uploaded_at')
        if qs.count() > 5:
            for old in qs[5:]:
                old.csv_file.delete(save=False)
                old.delete()
        serializer = DatasetSerializer(ds)
        return Response(serializer.data, status=201)

class SummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pk=None, format=None):
        if pk:
            ds = Dataset.objects.filter(pk=pk).first()
            if not ds: return Response({"detail":"Not found"}, status=404)
        else:
            ds = Dataset.objects.all().order_by('-uploaded_at').first()
            if not ds: return Response({"detail":"No datasets"}, status=404)
        return Response({
            "id": ds.id,
            "name": ds.name,
            "uploaded_at": ds.uploaded_at,
            "summary": ds.summary,
            "csv_url": ds.csv_file.url
        })

class HistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, format=None):
        qs = Dataset.objects.all().order_by('-uploaded_at')[:5]
        serializer = DatasetSerializer(qs, many=True)
        return Response(serializer.data)

class PDFReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pk, format=None):
        ds = Dataset.objects.filter(pk=pk).first()
        if not ds: return Response({"detail":"Not found"}, status=404)
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        p.setFont("Helvetica", 12)
        p.drawString(50, 760, f"Report: {ds.name}")
        p.drawString(50, 745, f"Uploaded: {ds.uploaded_at.isoformat()}")
        summary = ds.summary
        p.drawString(50, 720, f"Total items: {summary['total_count']}")
        y = 700
        p.drawString(50, y, "Averages:")
        y -= 15
        for k,v in summary['averages'].items():
            p.drawString(70, y, f"{k}: {v:.3f}")
            y -= 15
        y -= 10
        p.drawString(50,y, "Type distribution:")
        y -= 15
        for k,v in summary['type_distribution'].items():
            p.drawString(70,y, f"{k}: {v}")
            y -= 15
        p.showPage()
        p.save()
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"{ds.name}_report.pdf")
