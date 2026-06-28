import os
import json
import anthropic

_SYSTEM = "Tu es un expert en cybersécurité spécialisé dans les agents IA."

_INSTRUCTIONS = """
Réponds UNIQUEMENT en JSON valide avec ce format exact (aucun texte avant ou après) :
{
  "vulnerabilities": [
    {
      "severity": "critical|high|medium|low",
      "cvss_score": 9.8,
      "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      "cwe_id": "CWE-78",
      "cve_references": ["CVE-2021-44228"],
      "owasp_llm": "LLM01:2025 Prompt Injection",
      "type": "nom de la vulnérabilité",
      "description": "ce qui peut arriver",
      "location": "où dans le code",
      "fix": "comment corriger"
    }
  ],
  "rules": {
    "DENY": ["liste des outils/actions à bloquer"],
    "ALLOW": ["liste des outils autorisés"],
    "MAX_CALLS_PER_MIN": 10
  },
  "risk_score": 0
}

Pour chaque vulnérabilité :
- cvss_score : score CVSS v3.1 (0.0 à 10.0) calculé précisément selon la métrique
- cvss_vector : vecteur CVSS v3.1 complet (ex: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
- cwe_id : identifiant CWE le plus précis (ex: CWE-78 pour OS Command Injection)
- cve_references : CVEs connues associées au pattern (liste vide [] si aucun CVE direct)
- owasp_llm : catégorie OWASP LLM Top 10 2025 la plus pertinente (ex: "LLM01:2025 Prompt Injection")

Focus sur :
1. Accès à des fichiers sensibles (.env, /etc, clés API) → CWE-22, CWE-200
2. Exécution de commandes bash/système → CWE-78, CWE-77
3. Lecture de variables d'environnement → CWE-200, CWE-312
4. Appels HTTP vers des URLs externes / exfiltration → CWE-918, CWE-359
5. Prompt injection → CWE-1336, OWASP LLM01
6. Boucles infinies / runaway costs → CWE-835
7. Absence de validation d'entrées → CWE-20
"""


def scan_project(directory: str, anthropic_api_key: str = None) -> dict:
    """
    Crawl `directory`, identify agent files, scan each one, and merge results.

    Returns the same shape as scan() but with an added `files_scanned` key.
    """
    from .finder import find_agent_files

    agent_files = find_agent_files(directory)
    if not agent_files:
        return {
            'files_scanned': [],
            'vulnerabilities': [],
            'rules': {'DENY': [], 'ALLOW': [], 'MAX_CALLS_PER_MIN': 10},
            'risk_score': 0,
        }

    merged_vulns: list = []
    merged_deny: list = []
    merged_allow: list = []
    max_risk = 0
    max_calls = 10

    for path in agent_files:
        result = scan(path, anthropic_api_key=anthropic_api_key)
        merged_vulns.extend(result.get('vulnerabilities', []))
        rules = result.get('rules', {})
        merged_deny.extend(rules.get('DENY', []))
        merged_allow.extend(rules.get('ALLOW', []))
        max_calls = max(max_calls, rules.get('MAX_CALLS_PER_MIN', 10))
        max_risk = max(max_risk, result.get('risk_score', 0))

    # Deduplicate rule lists preserving order
    seen: set = set()
    deny_deduped = [x for x in merged_deny if not (x in seen or seen.add(x))]  # type: ignore[func-returns-value]
    seen = set()
    allow_deduped = [x for x in merged_allow if x not in deny_deduped and not (x in seen or seen.add(x))]  # type: ignore[func-returns-value]

    return {
        'files_scanned': agent_files,
        'vulnerabilities': merged_vulns,
        'rules': {
            'DENY': deny_deduped,
            'ALLOW': allow_deduped,
            'MAX_CALLS_PER_MIN': max_calls,
        },
        'risk_score': max_risk,
    }


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

    # Build prompt by concatenation — avoids str.format() misinterpreting
    # { } characters that appear inside the scanned code.
    user_content = (
        "Analyse ce code d'agent IA et identifie toutes les vulnérabilités.\n\n"
        "CODE À ANALYSER :\n"
        + code
        + "\n"
        + _INSTRUCTIONS
    )

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
    )

    text = message.content[0].text if message.content else ""

    # Strip markdown code fences if Claude wraps the JSON
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    return json.loads(text)
