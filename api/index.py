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
        html = """<!DOCTYPE html>
<html>
<head><title>Serviço Indisponível</title></head>
<body style="font-family: sans-serif; padding: 30px; background: #0f172a; color: #f8fafc;">
<h2 style="color: #ef4444;">Serviço Temporariamente Indisponível</h2>
<p>Ocorreu um erro interno ao inicializar a aplicação. Consulte os logs do servidor para detalhes.</p>
</body>
</html>"""
        return Response(html, mimetype='text/html', status=500)

class VercelPathFixerMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        # 1. Verifica parâmetro __path injetado via rewrite do vercel.json
        query_string = environ.get('QUERY_STRING', '')
        if '__path=' in query_string:
            import urllib.parse
            parsed_query = urllib.parse.parse_qs(query_string, keep_blank_values=True)
            if '__path' in parsed_query and parsed_query['__path']:
                target_path = parsed_query['__path'][0]
                if not target_path.startswith('/'):
                    target_path = '/' + target_path
                # Normaliza barras duplas eventuais como // -> /
                while '//' in target_path:
                    target_path = target_path.replace('//', '/')
                environ['PATH_INFO'] = target_path
                
                # Remove __path da query string repassada à aplicação
                parsed_query.pop('__path', None)
                new_query = urllib.parse.urlencode(parsed_query, doseq=True)
                environ['QUERY_STRING'] = new_query

        # 2. Fallbacks de headers se disponíveis
        matched_path = (
            environ.get('HTTP_X_MATCHED_PATH')
            or environ.get('HTTP_X_VERCEL_MATCHED_PATH')
            or environ.get('HTTP_X_NOW_ROUTE_MATCHES')
            or environ.get('HTTP_X_FORWARDED_PATH')
        )
        if matched_path and environ.get('PATH_INFO') == '/api/index.py':
            if '?' in matched_path:
                path_part, query_part = matched_path.split('?', 1)
                environ['PATH_INFO'] = path_part
                if not environ.get('QUERY_STRING'):
                    environ['QUERY_STRING'] = query_part
            else:
                environ['PATH_INFO'] = matched_path

        return self.wsgi_app(environ, start_response)


if app is not None:
    app.wsgi_app = VercelPathFixerMiddleware(app.wsgi_app)

# Exportações explícitas no escopo global para compatibilidade total com o builder da Vercel
application = app
handler = app



