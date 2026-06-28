"""
finder.py — crawl a directory, filter noise, identify agent files.

An "agent file" is a Python file that:
  1. imports a known agent framework (langchain, crewai, openai, etc.)
  2. AND references tool-call patterns (@tool, tools=[], Tool(, etc.)
"""

import os
import re

IGNORE_DIRS = {
    '.git', '__pycache__', 'node_modules', 'venv', '.venv', 'env',
    'dist', 'build', '.tox', 'site-packages', 'eggs', '.eggs',
    'migrations', '.mypy_cache', '.pytest_cache', '.ruff_cache',
}

IGNORE_FILE_PATTERNS = {
    'setup.py', 'conftest.py', 'manage.py', '__main__.py',
}

AGENT_IMPORT_RE = re.compile(
    r'^\s*(import|from)\s+(langchain|crewai|openai|anthropic|autogen|'
    r'llama_index|llamaindex|haystack|semantic_kernel|pydantic_ai|agentops)',
    re.MULTILINE,
)

TOOL_PATTERN_RE = re.compile(
    r'@tool\b|'
    r'\bTool\s*\(|'
    r'\btools\s*=\s*\[|'
    r'\btool_calls\b|'
    r'\bfunction_call\b|'
    r'\bFunctionTool\b|'
    r'\bStructuredTool\b|'
    r'\bBaseTool\b|'
    r'\btool_choice\b|'
    r'\btools\s*=\s*\{',
)


def _is_agent_file(path: str) -> bool:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        return bool(AGENT_IMPORT_RE.search(content)) and bool(TOOL_PATTERN_RE.search(content))
    except OSError:
        return False


def find_agent_files(directory: str) -> list:
    """
    Recursively walk `directory` and return paths of Python files that look
    like agent code (framework import + tool call pattern).

    Returns a list of absolute paths, sorted by directory depth (shallowest first).
    """
    directory = os.path.abspath(directory)
    candidates = []

    for root, dirs, files in os.walk(directory):
        # Prune ignored directories in-place so os.walk skips them
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]

        for fname in files:
            if not fname.endswith('.py'):
                continue
            if fname in IGNORE_FILE_PATTERNS:
                continue
            full = os.path.join(root, fname)
            if _is_agent_file(full):
                candidates.append(full)

    # Shallowest paths first (fewer os.sep separators = closer to root)
    candidates.sort(key=lambda p: p.count(os.sep))
    return candidates
