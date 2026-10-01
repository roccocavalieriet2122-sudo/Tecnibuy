@echo off
cd /d "%~dp0backend"

if not exist venv (
    echo Creando entorno virtual...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Instalando dependencias...
pip install -r requirements.txt --quiet

echo.
echo Iniciando TecniBuy en http://localhost:8000
echo (Ctrl+C para cortar)
echo.
uvicorn app.main:app --reload
