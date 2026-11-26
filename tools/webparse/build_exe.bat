@echo off
rem Локальна збірка webparse.exe у Windows (потрібен Python 3.10+). Результат: dist\webparse.exe
cd /d "%~dp0"
python -m pip install -r requirements.txt pyinstaller playwright pypdf || goto :err
pyinstaller --noconfirm --clean --onefile --name webparse --add-data "templates;templates" --collect-all playwright --collect-submodules webparse launcher.py || goto :err
echo.
echo Готово: %~dp0dist\webparse.exe
pause
exit /b 0
:err
echo Збірка не вдалася.
pause
exit /b 1
