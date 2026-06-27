def check_rules(tool_name: str, rules: dict) -> str:
    """Returns 'ALLOW', 'DENY', or 'REVIEW' based on the security policy."""
    deny_list = rules.get("DENY", [])
    review_list = rules.get("REVIEW", [])
    allow_list = rules.get("ALLOW", [])

    name = tool_name.lower()

    # DENY takes priority over everything
    for pattern in deny_list:
        if pattern.lower() in name:
            return "DENY"

    # REVIEW is checked next
    for pattern in review_list:
        if pattern.lower() in name:
            return "REVIEW"

    # If an ALLOW list is defined, the tool must appear in it
    if allow_list:
        return "ALLOW" if any(p.lower() in name for p in allow_list) else "DENY"

    # No rules = allowed by default
    return "ALLOW"
