from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from bs4 import BeautifulSoup
import logging

# 로깅 설정
logger = logging.getLogger(__name__)

class ExtractionRule(BaseModel):
    """HTML 요소 추출 규칙 모델"""
    name: str = Field(..., description="추출된 데이터의 키로 사용될 고유한 이름")
    selector: str = Field(..., description="데이터를 추출할 HTML 요소를 지정하는 CSS 선택자")
    target: str = Field("text", description="선택된 요소에서 추출할 대상 (text, attribute, html)")
    attribute_name: Optional[str] = Field(None, description="target이 'attribute'일 때 추출할 HTML 속성의 이름")
    multiple: bool = Field(False, description="여러 요소 추출 여부 (true: 배열 반환, false: 단일 값 반환)")

def extract_element_data(element, target: str, attribute_name: Optional[str] = None) -> Union[str, None]:
    """
    선택된 HTML 요소에서 지정된 대상 데이터를 추출합니다.
    
    Args:
        element: BeautifulSoup 요소
        target: 추출 대상 타입 ('text', 'html', 'attribute')
        attribute_name: target이 'attribute'일 때 추출할 속성 이름
        
    Returns:
        추출된 데이터 문자열 또는 None
    """
    try:
        if target == "text":
            return element.get_text(strip=True)
        elif target == "html":
            return str(element)
        elif target == "attribute" and attribute_name:
            return element.get(attribute_name, "")
        else:
            logger.warning(f"지원하지 않는 추출 대상: {target}")
            return None
    except Exception as e:
        logger.error(f"요소 데이터 추출 중 오류: {str(e)}")
        return None

def parse_html_content(html_string: str, rules: List[ExtractionRule]) -> Dict[str, Any]:
    """
    HTML 문자열을 파싱하고 지정된 규칙에 따라 데이터를 추출합니다.
    
    Args:
        html_string: 파싱할 HTML 문자열
        rules: 데이터 추출 규칙 목록
        
    Returns:
        추출된 데이터를 포함하는 딕셔너리
    """
    try:
        # HTML 문자열 검증
        if not html_string or not isinstance(html_string, str):
            logger.error("유효하지 않은 HTML 입력")
            return {"error": "유효하지 않은 HTML 입력"}
        
        # BeautifulSoup을 사용하여 HTML 파싱 (lxml 파서 사용)
        soup = BeautifulSoup(html_string, 'lxml')
        
        # 결과 딕셔너리 초기화
        result = {}
        
        # 각 규칙에 따라 데이터 추출
        for rule in rules:
            try:
                # multiple 값에 따라 select() 또는 select_one() 사용
                if rule.multiple:
                    elements = soup.select(rule.selector)
                    # 각 요소에서 데이터 추출하여 배열로 저장
                    result[rule.name] = [
                        extract_element_data(el, rule.target, rule.attribute_name)
                        for el in elements
                    ]
                    # None 값 필터링
                    result[rule.name] = [item for item in result[rule.name] if item is not None]
                    
                    logger.info(f"규칙 '{rule.name}': {len(elements)}개 요소 추출됨")
                else:
                    # 단일 요소 추출
                    element = soup.select_one(rule.selector)
                    if element:
                        result[rule.name] = extract_element_data(element, rule.target, rule.attribute_name)
                        logger.info(f"규칙 '{rule.name}': 요소 추출 성공")
                    else:
                        result[rule.name] = None
                        logger.warning(f"규칙 '{rule.name}': 선택자 '{rule.selector}'와 일치하는 요소 없음")
            except Exception as rule_error:
                # 개별 규칙 처리 중 오류 발생 시, 오류 메시지를 결과에 포함하고 계속 진행
                logger.error(f"규칙 '{rule.name}' 처리 중 오류: {str(rule_error)}")
                result[rule.name] = {"error": str(rule_error)}
        
        return result
        
    except Exception as e:
        # 전체 파싱 처리 중 오류 발생 시
        logger.error(f"HTML 파싱 중 오류: {str(e)}")
        return {"error": f"HTML 파싱 중 오류: {str(e)}"} 