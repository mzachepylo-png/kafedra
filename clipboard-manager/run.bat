@echo off
rem Запуск з вихідного коду без вікна консолі. Один раз: pip install -r requirements.txt
start "" pythonw "%~dp0clipboard_manager.py" %*
