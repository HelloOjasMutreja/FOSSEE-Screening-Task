#!/usr/bin/env python3
"""
PyQt5 Desktop Client for Chemical Equipment Parameter Visualizer

Features:
- Upload CSV to Django backend (BasicAuth)
- Fetch latest summary and history
- Show CSV preview (first 50 rows)
- Matplotlib charts: Averages and Type distribution
- Download PDF report for a dataset

Usage:
- Ensure Django backend is running at API_BASE (default http://127.0.0.1:8000/api/)
- Run: python main.py
- Enter your Django username/password in the top inputs.

Note: This file includes a convenience sample path (from your current session):
/mnt/data/060817e5-12fb-40c2-8faa-ba1242fa9e0f.png
If that path exists and is a CSV it will be used. Otherwise use the Browse button.
"""

import sys
import io
import csv
import os
import traceback
import webbrowser
from datetime import datetime

import requests
from requests.auth import HTTPBasicAuth

from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QFileDialog,
    QLabel, QLineEdit, QTableWidget, QTableWidgetItem, QListWidget, QMessageBox,
    QSizePolicy
)
from PyQt5.QtCore import Qt

from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

# ========== CONFIG ==========
API_BASE = 'http://127.0.0.1:8000/api/'  # change if your backend is elsewhere
SAMPLE_UPLOADED_FILE = '/mnt/data/060817e5-12fb-40c2-8faa-ba1242fa9e0f.png'
# ============================

