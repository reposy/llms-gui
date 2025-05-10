import os
import uuid
import time
from fastapi import UploadFile, HTTPException
from typing import Dict, Any, List, Optional

# 기본 설정
UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", 
    "image/svg+xml", "image/bmp", "image/tiff"
]

def ensure_upload_dir():
    """업로드 디렉토리가 존재하는지 확인하고, 없으면 생성합니다."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

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

async def save_uploaded_file(file: UploadFile) -> Dict[str, Any]:
    """
    파일을 서버에 저장하고 메타데이터를 반환합니다.
    """
    # 디렉토리 확인
    ensure_upload_dir()
    
    # 파일 유효성 검사
    await validate_image_file(file)
    
    # 파일 ID 및 안전한 파일명 생성
    file_id = str(uuid.uuid4())
    original_filename = file.filename or "unnamed_file"
    file_ext = os.path.splitext(original_filename)[1]
    safe_filename = f"{file_id}{file_ext}"
    
    # 파일 저장 경로
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    # 파일 저장
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # 파일 메타데이터 반환
    return {
        "id": file_id,
        "originalName": original_filename,
        "filename": safe_filename,
        "path": file_path,
        "url": f"/api/files/{safe_filename}",
        "contentType": file.content_type,
        "size": os.path.getsize(file_path),
        "uploadedAt": time.time()
    }

def get_file_path(filename: str) -> str:
    """
    파일명으로부터 전체 파일 경로를 반환합니다.
    """
    return os.path.join(UPLOAD_DIR, filename)

def file_exists(filename: str) -> bool:
    """
    파일이 존재하는지 확인합니다.
    """
    file_path = get_file_path(filename)
    return os.path.exists(file_path)

def list_files(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    업로드된 파일 목록을 반환합니다.
    """
    ensure_upload_dir()
    files = []
    
    for filename in os.listdir(UPLOAD_DIR):
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.isfile(file_path):
            file_stat = os.stat(file_path)
            files.append({
                "filename": filename,
                "path": file_path,
                "url": f"/api/files/{filename}",
                "size": file_stat.st_size,
                "createdAt": file_stat.st_ctime
            })
    
    # 최신 파일 순으로 정렬
    files.sort(key=lambda x: x["createdAt"], reverse=True)
    
    # 제한된 수의 파일만 반환
    if limit and len(files) > limit:
        return files[:limit]
    
    return files 