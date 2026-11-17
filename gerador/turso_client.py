import os
import requests
import json
from typing import Any, List, Dict, Optional

class TursoRow:
    def __init__(self, cols: List[str], values: List[Any]):
        self._cols = cols
        self._values = values
        self._mapping = {k: v for k, v in zip(cols, values)}

    def __getitem__(self, item):
        if isinstance(item, int):
            return self._values[item]
        if isinstance(item, str):
            if item in self._mapping:
                return self._mapping[item]
            # Tenta lowercase caso venha em maiúsculo
            item_lower = item.lower()
            for k, v in self._mapping.items():
                if k.lower() == item_lower:
                    return v
            raise KeyError(f"Coluna '{item}' não encontrada. Colunas disponíveis: {self._cols}")
        raise TypeError("Índice de coluna inválido")

    def __iter__(self):
        return iter(self._values)

    def __len__(self):
        return len(self._values)

    def keys(self):
        return self._cols

    def get(self, item, default=None):
        try:
            return self[item]
        except (KeyError, IndexError):
            return default

    def __repr__(self):
        return f"<TursoRow {self._mapping}>"


class TursoCursor:
    def __init__(self, connection: 'TursoConnection'):
        self.connection = connection
        self._rows: List[TursoRow] = []
        self._cols: List[str] = []
        self._index: int = 0
        self.lastrowid: Optional[int] = None
        self.rowcount: int = 0

    def execute(self, sql: str, params: Any = None) -> 'TursoCursor':
        res = self.connection._execute_sql(sql, params)
        self._cols = res.get('cols', [])
        raw_rows = res.get('rows', [])
        self._rows = [TursoRow(self._cols, row) for row in raw_rows]
        self._index = 0
        self.lastrowid = res.get('last_insert_rowid')
        self.rowcount = res.get('affected_row_count', 0)
        return self

    def fetchone(self) -> Optional[TursoRow]:
        if self._index < len(self._rows):
            row = self._rows[self._index]
            self._index += 1
            return row
        return None

    def fetchall(self) -> List[TursoRow]:
        if self._index == 0:
            self._index = len(self._rows)
            return self._rows
        remaining = self._rows[self._index:]
        self._index = len(self._rows)
        return remaining

    def __iter__(self):
        return self

    def __next__(self):
        row = self.fetchone()
        if row is None:
            raise StopIteration
        return row


_TURSO_HTTP_SESSION = requests.Session()


class TursoConnection:
    def __init__(self, database_url: str, auth_token: str):
        # Converte libsql:// para https://
        clean_url = database_url.strip()
        if clean_url.startswith("libsql://"):
            clean_url = clean_url.replace("libsql://", "https://")
        elif not clean_url.startswith("http"):
            clean_url = f"https://{clean_url}"
        self.pipeline_url = f"{clean_url.rstrip('/')}/v2/pipeline"
        self.auth_token = auth_token.strip()
        self.headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        self.row_factory = None

    def _format_args(self, params: Any) -> List[Dict[str, Any]]:
        if params is None:
            return []
        if isinstance(params, (tuple, list)):
            formatted = []
            for p in params:
                if p is None:
                    formatted.append({"type": "null"})
                elif isinstance(p, int):
                    formatted.append({"type": "integer", "value": str(p)})
                elif isinstance(p, float):
                    formatted.append({"type": "float", "value": p})
                elif isinstance(p, bytes):
                    import base64
                    formatted.append({"type": "blob", "base64": base64.b64encode(p).decode('ascii')})
                else:
                    formatted.append({"type": "text", "value": str(p)})
            return formatted
        if isinstance(params, dict):
            # Turso v2/pipeline suporta named params se formatado
            formatted = []
            for k, v in params.items():
                if v is None:
                    formatted.append({"type": "null"})
                elif isinstance(v, int):
                    formatted.append({"type": "integer", "value": str(v)})
                elif isinstance(v, float):
                    formatted.append({"type": "float", "value": v})
                else:
                    formatted.append({"type": "text", "value": str(v)})
            return formatted
        return [{"type": "text", "value": str(params)}]

    def _execute_sql(self, sql: str, params: Any = None) -> Dict[str, Any]:
        stmt: Dict[str, Any] = {"sql": sql}
        args = self._format_args(params)
        if args:
            stmt["args"] = args

        payload = {
            "requests": [
                {"type": "execute", "stmt": stmt}
            ]
        }

        try:
            resp = _TURSO_HTTP_SESSION.post(self.pipeline_url, headers=self.headers, json=payload, timeout=15)
            if resp.status_code != 200:
                raise RuntimeError(f"Erro Turso HTTP {resp.status_code}")
            data = resp.json()
            result = data["results"][0]
            if result.get("type") == "error":
                raise RuntimeError(f"Erro SQL Turso: {result.get('error', {}).get('message', 'Desconhecido')}")
            
            res_data = result.get("response", {}).get("result", {})
            cols = [c.get("name") for c in res_data.get("cols", [])]
            raw_rows = res_data.get("rows", [])
            
            parsed_rows = []
            for r in raw_rows:
                parsed_row = []
                for cell in r:
                    c_type = cell.get("type")
                    if c_type == "null":
                        parsed_row.append(None)
                    elif c_type == "integer":
                        parsed_row.append(int(cell.get("value", 0)))
                    elif c_type == "float":
                        parsed_row.append(float(cell.get("value", 0.0)))
                    else:
                        parsed_row.append(cell.get("value", ""))
                parsed_rows.append(parsed_row)

            return {
                "cols": cols,
                "rows": parsed_rows,
                "last_insert_rowid": res_data.get("last_insert_rowid"),
                "affected_row_count": res_data.get("affected_row_count", 0)
            }
        except Exception as e:
            raise RuntimeError(f"Falha na consulta ao Turso: {e}")

    def cursor(self) -> TursoCursor:
        return TursoCursor(self)

    def execute(self, sql: str, params: Any = None) -> TursoCursor:
        cur = self.cursor()
        return cur.execute(sql, params)

    def commit(self):
        # Auto-commit via pipeline HTTP
        pass

    def rollback(self):
        pass

    def close(self):
        pass


def connect_turso(database_url: str, auth_token: str) -> TursoConnection:
    return TursoConnection(database_url, auth_token)
