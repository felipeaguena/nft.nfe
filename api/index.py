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

try:
    from app import app
except Exception as _e_init:
    import traceback
    _tb_str = traceback.format_exc()
    print(f"CRITICAL INIT ERROR: {_tb_str}")
    from flask import Flask, Response
    app = Flask(__name__)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        html = f"""<!DOCTYPE html>
<html>
<head><title>Erro de Inicialização - Vercel</title></head>
<body style="font-family: monospace; padding: 30px; background: #0f172a; color: #f8fafc;">
<h2 style="color: #ef4444;">Falha na Inicialização da Aplicação (Vercel Serverless)</h2>
<p>Ocorreu uma exceção ao carregar os módulos da aplicação:</p>
<pre style="background: #1e293b; color: #fca5a5; padding: 20px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap;">{_tb_str}</pre>
</body>
</html>"""
        return Response(html, mimetype='text/html', status=500)

# Exportações explícitas no escopo global para compatibilidade total com o builder da Vercel
application = app
handler = app

