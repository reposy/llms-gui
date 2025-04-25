from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel
from bs4 import BeautifulSoup


class ExtractionRule(BaseModel):
    name: str
    selector: str
    target: str  # "text", "attribute", "html"
    attribute_name: Optional[str] = None
    multiple: bool = False


def parse_html_content(html_string: str, rules: List[ExtractionRule]) -> Dict[str, Any]:
    """
    Parse HTML content according to extraction rules.
    
    Args:
        html_string: The HTML content to parse
        rules: List of extraction rules defining what to extract
        
    Returns:
        Dictionary with keys from rule names and values from extracted content
    """
    try:
        # Parse HTML with BeautifulSoup using lxml parser for better performance
        soup = BeautifulSoup(html_string, 'lxml')
        
        result = {}
        
        for rule in rules:
            try:
                # Get elements based on selector
                if rule.multiple:
                    elements = soup.select(rule.selector)
                    extracted_values = []
                    
                    for element in elements:
                        value = _extract_value_from_element(element, rule.target, rule.attribute_name)
                        if value is not None:
                            extracted_values.append(value)
                    
                    result[rule.name] = extracted_values
                else:
                    # Get first matching element
                    element = soup.select_one(rule.selector)
                    if element:
                        value = _extract_value_from_element(element, rule.target, rule.attribute_name)
                        result[rule.name] = value
                    else:
                        result[rule.name] = None
            
            except Exception as e:
                # Log error and continue with next rule
                print(f"Error processing rule '{rule.name}': {str(e)}")
                result[rule.name] = None
        
        return result
    
    except Exception as e:
        # Return error for the entire parsing process
        return {"error": f"Failed to parse HTML: {str(e)}"}


def _extract_value_from_element(element, target: str, attribute_name: Optional[str]) -> Union[str, None]:
    """Extract value from an element based on target type"""
    if target == "text":
        return element.get_text(strip=True)
    elif target == "html":
        return str(element)
    elif target == "attribute" and attribute_name:
        return element.get(attribute_name)
    else:
        return None 