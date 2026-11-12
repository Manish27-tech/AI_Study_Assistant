import os
import time
import random
from typing import List, Dict, Any, Iterator
from dotenv import load_dotenv

load_dotenv()

# ==================================================
# Retry Logic (Exponential Backoff)
# ==================================================
def _retry_with_backoff(func, max_retries=4, initial_delay=2.0):
    """
    Retries a function if a transient server error occurs (503, 429).
    """
    retries = 0
    while retries < max_retries:
        try:
            return func()
        except Exception as e:
            error_str = str(e).lower()
            # Check for transient errors
            if any(x in error_str for x in ["503", "429", "unavailable", "overloaded", "resource exhausted"]):
                if retries == max_retries - 1:
                    raise # Give up after max retries
                
                # Calculate delay: 2s, 4s, 8s, 16s + random jitter
                delay = (initial_delay * (2 ** retries)) + random.uniform(0.5, 1.5)
                print(f"[LLM Router] Google API overloaded. Retrying in {delay:.1f}s...")
                time.sleep(delay)
                retries += 1
            else:
                raise # Don't retry client errors (e.g., invalid API key)


# ==================================================
# Model Catalog
# ==================================================
_MODEL_CATALOG = {
    # --- Groq (Fast) ---
    "groq-oss-20b": {
        "provider": "groq", "real_id": "openai/gpt-oss-20b", "label": "Nova Fast (OSS 20B)",
        "description": "Fastest responses, good for quick questions.", "speed": "fast", "capability": "basic",
    },
    "groq-oss-120b": {
        "provider": "groq", "real_id": "openai/gpt-oss-120b", "label": "Nova Balanced (OSS 120B)",
        "description": "Best balance of speed and quality.", "speed": "medium", "capability": "general",
    },
    # --- OpenAI ---
    "gpt-4o": {
        "provider": "openai", "real_id": "gpt-4o", "label": "GPT-4o",
        "description": "OpenAI's flagship model.", "speed": "medium", "capability": "advanced",
    },
    "gpt-4o-mini": {
        "provider": "openai", "real_id": "gpt-4o-mini", "label": "GPT-4o Mini",
        "description": "Fast and cheap OpenAI model.", "speed": "fast", "capability": "general",
    },
    # --- Anthropic ---
    "claude-3-5-sonnet": {
        "provider": "anthropic", "real_id": "claude-3-5-sonnet-20240620", "label": "Claude 3.5 Sonnet",
        "description": "Anthropic's best model for coding and reasoning.", "speed": "medium", "capability": "advanced",
    },
    "claude-3-haiku": {
        "provider": "anthropic", "real_id": "claude-3-haiku-20240307", "label": "Claude 3 Haiku",
        "description": "Anthropic's fastest model.", "speed": "fast", "capability": "basic",
    },
    # --- Google (Updated to Stable 3.8) ---
    "gemini-3-8-flash": {
        "provider": "google", "real_id": "gemini-3.8-flash", "label": "Gemini 3.8 Flash",
        "description": "Google's most intelligent and fast model.", "speed": "fast", "capability": "general",
    },
    "gemini-3-1-flash-lite": {
        "provider": "google", "real_id": "gemini-3.1-flash-lite", "label": "Gemini 3.1 Lite",
        "description": "Google's lightweight, ultra-fast model.", "speed": "fast", "capability": "basic",
    },
}

_LEGACY_MAP = {
    "nova-fast": "groq-oss-20b",
    "nova-balanced": "groq-oss-120b",
    "nova-reasoning": "groq-oss-120b",
    "gemini-1-5-pro": "gemini-3-8-flash",
    "gemini-1-5-flash": "gemini-3-8-flash",
    "gemini-2-0-flash": "gemini-3-8-flash",
    "gemini-2-5-flash": "gemini-3-8-flash",
    "gemini-3.8-flash": "gemini-3-8-flash",
}

DEFAULT_MODEL = "groq-oss-120b"
TITLE_MODEL = "groq-oss-20b"


def list_models() -> List[Dict[str, Any]]:
    result = []
    has_groq = bool(os.getenv("GROQ_API_KEY"))
    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    has_anthropic = bool(os.getenv("ANTHROPIC_API_KEY"))
    has_google = bool(os.getenv("GEMINI_API_KEY"))

    for ui_id, info in _MODEL_CATALOG.items():
        provider = info["provider"]
        locked = False
        if provider == "groq" and not has_groq: locked = True
        if provider == "openai" and not has_openai: locked = True
        if provider == "anthropic" and not has_anthropic: locked = True
        if provider == "google" and not has_google: locked = True

        result.append({
            "id": ui_id, "label": info["label"], "description": info["description"],
            "speed": info["speed"], "capability": info["capability"],
            "locked": locked, "provider": provider,
        })
    return result


