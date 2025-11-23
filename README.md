# Chemical Equipment Parameter Visualizer (Hybrid: Web + Desktop)

A hybrid application that provides CSV upload, analytics, and visualization for chemical equipment parameters.
This project includes:
- **Django + DRF** backend (API, CSV parsing, summary, history, PDF report generation)
- **React + Chart.js** web client (Vite)
- **PyQt5 + Matplotlib** desktop client (same REST API)

This README explains how to run everything locally, how to test, and how to troubleshoot.

---

## Table of contents

1. Quick facts
2. Requirements
3. Repo layout
4. Quickstart — dev mode (recommended)
   - Backend
   - Web client
   - Desktop client
5. Sample CSV (ready to use)
6. API reference & example requests
7. Common troubleshooting
8. Production & deployment notes
9. Contributing & testing
10. License

---

## 1) Quick facts

- Python version: **3.10 / 3.11** recommended
- Node: **18+** recommended
- Default backend base URL: `http://127.0.0.1:8000/`
- Web client dev URL: `http://localhost:5173/`

---

## 2) Requirements

### Backend (dev)
Install into a virtualenv:

```
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### Web client
```
cd web-client
npm install
```

### Desktop client
Create a dedicated venv (optional) and install:

```
python -m venv .venv-desktop
source .venv-desktop/bin/activate
pip install -r desktop/requirements.txt
```

---

## 3) Repo layout (important files)

```
/backend/                # Django project
  manage.py
  visualizer/            # Django settings
  equipment/             # app: models, serializers, views, urls
  requirements.txt       # Python deps for backend
/web-client/             # React app (Vite)
  src/
    App.jsx
    components/
      UploadForm.jsx
      CSVPreview.jsx
      SummaryView.jsx
      LoginModal.jsx
  package.json
  ...
/desktop-client/         # PyQt5 desktop app
  main.py
  requirements.txt       # PyQt5, matplotlib, requests
/mnt/data/               # local session files (if present)
  sample_equipment_test.csv   # demo CSV (local path)
```

---

## 4) Quickstart — dev mode (step by step)

### Backend — start the API
1. Enter backend dir:
   ```
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Create `.env` (optional) and set `DEBUG=True` for dev. Example:
   ```
   DEBUG=True
   SECRET_KEY='dev-secret-key'
   ALLOWED_HOSTS=127.0.0.1,localhost
   ```

3. Apply migrations:
   ```
   python manage.py migrate
   ```

4. Create a superuser for BasicAuth testing:
   ```
   python manage.py createsuperuser
   ```

5. Run dev server:
   ```
   python manage.py runserver
   ```

The API root should now be at `http://127.0.0.1:8000/`. Health-check endpoints:
```
GET http://127.0.0.1:8000/api/     # depends on your URLs
GET http://127.0.0.1:8000/api/summary/
POST http://127.0.0.1:8000/api/upload/  # for CSV uploads (BasicAuth)
```

> **Note:** If you get 404 for `/api/upload/` or `/api/summary/` check `backend/visualizer/urls.py` to ensure the `equipment` app is included.

---

### Web client — start dev server (React + Vite)

1. Install packages (only once):
```
cd web-client
npm install
```

2. Run dev:
```
npm run dev
```

3. Open `http://localhost:5173` in your browser.

**Usage:**
- On first load you will see a login modal. Use the Django superuser credentials created earlier.
- Upload a CSV using the left `Upload` control (CSV columns: `Equipment Name,Type,Flowrate,Pressure,Temperature`).
- Click **Summarize** (or the app will auto-refresh after upload).
- CSV preview and charts should render.

**If you hit CORS/401 errors:**  
- Ensure backend is running and the credentials are correct.
- For CORS, install and configure `django-cors-headers` or use Vite proxy (see Troubleshooting).

---

### Desktop client — PyQt5

1. Create desktop venv (optional):
```
cd desktop-client
python -m venv .venv-desktop
source .venv-desktop/bin/activate
pip install -r requirements.txt
```

