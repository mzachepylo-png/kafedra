"""Точка входу BioBib.exe (PyInstaller): бібліотека джерел у браузері + значок у треї. Див. biobib/desktop.py."""

import sys

from biobib.desktop import main

if __name__ == "__main__":
    sys.exit(main())
