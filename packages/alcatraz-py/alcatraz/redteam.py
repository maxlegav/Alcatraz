import os
import json
import anthropic

_SYSTEM = "Tu es un expert en cybersécurité spécialisé dans les agents IA."

_PROMPT = """Analyse ce code d'agent IA et identifie toutes les vulnérabilités.

CODE À ANALYSER :
{code}

Réponds UNIQUEMENT en JSON valide avec ce format exact (aucun texte avant ou après) :
{{
  "vulnerabilities": [
    {{
      "severity": "critical|high|medium|low",
      "type": "nom de la vulnérabilité",
      "description": "ce qui peut arriver",
      "location": "où dans le code",
      "fix": "comment corriger"
    }}
  ],
  "rules": {{
    "DENY": ["liste des outils/actions à bloquer"],
    "ALLOW": ["liste des outils autorisés"],
    "MAX_CALLS_PER_MIN": 10
  }},
  "risk_score": 0
}}

Focus sur :
1. Accès à des fichiers sensibles (.env, /etc, clés API)
2. Exécution de commandes bash/système
3. Lecture de variables d'environnement
4. Appels HTTP vers des URLs externes
5. Prompt injection possible
6. Boucles infinies / runaway costs
7. Exfiltration de données
"""


def scan(file_path: str, anthropic_api_key: str = None) -> dict:
    """
    Scan an agent source file for security vulnerabilities using Claude.

    Returns a dict:  { vulnerabilities: [...], rules: {...}, risk_score: int }
    """
    api_key = anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. "
            "Export it or pass anthropic_api_key= to scan()."
        )

    with open(file_path, "r", encoding="utf-8") as f:
        code = f.read()

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM,
        messages=[{"role": "user", "content": _PROMPT.format(code=code)}],
    )

    text = message.content[0].text if message.content else ""

    # Strip markdown code fences if Claude wraps the JSON
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    return json.loads(text)
