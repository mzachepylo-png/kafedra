"""webparse — парсер вебсторінок у читабельний вигляд і DOCX.

Витягує з HTML-сторінки основний текст (без меню, реклами, коментарів),
заголовки, списки, таблиці, зображення й графіки та зберігає їх у DOCX.
"""
from .model import Document  # noqa: F401
from .pipeline import parse_url, parse_html, Options  # noqa: F401

__version__ = "1.0.0"
