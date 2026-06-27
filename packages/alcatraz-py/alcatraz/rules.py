def check_rules(tool_name: str, rules: dict) -> bool:
    """Returns True if the tool call is allowed by the security policy."""
    deny_list = rules.get("DENY", [])
    allow_list = rules.get("ALLOW", [])

    name = tool_name.lower()

    # DENY takes priority over everything
    for pattern in deny_list:
        if pattern.lower() in name:
            return False

    # If an ALLOW list is defined, the tool must appear in it
    if allow_list:
        return any(p.lower() in name for p in allow_list)

    # No rules = allowed by default
    return True
