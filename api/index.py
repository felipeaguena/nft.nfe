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

class VercelPathFixerMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = (
            environ.get('HTTP_X_MATCHED_PATH')
            or environ.get('HTTP_X_VERCEL_MATCHED_PATH')
            or environ.get('HTTP_X_NOW_ROUTE_MATCHES')
        )
        if matched_path:
            if '?' in matched_path:
                path_part, query_part = matched_path.split('?', 1)
                environ['PATH_INFO'] = path_part
                if not environ.get('QUERY_STRING'):
                    environ['QUERY_STRING'] = query_part
            else:
                environ['PATH_INFO'] = matched_path
        return self.wsgi_app(environ, start_response)

if app is not None:
    # Registra rota direta de diagnóstico para vermos os headers exatos recebidos na Vercel
    @app.route('/api/debug-env')
    def debug_env():
        from flask import request, jsonify
        env_dump = {k: str(v) for k, v in request.environ.items() if not k.startswith('wsgi.')}
        headers_dump = dict(request.headers)
        return jsonify({
            "path": request.path,
            "headers": headers_dump,
            "environ": env_dump
        })

    app.wsgi_app = VercelPathFixerMiddleware(app.wsgi_app)

# Exportações explícitas no escopo global para compatibilidade total com o builder da Vercel
application = app
handler = app