class DesktopClient(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Chemical Equipment Visualizer - Desktop")
        self.resize(1000, 700)
        self.auth = None  # tuple (username, password)

        # Layout
        layout = QVBoxLayout()

        # Auth row
        auth_row = QHBoxLayout()
        auth_row.addWidget(QLabel("Username:"))
        self.user_input = QLineEdit()
        auth_row.addWidget(self.user_input)
        auth_row.addWidget(QLabel("Password:"))
        self.pass_input = QLineEdit()
        self.pass_input.setEchoMode(QLineEdit.Password)
        auth_row.addWidget(self.pass_input)
        self.login_btn = QPushButton("Set Credentials")
        self.login_btn.clicked.connect(self.set_credentials)
        auth_row.addWidget(self.login_btn)
        self.status_label = QLabel("")
        self.status_label.setStyleSheet("color: #444")
        auth_row.addWidget(self.status_label)
        layout.addLayout(auth_row)

        # Buttons row
        btn_row = QHBoxLayout()
        self.browse_btn = QPushButton("Browse CSV")
        self.browse_btn.clicked.connect(self.browse_csv)
        btn_row.addWidget(self.browse_btn)

        self.upload_btn = QPushButton("Upload to Backend")
        self.upload_btn.clicked.connect(self.upload_csv_dialog)
        btn_row.addWidget(self.upload_btn)

        self.use_sample_btn = QPushButton("Use uploaded session file (if CSV)")
        self.use_sample_btn.clicked.connect(self.try_use_sample_path)
        btn_row.addWidget(self.use_sample_btn)

        self.refresh_btn = QPushButton("Refresh Summary & History")
        self.refresh_btn.clicked.connect(self.load_summary_and_history)
        btn_row.addWidget(self.refresh_btn)

        self.download_pdf_btn = QPushButton("Download PDF (selected)")
        self.download_pdf_btn.clicked.connect(self.download_selected_pdf)
        btn_row.addWidget(self.download_pdf_btn)

        layout.addLayout(btn_row)

        # Main area: left = table & list, right = charts
        main_row = QHBoxLayout()

        left_col = QVBoxLayout()
        left_col.addWidget(QLabel("<b>History (last 5 uploads)</b>"))
        self.history_list = QListWidget()
        self.history_list.itemClicked.connect(self.load_selected_summary)
        left_col.addWidget(self.history_list)

        left_col.addWidget(QLabel("<b>CSV Preview (first 50 rows)</b>"))
        self.table = QTableWidget()
        left_col.addWidget(self.table)

        main_row.addLayout(left_col, 3)

        right_col = QVBoxLayout()
        right_col.addWidget(QLabel("<b>Charts</b>"))

        # Matplotlib canvas 1
        self.fig1 = Figure(figsize=(5,3))
        self.canvas1 = FigureCanvas(self.fig1)
        self.canvas1.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        right_col.addWidget(self.canvas1)

        # Matplotlib canvas 2
        self.fig2 = Figure(figsize=(5,3))
        self.canvas2 = FigureCanvas(self.fig2)
        self.canvas2.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        right_col.addWidget(self.canvas2)

        main_row.addLayout(right_col, 2)

        layout.addLayout(main_row)

        # Footer: raw JSON view / status
        self.raw_label = QLabel("")
        self.raw_label.setWordWrap(True)
        layout.addWidget(self.raw_label)

        self.setLayout(layout)

        # State
        self.current_summary = None
        self.history = []

        # Try autoload history if credentials set via env
        env_user = os.environ.get('VIS_USER')
        env_pass = os.environ.get('VIS_PASS')
        if env_user and env_pass:
            self.user_input.setText(env_user)
            self.pass_input.setText(env_pass)
            self.set_credentials()

    # ---------- Authentication ----------
    def set_credentials(self):
        u = self.user_input.text().strip()
        p = self.pass_input.text().strip()
        if not u or not p:
            QMessageBox.warning(self, "Credentials", "Enter username and password.")
            return
        self.auth = (u, p)
        self.status_label.setText(f"Auth set: {u}")
        self.load_summary_and_history()

    # ---------- File selection / upload ----------
    def browse_csv(self):
        path, _ = QFileDialog.getOpenFileName(self, "Select CSV file", "", "CSV files (*.csv);;All files (*)")
        if path:
            self.load_csv_preview_from_path(path)

    def upload_csv_dialog(self):
        path, _ = QFileDialog.getOpenFileName(self, "Select CSV file to upload", "", "CSV files (*.csv);;All files (*)")
        if path:
            self.upload_csv(path)

    def try_use_sample_path(self):
        path = SAMPLE_UPLOADED_FILE
        if os.path.exists(path):
            # attempt to treat it as CSV
            self.load_csv_preview_from_path(path)
            # also attempt upload
            res = QMessageBox.question(self, "Upload sample", f"File found at:\n{path}\n\nDo you want to attempt uploading this file to backend? (May fail if not CSV)")
            if res == QMessageBox.Yes:
                self.upload_csv(path)
        else:
            QMessageBox.information(self, "Not found", f"Sample path not found: {path}")

    def load_csv_preview_from_path(self, path):
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                reader = csv.reader(fh)
                rows = list(reader)
        except Exception as e:
            QMessageBox.critical(self, "CSV Error", f"Failed to open/read file:\n{path}\n\n{e}")
            return
        if not rows:
            QMessageBox.information(self, "Empty", "CSV appears empty.")
            return
        headers = rows[0]
        body = rows[1:51]
        self.table.setColumnCount(len(headers))
        self.table.setRowCount(len(body))
        self.table.setHorizontalHeaderLabels(headers)
        for i, r in enumerate(body):
            for j, cell in enumerate(r):
                self.table.setItem(i, j, QTableWidgetItem(cell))
        self.raw_label.setText(f"Loaded preview from {path} ({len(body)} rows shown)")
        # no chart changes here; charts are from summary API

    def upload_csv(self, path):
        if not self.auth:
            QMessageBox.warning(self, "Auth required", "Set username and password before uploading.")
            return
        try:
            with open(path, 'rb') as fh:
                files = {'file': (os.path.basename(path), fh, 'text/csv')}
                resp = requests.post(API_BASE + 'upload/', files=files, auth=HTTPBasicAuth(self.auth[0], self.auth[1]), timeout=30)
        except Exception as e:
            QMessageBox.critical(self, "Upload failed", f"Exception during upload:\n{e}\n\n{traceback.format_exc()}")
            return

        if resp.status_code not in (200, 201):
            QMessageBox.critical(self, "Upload failed", f"Status: {resp.status_code}\n\n{resp.text}")
            return

        try:
            data = resp.json()
        except Exception:
            data = resp.text
        QMessageBox.information(self, "Uploaded", f"Upload success: status {resp.status_code}")
        print("UPLOAD response:", resp.status_code, data)
        # refresh summary and history
        self.load_summary_and_history()

    # ---------- API interactions ----------
    def get_auth(self):
        if not self.auth:
            return None
        return HTTPBasicAuth(self.auth[0], self.auth[1])

    def load_summary_and_history(self):
        if not self.auth:
            self.raw_label.setText("Set credentials (username & password) then click Refresh.")
            return

        # history
        try:
            hresp = requests.get(API_BASE + 'history/', auth=self.get_auth(), timeout=10)
            if hresp.status_code == 200:
                self.history = hresp.json()
                self.populate_history_list()
            else:
                self.raw_label.setText(f"History fetch failed: {hresp.status_code}")
                print("history failed:", hresp.status_code, hresp.text)
        except Exception as e:
            self.raw_label.setText(f"History request error: {e}")
            print("history exception:", e)
            return

        # latest summary
        try:
            sresp = requests.get(API_BASE + 'summary/', auth=self.get_auth(), timeout=10)
            if sresp.status_code == 200:
                data = sresp.json()
                self.apply_summary(data)
            else:
                self.current_summary = None
                self.raw_label.setText(f"Summary fetch failed: {sresp.status_code} {sresp.text}")
                print("summary failed:", sresp.status_code, sresp.text)
        except Exception as e:
            self.current_summary = None
            self.raw_label.setText(f"Summary request error: {e}")
            print("summary exception:", e)

    def populate_history_list(self):
        self.history_list.clear()
        for item in self.history:
            uploaded_at = item.get('uploaded_at')
            name = item.get('name', 'unnamed')
            display = f"{item.get('id','?')} — {name} — {uploaded_at}"
            self.history_list.addItem(display)

    def load_selected_summary(self, item):
        # parse id from item text
        try:
            item_text = item.text()
            dataset_id = int(item_text.split('—')[0].strip())
        except Exception:
            QMessageBox.warning(self, "Selection error", "Could not parse selected dataset id.")
            return
        try:
            r = requests.get(API_BASE + f'summary/{dataset_id}/', auth=self.get_auth(), timeout=10)
            if r.status_code == 200:
                data = r.json()
                self.apply_summary(data)
            else:
                QMessageBox.critical(self, "Failed", f"Status {r.status_code}\n\n{r.text}")
        except Exception as e:
            QMessageBox.critical(self, "Request error", str(e))

    def apply_summary(self, data):
        # Expect data contains: id, name, uploaded_at, summary, csv_url
        self.current_summary = data
        self.raw_label.setText(f"Loaded summary: {data.get('name')} (id {data.get('id')})")
        print("SUMMARY:", data)
        # fetch and show CSV preview if csv_url present
        csv_url = data.get('csv_url')
        if csv_url:
            # If csv_url begins with '/', prefix root domain
            if csv_url.startswith('/'):
                csv_full = 'http://127.0.0.1:8000' + csv_url
            else:
                csv_full = csv_url
            try:
                r = requests.get(csv_full, auth=self.get_auth(), timeout=10)
                if r.status_code == 200:
                    text = r.text
                    self.load_csv_preview_from_text(text)
                else:
                    print("CSV fetch failed:", r.status_code, r.text)
            except Exception as e:
                print("CSV fetch exception:", e)

        # update charts from summary
        s = data.get('summary', {})
        self.plot_averages(s.get('averages', {}))
        self.plot_type_distribution(s.get('type_distribution', {}))

    def load_csv_preview_from_text(self, text):
        try:
            reader = csv.reader(io.StringIO(text))
            rows = list(reader)
        except Exception as e:
            QMessageBox.warning(self, "CSV parse error", f"Failed to parse CSV text: {e}")
            return
        if not rows:
            QMessageBox.information(self, "No rows", "CSV was empty.")
            return
        headers = rows[0]
        body = rows[1:51]
        self.table.setColumnCount(len(headers))
        self.table.setRowCount(len(body))
        self.table.setHorizontalHeaderLabels(headers)
        for i, r in enumerate(body):
            for j, cell in enumerate(r):
                self.table.setItem(i, j, QTableWidgetItem(cell))

    # ---------- Charts ----------
    def plot_averages(self, averages: dict):
        ax = self.fig1.subplots()
        ax.clear()
        if not averages:
            ax.text(0.5, 0.5, "No averages available", ha='center', va='center')
        else:
            labels = list(averages.keys())
            vals = [averages[k] for k in labels]
            ax.bar(labels, vals)
            ax.set_title("Averages (numeric columns)")
            ax.set_ylabel("Value")
        self.fig1.tight_layout()
        self.canvas1.draw()

    def plot_type_distribution(self, type_dist: dict):
        ax = self.fig2.subplots()
        ax.clear()
        if not type_dist:
            ax.text(0.5, 0.5, "No type distribution available", ha='center', va='center')
        else:
            labels = list(type_dist.keys())
            vals = [type_dist[k] for k in labels]
            ax.pie(vals, labels=labels, autopct='%1.1f%%', startangle=90)
            ax.set_title("Type distribution")
        self.fig2.tight_layout()
        self.canvas2.draw()

    # ---------- Download PDF ----------
    def download_selected_pdf(self):
        if not self.current_summary:
            QMessageBox.information(self, "No dataset", "Load a dataset first.")
            return
        ds_id = self.current_summary.get('id')
        if not ds_id:
            QMessageBox.warning(self, "No id", "Current summary has no id.")
            return
        try:
            r = requests.get(API_BASE + f'pdf/{ds_id}/', auth=self.get_auth(), timeout=20)
            if r.status_code == 200:
                # Save to file
                filename = QFileDialog.getSaveFileName(self, "Save PDF Report", f"{self.current_summary.get('name')}_report.pdf", "PDF files (*.pdf)")[0]
                if filename:
                    with open(filename, 'wb') as fh:
                        fh.write(r.content)
                    QMessageBox.information(self, "Saved", f"Report saved to {filename}")
                    # open it
                    try:
                        webbrowser.open('file://' + os.path.abspath(filename))
                    except Exception:
                        pass
            else:
                QMessageBox.critical(self, "Failed", f"Status {r.status_code}\n\n{r.text}")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Exception while downloading PDF:\n{e}")

def main():
    app = QApplication(sys.argv)
    w = DesktopClient()
    w.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
