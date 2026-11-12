"""
Web search service for NovaAI.

Uses DuckDuckGo (via ddgs) — no API key required.

Public API:
    search_web(query, max_results=5)      -> List[Dict]
    build_web_context(results)             -> str
    needs_web_search(query)                -> bool
    is_available()                         -> bool
"""

import re
from typing import List, Dict, Any

try:
    from ddgs import DDGS
    HAS_DDGS = True
except ImportError:
    try:
        from duckduckgo_search import DDGS
        HAS_DDGS = True
    except ImportError:
        HAS_DDGS = False


# ==================================================
# Heuristics: should we search the web?
# ==================================================
# Phrases that almost always need fresh info
_TIME_SENSITIVE_PATTERNS = [
    r"\blatest\b",
    r"\bcurrent\b",
    r"\brecent\b",
    r"\btoday\b",
    r"\byesterday\b",
    r"\btomorrow\b",
    r"\bthis (week|month|year)\b",
    r"\bnews\b",
    r"\bbreaking\b",
    r"\bupdate[sd]?\b",
    r"\bnew[s]?\b.*\b20\d{2}\b",
    r"\b20\d{2}\b",                     # any year mention
    r"\bwho is the (current|new)\b",
    r"\bwhat(?:'s| is) the (latest|current|new)\b",
    r"\bstock price\b",
    r"\bweather\b",
    r"\blive\b",
    r"\bnow\b",
    r"\bjust (announced|released|launched)\b",
]


def needs_web_search(query: str) -> bool:
    """
    Very lightweight heuristic: does this query likely need live web data?

    Returns True for time-sensitive questions, False otherwise.
    Note: this is a *suggestion* — the UI toggle ultimately decides.
    """
    q = (query or "").strip().lower()
    if not q:
        return False

    for pattern in _TIME_SENSITIVE_PATTERNS:
        if re.search(pattern, q):
            return True

    return False


# ==================================================
# Search
# ==================================================
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
            "score": round(1.0 - i * 0.05, 3),
        })

    return results


# ==================================================
# Context builder
# ==================================================
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