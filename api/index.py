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

try:
    from app import app
except Exception as e:
    import traceback
    err_trace = traceback.format_exc()
    from flask import Flask, Response
    app = Flask(__name__)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all_err(path):
        return Response(
            f"<h1>Erro na Inicialização da Função Vercel</h1><pre>{err_trace}</pre>",
            mimetype="text/html",
            status=500
        )
