"""
RAG service — chunking, embeddings, retrieval.
Uses fastembed (BAAI/bge-small-en-v1.5) for embeddings.
"""

import re
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import models

# ---------- Embedding model (lazy loaded) ----------
_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from fastembed import TextEmbedding
        _embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedder


def _to_python_floats(vec) -> List[float]:
    """Convert a numpy array / list of numpy scalars to pure Python floats."""
    out = []
    for v in vec:
        try:
            out.append(float(v))
        except Exception:
            out.append(0.0)
    return out


def _embed(texts: List[str]) -> List[List[float]]:
    """Embed a batch of texts → list of pure-Python float lists."""
    if not texts:
        return []
    embedder = _get_embedder()
    raw = list(embedder.embed(texts))
    return [_to_python_floats(vec) for vec in raw]


# ---------- Chunking ----------
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
MIN_CHUNK_SIZE = 100


def _split_into_chunks(text: str) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []

    paragraphs = re.split(r"\n\s*\n", text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks: List[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= CHUNK_SIZE:
            current = (current + "\n\n" + para).strip() if current else para
        else:
            if len(current) >= MIN_CHUNK_SIZE:
                chunks.append(current)
            elif current:
                para = current + "\n\n" + para

            if len(para) > CHUNK_SIZE:
                sentences = re.split(r"(?<=[.!?])\s+", para)
                sub = ""
                for s in sentences:
                    if len(sub) + len(s) + 1 <= CHUNK_SIZE:
                        sub = (sub + " " + s).strip() if sub else s
                    else:
                        if len(sub) >= MIN_CHUNK_SIZE:
                            chunks.append(sub)
                        if chunks:
                            tail = chunks[-1][-CHUNK_OVERLAP:]
                            sub = (tail + " " + s).strip()
                        else:
                            sub = s
                current = sub
            else:
                current = para

    if current and len(current) >= MIN_CHUNK_SIZE:
        chunks.append(current)

    if not chunks and text:
        chunks = [text[:CHUNK_SIZE]]

    return chunks


# ==================================================
# Public API
# ==================================================
def store_document_chunks(
    attachment: "models.ChatAttachment",
    text: str,
    db: Session,
) -> int:
    """Chunk, embed, and store. Returns number of chunks."""
    text = (text or "").strip()
    if not text:
        return 0

    chunks = _split_into_chunks(text)
    if not chunks:
        return 0

    embeddings = _embed(chunks)

    for i, (chunk_text, emb) in enumerate(zip(chunks, embeddings)):
        # emb is already a list of Python floats
        row = models.DocumentChunk(
            attachment_id=attachment.id,
            chunk_index=i,
            content=chunk_text,
            embedding=emb,
        )
        db.add(row)

    db.commit()
    return len(chunks)


def retrieve_relevant_chunks(
    conversation_id: int,
    query: str,
    top_k: int = 4,
    db: Session = None,
) -> List[Dict[str, Any]]:
    if not query.strip() or db is None:
        return []

    attachments = (
        db.query(models.ChatAttachment)
        .filter(models.ChatAttachment.conversation_id == conversation_id)
        .all()
    )
    if not attachments:
        return []

    attachment_ids = [a.id for a in attachments]

    chunks = (
        db.query(models.DocumentChunk)
        .filter(models.DocumentChunk.attachment_id.in_(attachment_ids))
        .all()
    )
    if not chunks:
        return []

    query_vec = _embed([query])[0]

    def cosine(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)

    scored = []
    for c in chunks:
        if not c.embedding:
            continue
        try:
            emb = [float(x) for x in c.embedding]
        except Exception:
            continue
        score = cosine(query_vec, emb)
        scored.append((score, c))

    scored.sort(key=lambda x: -x[0])

    filename_map = {a.id: a.filename for a in attachments}

    results = []
    for score, c in scored[:top_k]:
        results.append({
            "attachment_id": c.attachment_id,
            "filename": filename_map.get(c.attachment_id, "document"),
            "chunk_index": c.chunk_index,
            "content": c.content,
            "score": round(float(score), 4),
        })

    return results


def build_context_block(chunks: List[Dict[str, Any]]) -> str:
    if not chunks:
        return ""

    lines = [
        "═══════════════════════════════════════════",
        "REFERENCE MATERIAL FROM USER'S UPLOADED FILES",
        "═══════════════════════════════════════════",
        "",
    ]
    for i, c in enumerate(chunks, 1):
        lines.append(f"[Source {i}: {c['filename']}, chunk {c['chunk_index']}]")
        lines.append(c["content"])
        lines.append("")

    lines.append("═══════════════════════════════════════════")
    lines.append(
        "Use ONLY the reference material above to answer the user's question. "
        "If the answer isn't in the material, say so honestly. "
        "Cite sources as [Source 1], [Source 2], etc."
    )

    return "\n".join(lines)