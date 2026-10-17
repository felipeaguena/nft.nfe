import os
import hmac
from functools import wraps
from typing import Optional, List, Dict, Any, Union
from flask import request, jsonify, session
import jwt
import bcrypt
from pydantic import BaseModel, Field, ValidationError, ConfigDict, field_validator


# ==============================================================================
# 1. SCHEMAS PYDANTIC PARA VALIDAÇÃO ESTRITA DE ENTRADAS (POST / PUT / PATCH)
# ==============================================================================

class LoginPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='ignore')
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator('email')

    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if '@' not in v or '.' not in v.split('@')[-1]:
            raise ValueError('Credenciais inválidas')
        return v


class EmpresaPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    tipo: Optional[str] = Field(default='', max_length=60)
    nome: Optional[str] = Field(default='', max_length=150)
    cnpj_cpf: Optional[str] = Field(default='', max_length=30)
    ie: Optional[str] = Field(default='', max_length=30)
    logradouro: Optional[str] = Field(default='', max_length=150)
    numero: Optional[str] = Field(default='', max_length=30)
    complemento: Optional[str] = Field(default='', max_length=100)
    bairro: Optional[str] = Field(default='', max_length=100)
    municipio: Optional[str] = Field(default='', max_length=100)
    uf: Optional[str] = Field(default='', max_length=5)
    cep: Optional[str] = Field(default='', max_length=20)
    cpais: Optional[str] = Field(default='', max_length=10)
    xpais: Optional[str] = Field(default='', max_length=60)
    cmun: Optional[str] = Field(default='', max_length=15)
    fone: Optional[str] = Field(default='', max_length=30)
    apelido: Optional[str] = Field(default='', max_length=100)
    ind_ie: Optional[str] = Field(default='', max_length=5)


class TipoOperacaoPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    nome_operacao: str = Field(..., min_length=1, max_length=150)
    cfop_padrao: Optional[str] = Field(default='', max_length=10)
    tp_nf: Optional[Union[str, int]] = Field(default='0')
    id_dest: Optional[Union[str, int]] = Field(default='3')
    orig_padrao: Optional[Union[str, int]] = Field(default='1')
    csosn_icms: Optional[str] = Field(default='102', max_length=30)
    c_enq_ipi: Optional[str] = Field(default='102', max_length=10)
    cst_ipi: Optional[str] = Field(default='05', max_length=30)
    p_ipi: Optional[Union[float, str, int]] = Field(default=0.0)
    aliquota_ii: Optional[Union[float, str, int]] = Field(default=0.0)
    cst_pis: Optional[str] = Field(default='07', max_length=30)
    p_pis: Optional[Union[float, str, int]] = Field(default=0.0)
    cst_cofins: Optional[str] = Field(default='07', max_length=30)
    p_cofins: Optional[Union[float, str, int]] = Field(default=0.0)
    inf_cpl_padrao: Optional[str] = Field(default='', max_length=5000)
    regime_tributario: Optional[str] = Field(default='SUSPENSAO', max_length=30)
    t_pag: Optional[str] = Field(default='90', max_length=10)


class ReordenarOperacoesSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    ordem_ids: List[Union[int, str]] = Field(default_factory=list)


class RegimesTributariosPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    regimes: Dict[str, Any]


class UltimaOperacaoPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    modulo: Optional[str] = Field(default='rascunho', max_length=50)
    nome_operacao: Optional[str] = Field(default='', max_length=150)


class ConfigGeralPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    chave: str = Field(..., min_length=1, max_length=120)
    valor: Optional[Any] = Field(default='')


class RascunhoPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: Optional[Union[int, str]] = None
    referencia_interna: Optional[str] = Field(default='', max_length=150)
    categoria: Optional[str] = Field(default='Geral', max_length=60)
    origem: Optional[str] = Field(default='XML Rascunho', max_length=60)
    tipo_operacao: Optional[str] = Field(default='', max_length=150)
    operacao_id: Optional[Union[str, int]] = Field(default='')
    nome_arquivo_original: Optional[str] = Field(default='', max_length=255)
    chave_acesso: Optional[str] = Field(default='', max_length=60)
    qtd_itens: Optional[Union[int, str]] = None
    valor_total: Optional[Union[float, str, int]] = None
    itens: Optional[List[Dict[str, Any]]] = None
    totais: Optional[Dict[str, Any]] = None
    dados_completos: Optional[Dict[str, Any]] = None


class DuimpImportarPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    numero_duimp: str = Field(..., min_length=5, max_length=30)


class NFeDocumentPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    cabecalho: Optional[Dict[str, Any]] = Field(default_factory=dict)
    itens: List[Dict[str, Any]] = Field(default_factory=list)
    rodape: Optional[Dict[str, Any]] = Field(default_factory=dict)
    referencia_interna: Optional[str] = Field(default='', max_length=150)
    tipo_operacao: Optional[str] = Field(default='', max_length=150)
    chave_acesso: Optional[str] = Field(default='', max_length=60)


class ExportExcelPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    itens: List[Dict[str, Any]] = Field(..., min_length=1)


class UnidadesTributaveisPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    ncms: List[Union[str, int]] = Field(default_factory=list)


class FeiraPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    nome: str = Field(..., min_length=1, max_length=200)
    data_feira: Optional[str] = Field(default='', max_length=100)
    deadline: Optional[str] = Field(default='', max_length=100)
    local: Optional[str] = Field(default='', max_length=200)
    organizador: Optional[str] = Field(default='', max_length=200)


class SyncSheetsPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    url: Optional[str] = Field(default='', max_length=500)


class LocalEntregaPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    nome: str = Field(..., min_length=1, max_length=200)
    endereco: Optional[str] = Field(default='', max_length=500)


class SefazEnviarPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    xml: str = Field(..., min_length=20)
    chave: Optional[str] = Field(default='N/A', max_length=60)
    tpAmb: Optional[Union[int, str]] = Field(default=2)
    referencia_interna: Optional[str] = Field(default='', max_length=150)


class SefazCancelarPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    chave: str = Field(..., min_length=44, max_length=60)
    protocolo: str = Field(..., min_length=5, max_length=30)
    justificativa: str = Field(..., min_length=15, max_length=255)
    tpAmb: Optional[Union[int, str]] = Field(default=1)


class SefazCartaCorrecaoPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    chave: str = Field(..., min_length=44, max_length=60)
    texto_correcao: str = Field(..., min_length=15, max_length=1000)
    nSeqEvento: Optional[Union[int, str]] = Field(default=1)
    tpAmb: Optional[Union[int, str]] = Field(default=1)


class SefazConsultarPayloadSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    chave: str = Field(..., min_length=44, max_length=60)
    tpAmb: Optional[Union[int, str]] = Field(default=1)


class RelatorioAtualizarRefSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    chave: str = Field(..., min_length=10, max_length=60)
    referencia_interna: Optional[str] = Field(default='', max_length=150)


class RelatorioExcluirNotaSchema(BaseModel):
    model_config = ConfigDict(extra='allow')
    chave: str = Field(..., min_length=10, max_length=60)


class _ValidatedPayloadDict(dict):
    """Dicionário validado pelo Pydantic que também expõe .model_dump() para compatibilidade."""
    def model_dump(self, *args, **kwargs):
        return dict(self)


def validate_json_payload(schema_cls, raw_data=None):
    """
    Valida o JSON da requisição contra o schema Pydantic informado.
    Aceita validate_json_payload(Schema) ou validate_json_payload(Schema, data).
    """
    passed_explicit_data = raw_data is not None
    if raw_data is None:
        raw_data = request.get_json(silent=True, force=True)
    if raw_data is None or not isinstance(raw_data, dict):
        err_dict = {"error": "Payload JSON inválido ou ausente.", "status": "error"}
        if passed_explicit_data:
            return None, (err_dict, 400)
        return None, (jsonify(err_dict), 400)
    try:
        validated = schema_cls.model_validate(raw_data)
        # Combina dados validados com campos extras permitidos para preservar 100% de retrocompatibilidade
        merged = _ValidatedPayloadDict(raw_data)
        merged.update(validated.model_dump(exclude_unset=True))
        return merged, None
    except ValidationError as exc:
        erros = []
        for err in exc.errors():
            loc = ".".join(str(x) for x in err.get("loc", []))
            msg = err.get("msg", "Valor inválido")
            erros.append(f"{loc}: {msg}" if loc else msg)
        err_dict = {
            "error": f"Erro de validação de payload: {'; '.join(erros)}",
            "status": "error",
            "details": erros
        }
        if passed_explicit_data:
            return None, (err_dict, 400)
        return None, (jsonify(err_dict), 400)



# ==============================================================================
# 2. AUTENTICAÇÃO JWT (AUTH.JS) & HEADER SERVER-TO-SERVER (X-Internal-API-Key)
# ==============================================================================