def resolve_model(ui_id: str) -> Dict[str, str]:
    if not ui_id: ui_id = DEFAULT_MODEL
    if ui_id in _LEGACY_MAP: ui_id = _LEGACY_MAP[ui_id]
    if ui_id not in _MODEL_CATALOG: ui_id = DEFAULT_MODEL
    return _MODEL_CATALOG[ui_id]


# ==================================================
# Client Getters
# ==================================================
_clients = {}

def _get_groq():
    if "groq" not in _clients:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key: raise ValueError("GROQ_API_KEY is missing in .env")
        _clients["groq"] = Groq(api_key=api_key)
    return _clients["groq"]

def _get_openai():
    if "openai" not in _clients:
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key: raise ValueError("OPENAI_API_KEY is missing in .env")
        _clients["openai"] = OpenAI(api_key=api_key)
    return _clients["openai"]

def _get_anthropic():
    if "anthropic" not in _clients:
        import anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key: raise ValueError("ANTHROPIC_API_KEY is missing in .env")
        _clients["anthropic"] = anthropic.Anthropic(api_key=api_key)
    return _clients["anthropic"]

def _get_google():
    if "google" not in _clients:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: raise ValueError("GEMINI_API_KEY is missing in .env")
        # The new SDK automatically handles some retries, but we wrap it anyway
        _clients["google"] = genai.Client(api_key=api_key)
    return _clients["google"]


# ==================================================
# Streaming Implementation
# ==================================================
def stream_completion(ui_id: str, messages: List[Dict[str, str]]) -> Iterator[str]:
    model_info = resolve_model(ui_id)
    provider = model_info["provider"]
    real_id = model_info["real_id"]

    try:
        if provider == "groq":
            client = _get_groq()
            response = client.chat.completions.create(model=real_id, messages=messages, temperature=0.7, max_tokens=4000, stream=True)
            for chunk in response:
                content = getattr(chunk.choices[0].delta, "content", None)
                if content: yield content

        elif provider == "openai":
            client = _get_openai()
            response = client.chat.completions.create(model=real_id, messages=messages, temperature=0.7, max_tokens=4000, stream=True)
            for chunk in response:
                content = getattr(chunk.choices[0].delta, "content", None)
                if content: yield content

        elif provider == "anthropic":
            client = _get_anthropic()
            system_msg = "\n\n".join([m["content"] for m in messages if m["role"] == "system"])
            chat_messages = [m for m in messages if m["role"] != "system"]
            with client.messages.stream(model=real_id, system=system_msg.strip() or None, messages=chat_messages, max_tokens=4000, temperature=0.7) as stream:
                for text in stream.text_stream: yield text

        elif provider == "google":
            client = _get_google()
            gemini_history = []
            system_msg = ""
            for m in messages:
                if m["role"] == "system": system_msg += m["content"] + "\n\n"
                elif m["role"] == "user": gemini_history.append({"role": "user", "parts": [{"text": m["content"]}]})
                elif m["role"] == "assistant": gemini_history.append({"role": "model", "parts": [{"text": m["content"]}]})
            
            if system_msg and gemini_history:
                gemini_history[0]["parts"][0]["text"] = system_msg + "\n\n" + gemini_history[0]["parts"][0]["text"]

            # Wrap the API call in our retry function
            def _generate():
                return client.models.generate_content_stream(
                    model=real_id,
                    contents=gemini_history,
                )

            response = _retry_with_backoff(_generate)

            for chunk in response:
                if chunk.text: yield chunk.text

    except Exception as e:
        yield f"\n\n[Error: {e}]"


def generate_completion(ui_id: str, messages: List[Dict[str, str]], max_tokens: int = 100) -> str:
    model_info = resolve_model(ui_id)
    provider = model_info["provider"]
    real_id = model_info["real_id"]

    if provider == "groq":
        res = _get_groq().chat.completions.create(model=real_id, messages=messages, max_tokens=max_tokens)
        return res.choices[0].message.content.strip()
    elif provider == "openai":
        res = _get_openai().chat.completions.create(model=real_id, messages=messages, max_tokens=max_tokens)
        return res.choices[0].message.content.strip()
    elif provider == "anthropic":
        system_msg = "\n\n".join([m["content"] for m in messages if m["role"] == "system"])
        chat_messages = [m for m in messages if m["role"] != "system"]
        res = _get_anthropic().messages.create(model=real_id, system=system_msg or None, messages=chat_messages, max_tokens=max_tokens)
        return res.content[0].text.strip()
    elif provider == "google":
        client = _get_google()
        prompt = "\n".join([m["content"] for m in messages])
        
        def _generate():
            return client.models.generate_content(model=real_id, contents=prompt)
        
        res = _retry_with_backoff(_generate)
        return res.text.strip()
    raise ValueError(f"Unknown provider {provider}")