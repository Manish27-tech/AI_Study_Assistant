"""
Web search service for NovaAI.

Uses DuckDuckGo (via ddgs) — no API key required.

Public API:
    search_web(query, max_results=5) -> List[Dict]
    build_web_context(results)        -> str
"""

from typing import List, Dict, Any, Optional

try:
    from ddgs import DDGS
    HAS_DDGS = True
except ImportError:
    try:
        from duckduckgo_search import DDGS
        HAS_DDGS = True
    except ImportError:
        HAS_DDGS = False


def search_web(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Search the web and return a list of results:
        { title, url, snippet, score }
    Returns [] on any failure (never raises).
    """
    query = (query or "").strip()
    if not query or not HAS_DDGS:
        return []

    try:
        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=max(1, min(max_results, 10))))
    except Exception as e:
        print(f"[web_search] error: {e}")
        return []

    results = []
    for i, r in enumerate(raw):
        title = (r.get("title") or "").strip()
        url = (r.get("href") or r.get("url") or "").strip()
        snippet = (r.get("body") or r.get("snippet") or "").strip()
        if not title or not url:
            continue
        results.append({
            "title": title,
            "url": url,
            "snippet": snippet,
            "score": round(1.0 - i * 0.05, 3),   # arbitrary descending score
        })

    return results


def build_web_context(results: List[Dict[str, Any]]) -> str:
    """Format web results as a context block for the LLM."""
    if not results:
        return ""

    lines = [
        "═══════════════════════════════════════════",
        "WEB SEARCH RESULTS (LIVE FROM THE INTERNET)",
        "═══════════════════════════════════════════",
        "",
    ]
    for i, r in enumerate(results, 1):
        lines.append(f"[Web {i}] {r['title']}")
        lines.append(f"URL: {r['url']}")
        lines.append(f"Snippet: {r['snippet']}")
        lines.append("")

    lines.append("═══════════════════════════════════════════")
    lines.append(
        "Use these results to answer the user's question. "
        "Cite as [Web 1], [Web 2], etc. "
        "If the results don't answer the question, say so honestly — "
        "never invent facts or URLs."
    )

    return "\n".join(lines)


def is_available() -> bool:
    return HAS_DDGS