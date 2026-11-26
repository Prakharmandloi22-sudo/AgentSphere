import re
from typing import List, Tuple
from models.schemas import GuardrailCheckResponse

# Known prompt injection signatures
INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"(?i)system\s+override",
    r"(?i)disregard\s+(the\s+)?above",
    r"(?i)reveal\s+(your\s+)?system\s+prompt",
    r"(?i)you\s+are\s+now\s+in\s+developer\s+mode",
    r"(?i)jailbreak",
    r"(?i)bypass\s+all\s+safety\s+filters",
    r"(?i)repeat\s+the\s+words\s+above"
]

# Sensitive patterns to mask (secrets, credentials, API keys)
SECRET_PATTERNS = [
    (r"sk-[a-zA-Z0-9]{20,}", "[REDACTED_API_KEY]"),
    (r"AKIA[0-9A-Z]{16}", "[REDACTED_AWS_KEY]"),
    (r"(?i)password\s*[:=]\s*['\"]?([^'\"\s]+)['\"]?", "password: [REDACTED_PASSWORD]"),
    (r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b", "[REDACTED_CARD_NUMBER]")
]

class GuardrailsService:
    @staticmethod
    def inspect(text: str, check_pii: bool = True, check_injection: bool = True) -> GuardrailCheckResponse:
        detected_patterns: List[str] = []
        is_safe = True
        risk_level = "LOW"
        action_taken = "PASSED"
        sanitized_text = text

        if check_injection:
            for pattern in INJECTION_PATTERNS:
                if re.search(pattern, text):
                    detected_patterns.append(f"PromptInjectionDetected: {pattern}")
                    is_safe = False
                    risk_level = "HIGH"
                    action_taken = "BLOCKED"

        if check_pii:
            for pattern, mask in SECRET_PATTERNS:
                if re.search(pattern, sanitized_text):
                    detected_patterns.append("SensitiveDataRedaction")
                    sanitized_text = re.sub(pattern, mask, sanitized_text)
                    if action_taken != "BLOCKED":
                        action_taken = "MASKED"
                        risk_level = "MEDIUM"

        return GuardrailCheckResponse(
            is_safe=is_safe,
            risk_level=risk_level,
            detected_patterns=detected_patterns,
            sanitized_text=sanitized_text,
            action_taken=action_taken
        )
