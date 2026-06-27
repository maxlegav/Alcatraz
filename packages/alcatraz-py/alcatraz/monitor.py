import re
from typing import Any, Dict, List, Optional, Union
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

_INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"forget (your |all )?(previous |prior )?instructions",
    r"you are now",
    r"disregard (all )?(previous |your )?instructions",
    r"new (system )?instructions?:",
    r"system (prompt |message )?(override|update)",
    r"\[system\]",
    r"act as if",
    r"pretend (you are|to be)",
    r"override (your |security |safety )?(rules|policy|constraints)",
]

_SECRET_PATTERNS = [
    r"(aws_access_key_id|aws_secret|api_key|password|secret_key|auth_token)\s*[=:]\s*\S+",
    r"sk-[a-zA-Z0-9]{20,}",
    r"AKIA[0-9A-Z]{16}",
]


class AlcatrazMonitor(BaseCallbackHandler):
    """
    LangChain callback handler implementing Alcatraz's 4 monitoring points:
    1  INPUT  — prompt injection in messages sent to LLM
    2  OUTPUT — suspicious content in LLM response
    4  RESULT — prompt injection / data leak in tool output
    """

    def __init__(self, api_key: str = "", alcatraz_url: str = None, agent_id: str = None, verbose: bool = False):
        self.api_key = api_key
        self.alcatraz_url = alcatraz_url
        self.agent_id = agent_id
        self.verbose = verbose

    # 1 INPUT MONITOR
    def on_chat_model_start(
        self,
        serialized: Dict[str, Any],
        messages: List[List[Any]],
        **kwargs: Any,
    ) -> None:
        for msg_list in messages:
            for msg in msg_list:
                content = msg.content if hasattr(msg, "content") else str(msg)
                if isinstance(content, list):
                    # Multi-part content (text + images)
                    content = " ".join(
                        p.get("text", "") if isinstance(p, dict) else str(p)
                        for p in content
                    )
                self._check_injection(str(content), source="INPUT->LLM")

    # 2 OUTPUT MONITOR
    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        for generations in response.generations:
            for gen in generations:
                text = ""
                if hasattr(gen, "message") and hasattr(gen.message, "content"):
                    text = gen.message.content or ""
                elif hasattr(gen, "text"):
                    text = gen.text or ""
                if isinstance(text, list):
                    text = " ".join(str(p) for p in text)
                self._check_secrets(str(text), source="LLM OUTPUT")

    # 4 RESULT MONITOR
    def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        text = output if isinstance(output, str) else str(output)
        self._check_injection(text, source="TOOL RESULT")
        self._check_secrets(text, source="TOOL RESULT")

    def _check_injection(self, text: str, source: str) -> bool:
        text_lower = text.lower()
        for pattern in _INJECTION_PATTERNS:
            if re.search(pattern, text_lower):
                self._alert("PROMPT INJECTION", source, f"matched pattern: /{pattern}/")
                return True
        return False

    def _check_secrets(self, text: str, source: str) -> bool:
        for pattern in _SECRET_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                self._alert("SENSITIVE DATA DETECTED", source, "potential credential/secret in content")
                return True
        return False

    def _alert(self, alert_type: str, source: str, detail: str) -> None:
        if self.verbose:
            print(f"\n[ALCATRAZ {alert_type}] source={source}")
            print(f"    {detail}")
        # Log the security event to the dashboard in real-time
        if self.agent_id and self.api_key:
            from .logger import send_log
            tool_name = (
                "prompt_injection" if "INJECTION" in alert_type else "sensitive_data_leak"
            )
            send_log(
                api_key=self.api_key,
                tool_name=tool_name,
                status="BLOCKED",
                severity="critical" if "INJECTION" in alert_type else "high",
                payload={"source": source, "detail": detail, "alert_type": alert_type},
                alcatraz_url=self.alcatraz_url,
                agent_id=self.agent_id,
            )
