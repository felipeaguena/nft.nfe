import os
import sys

# Adiciona o diretório 'gerador' e a raiz ao path de resolução de módulos
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
GERADOR_DIR = os.path.join(PROJECT_ROOT, 'gerador')

if GERADOR_DIR not in sys.path:
    sys.path.insert(0, GERADOR_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Importa o app Flask principal
from app import app

# Exporta para a Vercel
app = app
