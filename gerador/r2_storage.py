import os
import boto3
from botocore.config import Config
from typing import Optional

# Configurações do Cloudflare R2
R2_ENDPOINT_URL = os.environ.get(
    'R2_ENDPOINT_URL',
    'https://1856fd1320019b7a523d3e3257730424.r2.cloudflarestorage.com'
).strip()

R2_ACCESS_KEY_ID = os.environ.get(
    'R2_ACCESS_KEY_ID',
    '21660fc459671f9e160ba38ce86883d1'
).strip()

R2_SECRET_ACCESS_KEY = os.environ.get(
    'R2_SECRET_ACCESS_KEY',
    '3528e3f9a0aef9c56a3a0a2654fba193c01cc084e1e380c3a7737d3d008868d3'
).strip()

R2_BUCKET_NAME = os.environ.get(
    'R2_BUCKET_NAME',
    'nft-storage'
).strip()

_s3_client = None

def get_r2_client():
    global _s3_client
    if _s3_client is None:
        try:
            # Remove sufixos indesejados da URL base do endpoint caso venha com o nome do bucket
            clean_endpoint = R2_ENDPOINT_URL
            if clean_endpoint.endswith('/nft-storage') or clean_endpoint.endswith('/nft-token'):
                clean_endpoint = clean_endpoint.rsplit('/', 1)[0]
                
            _s3_client = boto3.client(
                service_name='s3',
                endpoint_url=clean_endpoint,
                aws_access_key_id=R2_ACCESS_KEY_ID,
                aws_secret_access_key=R2_SECRET_ACCESS_KEY,
                region_name='auto',
                config=Config(s3={'addressing_style': 'path'}, signature_version='s3v4')
            )
        except Exception as e:
            print(f"Aviso ao inicializar cliente R2: {e}")
            _s3_client = None
    return _s3_client

def upload_file_r2(local_path: str, remote_key: str, content_type: Optional[str] = None) -> bool:
    client = get_r2_client()
    if not client or not os.path.exists(local_path):
        return False
    try:
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type
        elif local_path.endswith('.pdf'):
            extra_args['ContentType'] = 'application/pdf'
        elif local_path.endswith('.xml'):
            extra_args['ContentType'] = 'application/xml'
        elif local_path.endswith('.zip'):
            extra_args['ContentType'] = 'application/zip'
        elif local_path.endswith('.json'):
            extra_args['ContentType'] = 'application/json'

        client.upload_file(local_path, R2_BUCKET_NAME, remote_key, ExtraArgs=extra_args)
        return True
    except Exception as e:
        print(f"Erro no upload para Cloudflare R2 ({remote_key}): {e}")
        return False

def download_file_r2(remote_key: str, local_path: str) -> bool:
    client = get_r2_client()
    if not client:
        return False
    try:
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        client.download_file(R2_BUCKET_NAME, remote_key, local_path)
        return True
    except Exception as e:
        # Não polui logs caso o arquivo não exista remotamente
        return False

def get_file_bytes_r2(remote_key: str) -> Optional[bytes]:
    client = get_r2_client()
    if not client:
        return None
    try:
        obj = client.get_object(Bucket=R2_BUCKET_NAME, Key=remote_key)
        return obj['Body'].read()
    except Exception:
        return None