2. Run the desktop app (example):
```
python main.py
```

**Desktop flow:**  
- Enter the same credentials (BasicAuth) in the UI.
- Browse for a CSV or use the demo CSV in `/mnt/data/sample_equipment_test.csv`.
- Upload to backend — the desktop app calls the same REST endpoints and renders Matplotlib charts.

---

## 5) Sample CSV (immediate test)

A test CSV is present on the machine at:

```
/mnt/data/sample_equipment_test.csv
```

If your environment accepts file URLs, use:
```
file:///mnt/data/sample_equipment_test.csv
```

Use this file to test upload and visualization quickly.

---

## 6) API reference & example requests

**Upload CSV (POST)**

```
POST /api/upload/
Headers:
  Authorization: Basic <Base64(username:password)>
Body:
  form-data:
    file: <csv file>
```

Example using `curl` (replace USER / PASS):

```bash
curl -v -u USER:PASS -F "file=@/path/to/sample_equipment_test.csv" http://127.0.0.1:8000/api/upload/
```

**Fetch latest summary (GET)**

```
GET /api/summary/
Headers:
  Authorization: Basic <Base64(username:password)>
```

`curl` example:

```bash
curl -u USER:PASS http://127.0.0.1:8000/api/summary/
```

**Fetch PDF report (GET)**

```
GET /api/pdf/<summary_id>/
# returns PDF if implemented
```

---

## 7) Troubleshooting (common issues)

### 1. `CORS` or blocked by browser when front-end calls API
- Install `django-cors-headers` and add to `INSTALLED_APPS`; configure `CORS_ALLOW_ALL_ORIGINS = True` for local dev only.
- Or set Vite proxy in `vite.config.js`:
  ```js
  export default {
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:8000'
      }
    }
  }
  ```

### 2. `401 Unauthorized` from backend
- Ensure you created a Django superuser and are entering correct BasicAuth credentials in UI.
- Check `AUTHENTICATION_BACKENDS` in settings (default ModelBackend required for superuser credentials).

### 3. `404` on `/api/upload/`
- Confirm `backend/visualizer/urls.py` includes the equipment app routes.
- Confirm backend server is running on port 8000.

### 4. PDF generation fails on WeasyPrint import errors
- Install required system libraries:
  - Ubuntu/Debian: `sudo apt install libpango-1.0-0 libgdk-pixbuf2.0-0 libcairo2 libffi-dev libxml2 libxslt1.1`
  - See WeasyPrint docs for exact packages.

---

## 8) Production notes (short)
- Use PostgreSQL (set `DATABASE_URL`), set `DEBUG=False`.
- Serve static files via whitenoise or an external static host (S3, CDN).
- Use Gunicorn + nginx for production.
- Add authentication hardening (consider token-based auth if exposing API to others).
- For Dockerization: create `Dockerfile` for backend and web-client; use `docker-compose` to run DB, backend, and optionally Vite preview.

---

## 9) Contributing, tests & checklist

### Developer checklist before merging:
- `flake8` / `black` formatting for Python
- Add basic unit tests for CSV parsing & summary calculations (pytest)
- Add e2e tests for upload + summary flow (optional)

### Example test for summary calculation (pseudo)
- Read a small CSV, run parsing function, assert `summary['total_count'] == n` and averages equal expected.

---

## 10) FAQ

**Q:** Where to change allowed upload size?  
**A:** Adjust Django `DATA_UPLOAD_MAX_MEMORY_SIZE` and/or file handling logic.

**Q:** How is the CSV stored?  
**A:** The backend can store the last 5 uploaded datasets in the DB (configured in model). Media files served from `MEDIA_ROOT` during dev.

---

## Contact / Support
If anything fails during setup, paste:
- Output of `python manage.py runserver`
- Browser console network error for `GET /api/summary/` or `POST /api/upload/`
- The full request `curl -v` output (redact credentials)

---

## Final notes
This README is intentionally prescriptive — follow the Quickstart steps in order and you’ll be up and running in < 15 minutes on a developer machine.