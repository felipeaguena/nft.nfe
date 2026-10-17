import os
import sys

# Garante resolução dos diretórios 'gerador' e raiz
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
GERADOR_DIR = os.path.join(PROJECT_ROOT, 'gerador')

if GERADOR_DIR not in sys.path:
    sys.path.insert(0, GERADOR_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Importa diretamente no nível raiz do módulo (Top-Level) para o parser estático AST da Vercel
from app import app

# Exportações explícitas no escopo global para compatibilidade total com o builder da Vercel
application = app
handler = app
