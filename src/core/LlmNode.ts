/**
 * 입력에서 이미지 파일과 메타데이터 추출 (통합 파일 시스템 지원)
 */
private extractImages(input: any): {
  files: File[],
  metaData: LocalFileMetadata[],
  backendFiles: BackendFileMetadata[]
} {
  const files: File[] = [];
  const metaData: LocalFileMetadata[] = [];
  const backendFiles: BackendFileMetadata[] = [];
  
  // 단일 File 객체
  if (input instanceof File && input.type.startsWith('image/')) {
    files.push(input);
    this._log(`Found single image file: ${input.name}`);
  }
  // 단일 BackendFileMetadata 객체 (새로운 통합 시스템)
  else if (input && typeof input === 'object' && 'fileId' in input && 'originalFileName' in input) {
    backendFiles.push(input as BackendFileMetadata);
    this._log(`Found single backend file metadata: ${input.originalFileName}`);
  }
  // 단일 LocalFileMetadata 객체 (레거시)
  else if (input && typeof input === 'object' && 'file' in input && 'objectUrl' in input) {
    if (input.file?.type?.startsWith('image/')) {
      metaData.push(input as LocalFileMetadata);
      this._log(`Found single local image metadata: ${input.originalName}`);
    }
  }
  // 배열 입력
  else if (Array.isArray(input)) {
    for (const item of input) {
      if (item instanceof File && item.type.startsWith('image/')) {
        files.push(item);
        this._log(`Found image file in array: ${item.name}`);
      }
      else if (item && typeof item === 'object' && 'fileId' in item && 'originalFileName' in item) {
        backendFiles.push(item as BackendFileMetadata);
        this._log(`Found backend file metadata in array: ${item.originalFileName}`);
      }
      else if (item && typeof item === 'object' && 'file' in item && 'objectUrl' in item) {
        const localImage = item as LocalFileMetadata;
        if (localImage.file?.type?.startsWith('image/')) {
          metaData.push(localImage);
          this._log(`Found local image metadata in array: ${localImage.originalName}`);
        }
      }
    }
  }
  
  return { files, metaData, backendFiles };
}

async execute(input: any): Promise<string | null> {
  console.log('[LLMNode] execute input:', input);

  // 입력에서 이미지 추출 (통합 파일 시스템 지원)
  const { files: imageFiles, metaData: localImageMetadata, backendFiles: backendImageFiles } = this.extractImages(input);

  // ... existing code ...

  if (mode === 'vision') {
    const imagePaths: string[] = [];
    
    // BackendFileMetadata에서 파일 경로 추출 (최우선)
    if (backendImageFiles.length > 0) {
      backendImageFiles.forEach((img) => {
        const filePath = img.originalFileName;
        imagePaths.push(filePath);
        this._log(`Using BackendFileMetadata path: ${filePath} (stored in ${img.filePath})`);
      });
    }
    // LocalFileMetadata에서 파일 경로 추출 (두 번째 우선순위)
    else if (localImageMetadata.length > 0) {
      localImageMetadata.forEach((img) => {
        const filePath = img.originalName || img.file?.name || 'unknown';
        imagePaths.push(filePath);
        this._log(`Using LocalFileMetadata path: ${filePath}`);
      });
    }
    // File 객체에서 파일 경로 추출 (마지막 우선순위)
    else if (imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        const filePath = (file as any).webkitRelativePath || file.name;
        imagePaths.push(filePath);
        this._log(`Using File path: ${filePath} (webkitRelativePath: ${(file as any).webkitRelativePath || 'none'})`);
      });
    }
    
    // 파일 경로 정보를 응답 첫 줄에 추가
    if (imagePaths.length > 0) {
      let pathInfo = '';
      if (imagePaths.length === 1) {
        pathInfo = `[${imagePaths[0]}]`;
      } else {
        const quotedPaths = imagePaths.map(path => `"${path}"`);
        pathInfo = `[${quotedPaths.join(', ')}]`;
      }
      
      resultText = pathInfo + '\n\n' + resultText;
      this._log(`Added image path info: ${pathInfo}`);
    }
  }

  // LLM 호출 시 통합 파일 시스템 지원
  const llmResult = await this.llmService.generate({
    model: effectiveProperty.model,
    prompt: this.resolvePrompt(input, effectiveProperty),
    temperature: effectiveProperty.temperature,
    maxTokens: effectiveProperty.maxTokens,
    mode: mode,
    // 이미지 소스 우선순위: BackendFileMetadata > LocalFileMetadata > File
    imageMetadata: backendImageFiles.length > 0 ? backendImageFiles : undefined,
    localImages: backendImageFiles.length === 0 && localImageMetadata.length > 0 ? localImageMetadata : undefined,
    inputFiles: backendImageFiles.length === 0 && localImageMetadata.length === 0 && imageFiles.length > 0 ? imageFiles : undefined,
    ollamaUrl: effectiveProperty.ollamaUrl,
    openaiApiKey: effectiveProperty.openaiApiKey
  });

  // ... existing code ...
} 