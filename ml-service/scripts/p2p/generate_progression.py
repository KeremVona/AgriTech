#!/usr/bin/env python3
"""
Prompt-to-Prompt Disease Progression CLI Entrypoint.
Precision AgriTech Platform - Machine Learning & Vision Service.

Usage:
    python generate_progression.py --help
    python generate_progression.py --crop tomato --output-dir ./output
    python generate_progression.py --crop all --steps 50 --device cuda
"""

import sys
from pathlib import Path

# Ensure local script directory is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from p2p_generator import main

if __name__ == "__main__":
    main()