def verify_auth_token_or_internal_key() -> bool:
    """
    Verifica se a requisição possui autenticação válida:
    1. Header Server-to-Server `X-Internal-API-Key` comparado em tempo constante contra `INTERNAL_API_KEY`.
    2. Header `Authorization: Bearer <jwt>` assinado com `AUTH_SECRET`.
    3. Cookie de sessão do Auth.js (`__Secure-authjs.session-token`, `authjs.session-token`) ou sessão Flask autenticada.
    4. Para manter funcionamento local transparente caso ENFORCE_API_AUTH="false" ou requisições same-origin
       autenticadas via sessão local quando nenhum segredo externo foi configurado no ambiente dev.
    """
    auth_secret = os.environ.get('AUTH_SECRET', '').strip()
    internal_api_key = os.environ.get('INTERNAL_API_KEY', '').strip()

    # 1. Verifica Header Server-to-Server X-Internal-API-Key
    req_internal_key = request.headers.get('X-Internal-API-Key', '').strip()
    if internal_api_key and req_internal_key:
        if hmac.compare_digest(req_internal_key.encode('utf-8'), internal_api_key.encode('utf-8')):
            return True

    # 2. Verifica Header Authorization: Bearer <token>
    auth_header = request.headers.get('Authorization', '').strip()
    if auth_header.startswith('Bearer ') and auth_secret:
        token_str = auth_header[7:].strip()
        try:
            jwt.decode(token_str, auth_secret, algorithms=['HS256', 'HS384', 'HS512'])
            return True
        except Exception:
            return False

    # 3. Verifica Cookie de Sessão JWT (Auth.js / Portal Web)
    cookie_token = (
        request.cookies.get('__Secure-authjs.session-token')
        or request.cookies.get('authjs.session-token')
        or request.cookies.get('next-auth.session-token')
        or request.cookies.get('__Secure-next-auth.session-token')
    )
    if cookie_token and auth_secret:
        try:
            jwt.decode(cookie_token, auth_secret, algorithms=['HS256', 'HS384', 'HS512'])
            return True
        except Exception:
            return False

    # 4. Verifica Sessão Flask de usuário autenticado
    if session.get('user_authenticated') is True:
        return True

    # 5. Controle de obrigatoriedade para ambiente de Produção (Vercel) vs Desktop Local
    is_vercel_or_prod = (
        os.environ.get('VERCEL') == '1'
        or os.environ.get('FLASK_ENV', '').lower() == 'production'
        or os.environ.get('NODE_ENV', '').lower() == 'production'
    )
    enforce_flag = os.environ.get('ENFORCE_API_AUTH', '').strip().lower()

    if enforce_flag == 'true' or is_vercel_or_prod:
        return False

    # Em ambiente estritamente local (desktop 127.0.0.1) quando ENFORCE_API_AUTH não está ativo
    remote_ip = request.remote_addr or ''
    if remote_ip in ('127.0.0.1', '::1', 'localhost') and enforce_flag != 'true':
        return True

    return False


def require_auth(f):
    """Decorator para proteger rotas privadas da camada Python."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not verify_auth_token_or_internal_key():
            return jsonify({"error": "Não autorizado. Token JWT ou X-Internal-API-Key inválido ou ausente."}), 401
        return f(*args, **kwargs)
    return decorated


def authenticate_user_credentials(email: str, password: str) -> Optional[Dict[str, str]]:
    """
    Valida credenciais usando hashing seguro (bcrypt) e tempo constante.
    Nunca compara senhas em texto puro.
    Senha padrão configurada: 'NFT1652' (armazenada em hash bcrypt seguro).
    Pode ser sobrescrita via variável de ambiente AUTH_ADMIN_PASSWORD_HASH.
    """
    admin_email = os.environ.get('AUTH_ADMIN_EMAIL', 'admin@nftlogistics.com.br').strip().lower()
    # Hash bcrypt de 'NFT1652'
    default_nft1652_hash = "$2b$12$2OEHVkbB4cpGnIXwA2Pt8.79L1jYeophfsuqrnW43CPhI4Hyw0bCK"
    admin_hash = os.environ.get('AUTH_ADMIN_PASSWORD_HASH', '').strip() or default_nft1652_hash

    # Hash dummy bcrypt para mitigar enumeração de usuário por timing attack
    dummy_hash = b"$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4h/9S1G5C2"
    target_hash = admin_hash.encode('utf-8') if (admin_hash and email == admin_email) else dummy_hash

    try:
        is_valid = bcrypt.checkpw(password.encode('utf-8'), target_hash)
    except Exception:
        is_valid = False

    if email == admin_email and is_valid:
        return {
            "id": "admin-1",
            "email": admin_email,
            "name": "Administrador NFT Logistics",
            "role": "admin"
        }
    return None

