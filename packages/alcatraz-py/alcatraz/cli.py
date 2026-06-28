import os
import sys
import json
import click
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

# Auto-load .env.local or .env from the current directory or any parent.
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv(".env.local", usecwd=True), override=False)
    load_dotenv(find_dotenv(".env", usecwd=True), override=False)
except ImportError:
    pass

console = Console()

_SEVERITY_COLOR = {"critical": "red", "high": "orange1", "medium": "yellow", "low": "green"}
_SEVERITY_ICON = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}
_SEVERITY_ORDER = ["critical", "high", "medium", "low"]


@click.group()
def main():
    """Alcatraz — AI Agent Security Layer"""


@main.command()
def serve():
    """Start the local agent runner server for dashboard integration."""
    from .serve import main as _serve
    _serve()


@main.command()
@click.argument("target", type=click.Path(exists=True), default=".")
@click.option("--api-key", envvar="ANTHROPIC_API_KEY", help="Anthropic API key")
@click.option("--output", "-o", type=click.Path(), help="Save JSON report to this file")
@click.option("--json", "raw_json", is_flag=True, help="Print raw JSON only (no formatting)")
def scan(target: str, api_key: str, output: str, raw_json: bool):
    """Scan an agent source file or project directory for security vulnerabilities."""
    from .redteam import scan as _scan, scan_project as _scan_project

    if not api_key:
        console.print("[red]Error:[/red] ANTHROPIC_API_KEY is not set.")
        sys.exit(1)

    is_dir = os.path.isdir(target)

    if not raw_json:
        console.print(
            Panel.fit(
                "[bold cyan]ALCATRAZ[/bold cyan] [white]— AI Agent Security Layer[/white]",
                border_style="cyan",
            )
        )
        if is_dir:
            console.print(f"\n[dim]Target:[/dim]  [bold]{target}/[/bold] (project scan)")
            console.print("[dim]Model:[/dim]   claude-sonnet-4-6")
            console.print("[dim]Status:[/dim]  Discovering agent files...\n")
        else:
            console.print(f"\n[dim]Target:[/dim]  [bold]{target}[/bold]")
            console.print("[dim]Model:[/dim]   claude-sonnet-4-6")
            console.print("[dim]Status:[/dim]  Analyzing...\n")

    try:
        if is_dir:
            from .finder import find_agent_files
            agent_files = find_agent_files(target)
            if not agent_files:
                console.print("[yellow]No agent files found.[/yellow] Make sure your project imports a supported framework (LangChain, CrewAI, OpenAI, Anthropic, etc.) and defines tools.")
                sys.exit(0)
            if not raw_json:
                console.print(f"[green]Found {len(agent_files)} agent file(s):[/green]")
                for f in agent_files:
                    console.print(f"  [dim]→[/dim] {f}")
                console.print()
            result = _scan_project(target, anthropic_api_key=api_key)
        else:
            result = _scan(target, anthropic_api_key=api_key)
    except Exception as e:
        console.print(f"[red]Scan failed:[/red] {e}")
        sys.exit(1)

    if raw_json:
        click.echo(json.dumps(result, indent=2, ensure_ascii=False))
        if output:
            with open(output, "w") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        return

    # ── Risk score header ─────────────────────────────────────────────────────
    risk = result.get("risk_score", 0)
    vulns = result.get("vulnerabilities", [])
    rules = result.get("rules", {})

    if risk >= 70:
        risk_color, risk_label = "red", "CRITICAL"
    elif risk >= 40:
        risk_color, risk_label = "orange1", "HIGH"
    else:
        risk_color, risk_label = "yellow", "MEDIUM"

    bar = "█" * (risk // 10) + "░" * (10 - risk // 10)

    console.print(
        Panel(
            f"[bold]Risk Score:[/bold]  [{risk_color}]{risk}/100  {bar}  {risk_label}[/{risk_color}]\n"
            f"[bold]Vulnerabilities:[/bold] {len(vulns)} found",
            title="[bold red]RED TEAM SCAN REPORT[/bold red]",
            border_style="red",
            box=box.DOUBLE,
        )
    )

    # ── Vulnerabilities table ─────────────────────────────────────────────────
    table = Table(box=box.ROUNDED, border_style="dim", header_style="bold", show_header=True)
    table.add_column("Severity", width=14, no_wrap=True)
    table.add_column("CVSS", width=6, no_wrap=True)
    table.add_column("CWE", width=10, no_wrap=True)
    table.add_column("Type", width=28)
    table.add_column("Location", width=20)
    table.add_column("Description")

    sorted_vulns = sorted(
        vulns,
        key=lambda v: _SEVERITY_ORDER.index(v.get("severity", "low"))
        if v.get("severity", "low") in _SEVERITY_ORDER
        else 3,
    )

    for v in sorted_vulns:
        sev = v.get("severity", "low")
        color = _SEVERITY_COLOR.get(sev, "white")
        icon = _SEVERITY_ICON.get(sev, "⚪")
        cvss = v.get("cvss_score")
        cvss_str = f"{cvss:.1f}" if isinstance(cvss, (int, float)) else str(cvss) if cvss else "N/A"
        cwe = v.get("cwe_id", "")
        table.add_row(
            f"[{color}]{icon} {sev.upper()}[/{color}]",
            f"[{color}]{cvss_str}[/{color}]",
            f"[dim]{cwe}[/dim]",
            f"[bold]{v.get('type', '')}[/bold]",
            f"[dim]{v.get('location', '')}[/dim]",
            v.get("description", ""),
        )

    console.print()
    console.print(table)

    # ── Generated rules ───────────────────────────────────────────────────────
    console.print("\n[bold cyan]Generated Security Policy:[/bold cyan]")
    console.print(Panel(json.dumps(rules, indent=2, ensure_ascii=False), border_style="cyan"))

    # ── Fix snippet ───────────────────────────────────────────────────────────
    rules_str = json.dumps(rules, indent=4)
    console.print("\n[bold green]Protect your agent — add these 2 lines:[/bold green]")
    console.print(
        Panel(
            f"[dim]import[/dim] alcatraz\n"
            f"alcatraz.[bold]init[/bold]("
            f"api_key=[yellow]\"YOUR_ALCATRAZ_KEY\"[/yellow], "
            f"rules={rules_str})",
            border_style="green",
        )
    )

    if output:
        with open(output, "w") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        console.print(f"\n[dim]Report saved → {output}[/dim]")
