import os
import uuid
import time
from fastapi import UploadFile, HTTPException
from typing import Dict, Any, List, Optional

# 기본 설정
BASE_UPLOAD_DIR = "static"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", 
    "image/svg+xml", "image/bmp", "image/tiff"
]

def ensure_upload_dir(context: str = "default"):
    """컨텍스트별 업로드 디렉토리가 존재하는지 확인하고, 없으면 생성합니다."""
    upload_path = os.path.join(BASE_UPLOAD_DIR, context)
    os.makedirs(upload_path, exist_ok=True)
    return upload_path

async def validate_image_file(file: UploadFile) -> None:
    """
    이미지 파일의 유효성을 검사합니다.
    - 파일 크기 제한 (10MB)
    - 허용된 이미지 타입만 가능
    """
    # 파일 타입 확인
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file.content_type}. Only images are allowed."
        )
    
    # 파일 크기 확인을 위해 파일 내용 읽기
    file_content = await file.read()
    file_size = len(file_content)
    
    # 파일 위치 되돌리기 (읽은 후 위치 초기화)
    await file.seek(0)
    
    # 파일 크기 검사
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"File too large: {file_size} bytes. Maximum allowed size is {MAX_FILE_SIZE} bytes (10MB)."
        )

async def save_uploaded_file(file: UploadFile, context: str = "default") -> Dict[str, Any]:
    """
    파일을 서버에 저장하고 새로운 메타데이터를 반환합니다.
    
    Args:
        file: 업로드할 파일
        context: 파일 저장 컨텍스트 (예: 'flow_executor', 'flow_modal')
    
    Returns:
        File 메타데이터: {fileId, originalFileName, filePath, backendPath, url, contentType, size, uploadedAt}
    """
    # 컨텍스트별 디렉토리 확인/생성
    context_dir = ensure_upload_dir(context)
    
    # 파일 유효성 검사
    await validate_image_file(file)
    
    # 파일 ID 및 안전한 파일명 생성
    file_id = str(uuid.uuid4())
    original_filename = file.filename or "unnamed_file"
    file_ext = os.path.splitext(original_filename)[1]
    safe_filename = f"{file_id}{file_ext}"
    
    # 파일 저장 경로
    file_path = os.path.join(context_dir, safe_filename)
    
    # 파일 저장
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # 새로운 File 메타데이터 반환
    return {
        "fileId": file_id,
        "originalFileName": original_filename,
        "filePath": context,  # 컨텍스트 정보
        "backendPath": file_path,  # 실제 백엔드 저장 경로
        "url": f"/api/files/{context}/{safe_filename}",
        "contentType": file.content_type,
        "size": os.path.getsize(file_path),
        "uploadedAt": int(time.time())
    }

def get_file_path(context: str, filename: str) -> str:
    """
    컨텍스트와 파일명으로부터 전체 파일 경로를 반환합니다.
    """
    return os.path.join(BASE_UPLOAD_DIR, context, filename)

def file_exists(context: str, filename: str) -> bool:
    """
    컨텍스트별 파일이 존재하는지 확인합니다.
    """
    file_path = get_file_path(context, filename)
    return os.path.exists(file_path)

def list_files(context: str = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    업로드된 파일 목록을 반환합니다.
    
    Args:
        context: 특정 컨텍스트의 파일만 조회 (None이면 전체)
        limit: 반환할 파일 수 제한
    """
    files = []
    
    if context:
        # 특정 컨텍스트의 파일들만 조회
        context_dir = os.path.join(BASE_UPLOAD_DIR, context)
        if os.path.exists(context_dir):
            for filename in os.listdir(context_dir):
                file_path = os.path.join(context_dir, filename)
                if os.path.isfile(file_path):
                    file_stat = os.stat(file_path)
                    files.append({
                        "filename": filename,
                        "context": context,
                        "path": file_path,
                        "url": f"/api/files/{context}/{filename}",
                        "size": file_stat.st_size,
                        "createdAt": file_stat.st_ctime
                    })
    else:
        # 모든 컨텍스트의 파일들 조회
        if os.path.exists(BASE_UPLOAD_DIR):
            for ctx in os.listdir(BASE_UPLOAD_DIR):
                ctx_path = os.path.join(BASE_UPLOAD_DIR, ctx)
                if os.path.isdir(ctx_path):
                    for filename in os.listdir(ctx_path):
                        file_path = os.path.join(ctx_path, filename)
                        if os.path.isfile(file_path):
                            file_stat = os.stat(file_path)
                            files.append({
                                "filename": filename,
                                "context": ctx,
                                "path": file_path,
                                "url": f"/api/files/{ctx}/{filename}",
                                "size": file_stat.st_size,
                                "createdAt": file_stat.st_ctime
                            })
    
    # 최신 파일 순으로 정렬
    files.sort(key=lambda x: x["createdAt"], reverse=True)
    
    # 제한된 수의 파일만 반환
    if limit and len(files) > limit:
        return files[:limit]
    
    return files 