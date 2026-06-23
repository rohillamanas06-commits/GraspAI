"""
StudyAgent Backend — FastAPI v3
Auth + Dashboard + Study Agent Pipeline

Auth:        JWT (access 30min) + refresh tokens (7 days), bcrypt passwords
Dashboard:   streak, confidence per topic, predicted readiness, velocity analytics
Agent:       PDF -> plan -> NLP flashcards -> feedback -> adaptive plan

Gemini used for: syllabus parsing, plan generation, plan adaptation only.
Flashcards: rule-based NLP (nltk), zero API calls.
"""

import os
import io
import re
import json
import time
import random
import asyncio
import zipfile
import hashlib
import secrets
import tempfile
import pdfplumber
import genanki
import nltk
import psycopg2
import psycopg2.extras

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr

from jose import JWTError, jwt
import bcrypt
from google import genai
import groq
from dotenv import load_dotenv

# Download nltk data on first run (uses PyPI mirror, no GitHub)
for _pkg in ("punkt", "punkt_tab", "stopwords"):
    nltk.download(_pkg, quiet=True)

from nltk.tokenize import sent_tokenize
from nltk.corpus import stopwords

load_dotenv()

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)
GEMINI_MODEL = "gemini-2.5-flash"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = groq.Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
GROQ_MODEL = "llama-3.3-70b-versatile"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env  (e.g. postgresql://user:pass@host/db?sslmode=require)")

# ── JWT / Auth config ──────────────────────────────────────────────────────────
JWT_SECRET       = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES  = 30
REFRESH_TOKEN_EXPIRE_DAYS    = 7

# passlib removed for bcrypt compatibility
bearer_scheme = HTTPBearer()

# ─────────────────────────────────────────────
# DATABASE — PostgreSQL (Neon)
# ─────────────────────────────────────────────

def get_db():
    """
    Yield a psycopg2 connection per request.
    RealDictCursor makes rows behave like dicts (same as sqlite3.Row).
    """
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist. Safe to call on every startup."""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # ── Users ──────────────────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            TEXT PRIMARY KEY,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name     TEXT,
            created_at    TEXT NOT NULL,
            last_login    TEXT,
            streak_days   INTEGER DEFAULT 0,
            last_studied  TEXT
        );
    """)

    # ── Refresh tokens (blacklist-capable) ────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            token         TEXT PRIMARY KEY,
            user_id       TEXT NOT NULL,
            expires_at    TEXT NOT NULL,
            revoked       BOOLEAN DEFAULT FALSE
        );
    """)

    # ── Sessions (now user-owned) ─────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id              TEXT PRIMARY KEY,
            user_id         TEXT NOT NULL,
            session_name    TEXT,
            created_at      TEXT NOT NULL,
            syllabus_raw    TEXT,
            topics_json     TEXT,
            plan_json       TEXT,
            flashcards_json TEXT,
            plan_version    INTEGER DEFAULT 1,
            exam_date       TEXT
        );
    """)

    # ── Card feedback ─────────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS card_feedback (
            id          SERIAL PRIMARY KEY,
            session_id  TEXT NOT NULL,
            user_id     TEXT NOT NULL,
            card_key    TEXT NOT NULL UNIQUE,
            topic       TEXT NOT NULL,
            question    TEXT NOT NULL,
            answer      TEXT NOT NULL,
            difficulty  TEXT NOT NULL,
            feedback    TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );
    """)

    # ── Study events (for velocity analytics) ────────────────────────────────
    # One row each time a review-queue fetch or feedback submit happens.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS study_events (
            id          SERIAL PRIMARY KEY,
            user_id     TEXT NOT NULL,
            session_id  TEXT NOT NULL,
            event_type  TEXT NOT NULL,   -- 'review' | 'feedback' | 'plan_adapt'
            cards_count INTEGER DEFAULT 0,
            created_at  TEXT NOT NULL
        );
    """)

    conn.commit()
    cur.close()
    conn.close()


# ─────────────────────────────────────────────
# LIFESPAN
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────

app = FastAPI(
    title="StudyAgent API",
    description="Auth + Dashboard + Syllabus → Study Plan → Flashcards (NLP) → Feedback → Adapt",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────

class Subtopic(BaseModel):
    name: str
    weightage: Optional[str] = "medium"

class Topic(BaseModel):
    subject: str
    name: str
    subtopics: list[Subtopic] = []
    difficulty: Optional[str] = "medium"

class SyllabusResponse(BaseModel):
    session_id: str
    topics: list[Topic]
    total_topics: int

class StudyPlanRequest(BaseModel):
    session_id: str
    exam_date: date
    daily_hours: float = Field(gt=0, le=16)
    weak_subjects: list[str] = []

class DayPlan(BaseModel):
    day: int
    date: str
    topics: list[str]
    estimated_hours: float
    is_revision: bool = False

class StudyPlanResponse(BaseModel):
    session_id: str
    total_days: int
    plan: list[DayPlan]

class FlashcardRequest(BaseModel):
    session_id: str
    cards_per_topic: int = Field(default=3, ge=3, le=15)

class Flashcard(BaseModel):
    topic: str
    question: str
    answer: str
    difficulty: str
    next_review_day: int

class FlashcardDeck(BaseModel):
    topic: str
    cards: list[Flashcard]

class FlashcardsResponse(BaseModel):
    session_id: str
    total_cards: int
    decks: list[FlashcardDeck]

class ExportRequest(BaseModel):
    session_id: str

# ── Feedback Loop Models ──────────────────────────────────────────────────────

VALID_FEEDBACK = {"too_easy", "too_hard", "skip"}

class CardFeedbackItem(BaseModel):
    topic: str
    question: str
    answer: str
    difficulty: str
    feedback: str

    def validate_feedback(self):
        if self.feedback not in VALID_FEEDBACK:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid feedback '{self.feedback}'. Must be one of: {VALID_FEEDBACK}"
            )

class FeedbackRequest(BaseModel):
    session_id: str
    cards: list[CardFeedbackItem]

class FeedbackSummary(BaseModel):
    session_id: str
    total_feedback: int
    too_easy_count: int
    too_hard_count: int
    skip_count: int
    affected_topics: list[str]

class AdaptPlanRequest(BaseModel):
    session_id: str
    gemini_api_key: Optional[str] = Field(
        default=None,
        description="Your own Gemini API key (optional, uses server key if not provided)."
    )

class AdaptPlanResponse(BaseModel):
    session_id: str
    plan_version: int
    total_days: int
    plan: list[DayPlan]
    changes_summary: str

# ── Auth Models ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")
    full_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60

class RefreshRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    created_at: str
    streak_days: int
    last_login: Optional[str]

# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# HELPERS — GENERAL
# ─────────────────────────────────────────────

def generate_session_id() -> str:
    return f"sa_{int(time.time())}_{random.randint(1000, 9999)}"


def make_card_key(session_id: str, topic: str, question: str) -> str:
    q_hash = hashlib.md5(question.encode()).hexdigest()[:8]
    return f"{session_id}:{topic}:{q_hash}"


def srs_next_review(difficulty: str) -> int:
    return {"easy": 7, "medium": 3, "hard": 1}.get(difficulty.lower(), 3)


def srs_with_feedback(difficulty: str, feedback: Optional[str]) -> int:
    base = srs_next_review(difficulty)
    if feedback == "too_easy":
        return base * 2
    if feedback == "too_hard":
        return 1
    if feedback == "skip":
        return 2
    return base


# ─────────────────────────────────────────────
# HELPERS — AUTH
# ─────────────────────────────────────────────

def generate_user_id() -> str:
    # Use purely numeric IDs so it works safely with your existing INTEGER database column!
    return str(random.randint(10000000, 2147483647))


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        # Fallback in case of legacy plaintext passwords or invalid hashes in DB
        return plain == hashed


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "access"},
        JWT_SECRET, algorithm=JWT_ALGORITHM
    )


def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def decode_access_token(token: str) -> str:
    """Decode JWT and return user_id. Raises HTTPException on invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type.")
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing subject.")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=Depends(get_db)
) -> dict:
    """FastAPI dependency — validates JWT and returns the user row."""
    user_id = decode_access_token(credentials.credentials)
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    cur.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    user_dict = dict(user)
    user_dict["id"] = str(user_dict["id"])
    return user_dict


def get_session_for_user(conn, session_id: str, user_id: str) -> dict:
    """Like get_session() but also enforces ownership."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    row = dict(row)
    if str(row.get("user_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="Access denied — not your session.")
    return row


def log_study_event(conn, user_id: str, session_id: str, event_type: str, cards_count: int = 0):
    """Insert a study_events row for analytics tracking."""
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO study_events (user_id, session_id, event_type, cards_count, created_at) "
        "VALUES (%s, %s, %s, %s, %s)",
        (user_id, session_id, event_type, cards_count, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    cur.close()


def update_streak(conn, user_id: str):
    """Update streak_days and last_studied. Call after any study event."""
    today = date.today().isoformat()
    cur = conn.cursor()
    cur.execute("SELECT streak_days, last_studied FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        return
    row = dict(row)
    last = row.get("last_studied")
    streak = row.get("streak_days") or 0

    if last == today:
        cur.close()
        return  # already updated today
    elif last == (date.today() - timedelta(days=1)).isoformat():
        streak += 1  # consecutive day
    else:
        streak = 1   # streak broken, restart

    cur.execute(
        "UPDATE users SET streak_days = %s, last_studied = %s WHERE id = %s",
        (streak, today, user_id)
    )
    conn.commit()
    cur.close()


# ─────────────────────────────────────────────
# HELPERS — POSTGRES
# ─────────────────────────────────────────────

def save_session_field(conn, session_id: str, field: str, value: str):
    """Update a single column in the sessions table."""
    # field is never user-supplied so f-string interpolation is safe here
    cur = conn.cursor()
    cur.execute(
        f"UPDATE sessions SET {field} = %s WHERE id = %s",
        (value, session_id)
    )
    conn.commit()
    cur.close()


def get_session(conn, session_id: str) -> dict:
    """Base session lookup — no ownership enforcement. Use get_session_for_user in endpoints."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return dict(row)


# ─────────────────────────────────────────────
# HELPERS — GEMINI (syllabus + plan + adapt only)
# ─────────────────────────────────────────────

def call_llm_json(prompt: str, api_key: Optional[str] = None) -> dict:
    """Synchronous LLM call that returns parsed JSON. Tries Gemini first, falls back to Groq."""
    used_client = genai.Client(api_key=api_key) if api_key else client
    full_prompt = (
        "You are a JSON-only API. Return ONLY valid JSON. "
        "No markdown, no backticks, no explanation.\n\n" + prompt
    )
    
    try:
        response = used_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=full_prompt,
        )
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e_gemini:
        print(f"[Warning] Gemini API failed ({e_gemini}). Falling back to Groq...")
        if not groq_client:
            if isinstance(e_gemini, genai.errors.APIError) and ("429" in str(e_gemini) or "RESOURCE_EXHAUSTED" in str(e_gemini)):
                raise HTTPException(status_code=429, detail="Free AI quota exceeded. Groq fallback unavailable. Wait a minute and try again.")
            raise HTTPException(status_code=500, detail=f"Gemini API Error and no Groq fallback: {e_gemini}")
            
        try:
            chat_completion = groq_client.chat.completions.create(
                messages=[{"role": "user", "content": full_prompt}],
                model=GROQ_MODEL,
                response_format={"type": "json_object"},
            )
            text = chat_completion.choices[0].message.content.strip()
            return json.loads(text)
        except Exception as e_groq:
            print(f"[Error] Groq fallback also failed: {e_groq}")
            raise HTTPException(status_code=500, detail=f"Both Gemini and Groq failed. Groq error: {e_groq}")


# ─────────────────────────────────────────────
# HELPERS — NLP FLASHCARD ENGINE (no API)
# ─────────────────────────────────────────────

_STOP_WORDS = set(stopwords.words("english"))

# Question templates: (pattern, question_fn, difficulty)
# Each pattern is matched against a sentence to see if it's a candidate.
_DEFINITION_PATTERNS = [
    r"\bis\s+(a|an|the)\b",
    r"\bare\s+(a|an|the|used|defined|known)\b",
    r"\bdefin",
    r"\brefer(s)?\s+to\b",
    r"\bcalled\b",
    r"\bknown\s+as\b",
    r"\bmeans?\b",
]

_PROCESS_PATTERNS = [
    r"\bprocess",
    r"\bstep",
    r"\bphase",
    r"\bstage",
    r"\bsequence",
    r"\bfirst\b.{0,60}\bthen\b",
    r"\bbegin",
]

_CAUSE_EFFECT_PATTERNS = [
    r"\bbecause\b",
    r"\btherefore\b",
    r"\bthus\b",
    r"\bresult(s)?\s+in\b",
    r"\bcaus(e|es|ed)\b",
    r"\bleads?\s+to\b",
    r"\bdue\s+to\b",
]

_PROPERTY_PATTERNS = [
    r"\bcharacteriz",
    r"\bproperti",
    r"\bfeature",
    r"\badvantage",
    r"\bdisadvantage",
    r"\btype(s)?\s+of\b",
    r"\bkind(s)?\s+of\b",
    r"\bexample",
]


def _matches_any(sentence: str, patterns: list[str]) -> bool:
    s = sentence.lower()
    return any(re.search(p, s) for p in patterns)


def _score_sentence(sentence: str, topic_keywords: list[str]) -> int:
    """Score how relevant a sentence is to the topic keywords."""
    s_lower = sentence.lower()
    score = sum(1 for kw in topic_keywords if kw in s_lower)
    # Penalise very short or very long sentences
    word_count = len(sentence.split())
    if word_count < 5 or word_count > 60:
        score -= 1
    return score


def _extract_topic_keywords(topic_name: str, subtopics: list[str]) -> list[str]:
    """Build a keyword list from topic name + subtopics for sentence matching."""
    raw = (topic_name + " " + " ".join(subtopics)).lower()
    words = re.findall(r"[a-z]+", raw)
    keywords = [w for w in words if w not in _STOP_WORDS and len(w) > 2]
    # Also add full topic name as a phrase
    keywords.append(topic_name.lower())
    return list(dict.fromkeys(keywords))  # deduplicate, preserve order


def _build_question_answer(sentence: str, topic_name: str) -> Optional[tuple[str, str, str]]:
    """
    Given a candidate sentence, produce (question, answer, difficulty).
    Returns None if no good question type matches.
    """
    s = sentence.strip()
    if len(s) < 15:
        return None

    # Definition question — "What is X?" → answer is the sentence
    if _matches_any(s, _DEFINITION_PATTERNS):
        # Try to extract the subject (first noun phrase) for the question
        q = f"What is meant by '{topic_name}'?"
        # Check if sentence actually contains the topic word; if so make more specific
        if topic_name.lower().split()[0] in s.lower():
            q = f"How is '{topic_name}' defined or described?"
        return (q, s, "easy")

    # Cause/effect — "Why does X happen?"
    if _matches_any(s, _CAUSE_EFFECT_PATTERNS):
        q = f"Why or how does '{topic_name}' relate to the following statement: what does it cause or result in?"
        return (q, s, "hard")

    # Process / steps
    if _matches_any(s, _PROCESS_PATTERNS):
        q = f"Describe a key step or process involved in '{topic_name}'."
        return (q, s, "medium")

    # Property / feature
    if _matches_any(s, _PROPERTY_PATTERNS):
        q = f"What is a key property, feature, or type associated with '{topic_name}'?"
        return (q, s, "medium")

    # Generic fallback — use sentence as a fill-in-the-blank
    # Find the most "interesting" noun phrase to blank out
    words = s.split()
    if len(words) < 6:
        return None
    # Blank a content word near the middle of the sentence
    mid = len(words) // 2
    candidates = [
        (i, w) for i, w in enumerate(words)
        if i > 0 and len(w) > 3 and w.lower() not in _STOP_WORDS
        and abs(i - mid) < len(words) // 3
    ]
    if not candidates:
        return None
    idx, word = candidates[0]
    blanked = words[:]
    blanked[idx] = "________"
    q = "Fill in the blank: " + " ".join(blanked)
    return (q, f"The missing word is: {word}. Full sentence: {s}", "medium")


def generate_flashcards_nlp(
    topic: dict,
    syllabus_raw: str,
    cards_per_topic: int,
) -> list[Flashcard]:
    """
    Rule-based NLP flashcard generator.

    Strategy:
    1. Sentence-tokenise the full syllabus text.
    2. Score each sentence for relevance to this topic using keyword overlap.
    3. Apply question templates to the top-scoring sentences.
    4. Fall back to subtopic-name cards if not enough sentences found.
    5. Deduplicate and cap at cards_per_topic.
    """
    topic_name = topic.get("name", "Unknown Topic")
    subtopics = [s.get("name", "") for s in topic.get("subtopics", [])]
    base_difficulty = topic.get("difficulty", "medium")

    keywords = _extract_topic_keywords(topic_name, subtopics)

    # Sentence tokenisation
    try:
        sentences = sent_tokenize(syllabus_raw)
    except Exception:
        sentences = re.split(r"(?<=[.!?])\s+", syllabus_raw)

    # Score and filter sentences
    scored = []
    for sent in sentences:
        score = _score_sentence(sent, keywords)
        if score > 0:
            scored.append((score, sent))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_sentences = [s for _, s in scored[:cards_per_topic * 3]]  # over-fetch, then filter

    # Build Q&A cards from sentences
    cards: list[Flashcard] = []
    seen_questions: set[str] = set()

    for sent in top_sentences:
        if len(cards) >= cards_per_topic:
            break
        result = _build_question_answer(sent, topic_name)
        if result is None:
            continue
        question, answer, difficulty = result
        if question in seen_questions:
            continue
        seen_questions.add(question)
        cards.append(Flashcard(
            topic=topic_name,
            question=question,
            answer=answer,
            difficulty=difficulty,
            next_review_day=srs_next_review(difficulty),
        ))

    # ── Subtopic cards: guaranteed coverage even if sentences are sparse ──
    for i, subtopic_name in enumerate(subtopics):
        if len(cards) >= cards_per_topic:
            break
        q = f"What is '{subtopic_name}' in the context of '{topic_name}'?"
        if q in seen_questions:
            continue
        seen_questions.add(q)
        diff = "easy" if i % 3 == 0 else ("medium" if i % 3 == 1 else "hard")
        cards.append(Flashcard(
            topic=topic_name,
            question=q,
            answer=f"'{subtopic_name}' is a key subtopic under '{topic_name}'. Review your notes for a detailed explanation.",
            difficulty=diff,
            next_review_day=srs_next_review(diff),
        ))

    # ── Fallback: topic-name template cards ──
    template_cards = [
        (f"What is the main concept of '{topic_name}'?",
         f"'{topic_name}' is a core topic in this subject. Refer to your study material for the full definition.",
         "easy"),
        (f"Why is '{topic_name}' important to understand?",
         f"Understanding '{topic_name}' is essential because it forms the foundation of related concepts in this subject.",
         "medium"),
        (f"What are the key points to remember about '{topic_name}'?",
         f"Key points for '{topic_name}': {', '.join(subtopics) if subtopics else 'Review all core concepts.'}",
         base_difficulty),
    ]
    for q, a, diff in template_cards:
        if len(cards) >= cards_per_topic:
            break
        if q not in seen_questions:
            seen_questions.add(q)
            cards.append(Flashcard(
                topic=topic_name,
                question=q,
                answer=a,
                difficulty=diff,
                next_review_day=srs_next_review(diff),
            ))

    return cards[:cards_per_topic]


# ─────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────

@app.post("/api/auth/register", response_model=TokenResponse, tags=["Auth"])
def register(req: RegisterRequest, db=Depends(get_db)):
    """
    Create a new account. Returns access + refresh tokens immediately.
    Password must be at least 8 characters.
    """
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    if cur.fetchone():
        cur.close()
        raise HTTPException(status_code=409, detail="Email already registered.")

    user_id = generate_user_id()
    now = datetime.now(timezone.utc).isoformat()
    cur.execute(
        "INSERT INTO users (id, email, password_hash, full_name, created_at) VALUES (%s, %s, %s, %s, %s)",
        (user_id, req.email, hash_password(req.password), req.full_name, now)
    )

    access_token   = create_access_token(user_id)
    refresh_token  = create_refresh_token()
    refresh_expiry = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    cur.execute(
        "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (%s, %s, %s)",
        (refresh_token, user_id, refresh_expiry)
    )
    db.commit()
    cur.close()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@app.post("/api/auth/login", response_model=TokenResponse, tags=["Auth"])
def login(req: LoginRequest, db=Depends(get_db)):
    """Login with email + password. Returns access + refresh tokens."""
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (req.email,))
    user = cur.fetchone()

    if not user or not verify_password(req.password, dict(user)["password_hash"]):
        cur.close()
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user = dict(user)
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("UPDATE users SET last_login = %s WHERE id = %s", (now, user["id"]))

    access_token  = create_access_token(str(user["id"]))
    refresh_token = create_refresh_token()
    refresh_expiry = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    cur.execute(
        "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (%s, %s, %s)",
        (refresh_token, str(user["id"]), refresh_expiry)
    )
    db.commit()
    cur.close()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@app.post("/api/auth/refresh", response_model=TokenResponse, tags=["Auth"])
def refresh_token_endpoint(req: RefreshRequest, db=Depends(get_db)):
    """
    Exchange a valid refresh token for a new access token + new refresh token.
    The old refresh token is revoked (rotation).
    """
    cur = db.cursor()
    cur.execute("SELECT * FROM refresh_tokens WHERE token = %s", (req.refresh_token,))
    row = cur.fetchone()

    if not row:
        cur.close()
        raise HTTPException(status_code=401, detail="Refresh token not found.")

    row = dict(row)
    if row["revoked"]:
        cur.close()
        raise HTTPException(status_code=401, detail="Refresh token has been revoked.")
    if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        cur.close()
        raise HTTPException(status_code=401, detail="Refresh token expired. Please log in again.")

    # Rotate: revoke old, issue new
    cur.execute("UPDATE refresh_tokens SET revoked = TRUE WHERE token = %s", (req.refresh_token,))

    new_access  = create_access_token(row["user_id"])
    new_refresh = create_refresh_token()
    new_expiry  = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    cur.execute(
        "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (%s, %s, %s)",
        (new_refresh, row["user_id"], new_expiry)
    )
    db.commit()
    cur.close()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@app.post("/api/auth/logout", tags=["Auth"])
def logout(req: RefreshRequest, db=Depends(get_db)):
    """Revoke a refresh token. Call on sign-out."""
    cur = db.cursor()
    cur.execute("UPDATE refresh_tokens SET revoked = TRUE WHERE token = %s", (req.refresh_token,))
    db.commit()
    cur.close()
    return {"message": "Logged out successfully."}


@app.get("/api/auth/me", response_model=UserOut, tags=["Auth"])
def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    # Ensure types match Pydantic schema even if DB stores them as int/datetime
    return UserOut(
        id=str(current_user["id"]),
        email=current_user["email"],
        full_name=current_user.get("full_name") or current_user.get("name"),
        created_at=str(current_user["created_at"]),
        streak_days=int(current_user.get("streak_days") or 0),
        last_login=str(current_user.get("last_login")) if current_user.get("last_login") else None,
    )


# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────

@app.get("/api/dashboard", tags=["Dashboard"])
def get_dashboard(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """
    Full dashboard for the authenticated user.

    Returns:
    - Profile + streak
    - All sessions with phase status, topic count, card count, confidence
    - Predicted readiness per session (0-100)
    - Study velocity — cards reviewed per day, last 7 days
    - Aggregate stats: total cards, total sessions, topics mastered
    """
    user_id = current_user["id"]
    cur = db.cursor()

    # ── All sessions ──────────────────────────────────────────────────────────
    cur.execute(
        "SELECT * FROM sessions WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,)
    )
    sessions_raw = [dict(r) for r in cur.fetchall()]

    # ── All feedback for this user ────────────────────────────────────────────
    cur.execute(
        "SELECT session_id, topic, feedback FROM card_feedback WHERE user_id = %s",
        (user_id,)
    )
    all_feedback = cur.fetchall()

    # Build per-session feedback maps
    fb_by_session: dict = {}
    for fb in all_feedback:
        sid = fb["session_id"]
        if sid not in fb_by_session:
            fb_by_session[sid] = []
        fb_by_session[sid].append(dict(fb))

    # ── Study events for velocity (last 7 days) ───────────────────────────────
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    cur.execute(
        "SELECT created_at, cards_count FROM study_events "
        "WHERE user_id = %s AND created_at >= %s ORDER BY created_at",
        (user_id, seven_days_ago)
    )
    events = [dict(r) for r in cur.fetchall()]
    cur.close()

    # ── Build per-session analytics ───────────────────────────────────────────
    session_summaries = []
    total_cards_all = 0
    total_topics_mastered = 0

    for s in sessions_raw:
        sid = s["id"]
        topics = json.loads(s["topics_json"]) if s.get("topics_json") else []
        flashcards = json.loads(s["flashcards_json"]) if s.get("flashcards_json") else []
        plan = json.loads(s["plan_json"]) if s.get("plan_json") else []
        fb_list = fb_by_session.get(sid, [])

        # Feedback breakdown per topic
        topic_confidence: dict = {}
        for topic_data in topics:
            tname = topic_data.get("name", "")
            t_fb = [f for f in fb_list if f["topic"] == tname]
            easy  = sum(1 for f in t_fb if f["feedback"] == "too_easy")
            hard  = sum(1 for f in t_fb if f["feedback"] == "too_hard")
            total_fb = easy + hard
            if total_fb == 0:
                confidence = None  # not yet reviewed
            else:
                confidence = round((easy / total_fb) * 100)
            topic_confidence[tname] = {
                "confidence": confidence,
                "too_easy": easy,
                "too_hard": hard,
                "skip": sum(1 for f in t_fb if f["feedback"] == "skip"),
                "reviewed": len(t_fb) > 0,
            }

        # Predicted readiness: average confidence across reviewed topics
        reviewed = [v["confidence"] for v in topic_confidence.values() if v["confidence"] is not None]
        if reviewed:
            raw_readiness = sum(reviewed) / len(reviewed)
            # Weight down if fewer than 50% of topics reviewed
            coverage = len(reviewed) / max(len(topics), 1)
            predicted_readiness = round(raw_readiness * min(coverage * 2, 1))
        else:
            predicted_readiness = None

        # Topics mastered = confidence >= 75
        mastered = sum(1 for v in topic_confidence.values() if (v["confidence"] or 0) >= 75)
        total_topics_mastered += mastered
        total_cards_all += len(flashcards)

        session_summaries.append({
            "session_id": sid,
            "session_name": s.get("session_name") or f"Session {sid[-6:]}",
            "created_at": s["created_at"],
            "exam_date": s.get("exam_date"),
            "plan_version": s.get("plan_version") or 1,
            "phases": {
                "syllabus_uploaded": bool(s.get("topics_json")),
                "plan_generated": bool(s.get("plan_json")),
                "flashcards_generated": bool(s.get("flashcards_json")),
                "feedback_submitted": len(fb_list) > 0,
                "plan_adapted": (s.get("plan_version") or 1) > 1,
            },
            "stats": {
                "total_topics": len(topics),
                "total_cards": len(flashcards),
                "topics_reviewed": len([v for v in topic_confidence.values() if v["reviewed"]]),
                "topics_mastered": mastered,
                "cards_with_feedback": len(fb_list),
                "plan_days": len(plan),
            },
            "topic_confidence": topic_confidence,
            "predicted_readiness": predicted_readiness,
        })

    # ── Velocity: cards reviewed per day (last 7 days) ───────────────────────
    velocity_by_day: dict = {}
    for ev in events:
        day = str(ev["created_at"])[:10]  # YYYY-MM-DD
        velocity_by_day[day] = velocity_by_day.get(day, 0) + ev["cards_count"]

    # Fill in zeros for days with no activity
    velocity_chart = []
    for i in range(7):
        d = (date.today() - timedelta(days=6 - i)).isoformat()
        velocity_chart.append({"date": d, "cards": velocity_by_day.get(d, 0)})

    total_cards_this_week = sum(v["cards"] for v in velocity_chart)

    return {
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "full_name": current_user.get("full_name"),
            "streak_days": current_user.get("streak_days") or 0,
            "last_studied": current_user.get("last_studied"),
            "member_since": str(current_user["created_at"])[:10],
        },
        "aggregate": {
            "total_sessions": len(sessions_raw),
            "total_cards": total_cards_all,
            "total_topics_mastered": total_topics_mastered,
            "cards_this_week": total_cards_this_week,
            "streak_days": current_user.get("streak_days") or 0,
        },
        "velocity_chart": velocity_chart,
        "sessions": session_summaries,
    }


@app.get("/api/dashboard/session/{session_id}", tags=["Dashboard"])
def get_session_dashboard(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Deep analytics for a single session.
    Returns topic-level confidence, card breakdown, SRS distribution,
    plan version history count, and readiness trend.
    """
    user_id = current_user["id"]
    row = get_session_for_user(db, session_id, user_id)

    topics      = json.loads(row["topics_json"]) if row.get("topics_json") else []
    flashcards  = json.loads(row["flashcards_json"]) if row.get("flashcards_json") else []
    plan        = json.loads(row["plan_json"]) if row.get("plan_json") else []

    cur = db.cursor()
    cur.execute(
        "SELECT * FROM card_feedback WHERE session_id = %s ORDER BY created_at",
        (session_id,)
    )
    fb_rows = [dict(r) for r in cur.fetchall()]
    cur.close()

    # SRS distribution
    srs_dist = {"easy": 0, "medium": 0, "hard": 0}
    for c in flashcards:
        d = c.get("difficulty", "medium").lower()
        srs_dist[d] = srs_dist.get(d, 0) + 1

    # Feedback distribution
    fb_dist = {"too_easy": 0, "too_hard": 0, "skip": 0}
    for f in fb_rows:
        fb_dist[f["feedback"]] = fb_dist.get(f["feedback"], 0) + 1

    # Per-topic breakdown
    topic_detail = []
    for t in topics:
        tname = t.get("name", "")
        t_cards = [c for c in flashcards if c.get("topic") == tname]
        t_fb    = [f for f in fb_rows if f["topic"] == tname]
        easy  = sum(1 for f in t_fb if f["feedback"] == "too_easy")
        hard  = sum(1 for f in t_fb if f["feedback"] == "too_hard")
        skip  = sum(1 for f in t_fb if f["feedback"] == "skip")
        total_fb = easy + hard
        confidence = round((easy / total_fb) * 100) if total_fb else None
        topic_detail.append({
            "name": tname,
            "subject": t.get("subject"),
            "difficulty": t.get("difficulty"),
            "cards": len(t_cards),
            "feedback_count": len(t_fb),
            "too_easy": easy,
            "too_hard": hard,
            "skip": skip,
            "confidence": confidence,
            "mastered": (confidence or 0) >= 75,
        })

    # Study days remaining
    days_remaining = None
    if row.get("exam_date"):
        try:
            exam = date.fromisoformat(row["exam_date"])
            days_remaining = (exam - date.today()).days
        except Exception:
            pass

    return {
        "session_id": session_id,
        "session_name": row.get("session_name") or f"Session {session_id[-6:]}",
        "created_at": row["created_at"],
        "exam_date": row.get("exam_date"),
        "days_remaining": days_remaining,
        "plan_version": row.get("plan_version") or 1,
        "phases": {
            "syllabus_uploaded": bool(row.get("topics_json")),
            "plan_generated": bool(row.get("plan_json")),
            "flashcards_generated": bool(row.get("flashcards_json")),
            "feedback_submitted": len(fb_rows) > 0,
            "plan_adapted": (row.get("plan_version") or 1) > 1,
        },
        "srs_distribution": srs_dist,
        "feedback_distribution": fb_dist,
        "plan_days": len(plan),
        "topics": topic_detail,
    }


class SessionNameRequest(BaseModel):
    session_name: str

@app.put("/api/sessions/{session_id}/name", tags=["Dashboard"])
def update_session_name(session_id: str, req: SessionNameRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Update the name of a session."""
    get_session_for_user(db, session_id, current_user["id"])
    cur = db.cursor()
    cur.execute("UPDATE sessions SET session_name = %s WHERE id = %s", (req.session_name, session_id))
    db.commit()
    cur.close()
    return {"message": "Session name updated", "session_name": req.session_name}


# ─────────────────────────────────────────────
# PHASE 1 — SYLLABUS INGESTION
# ─────────────────────────────────────────────

@app.post("/api/syllabus/upload", response_model=SyllabusResponse, tags=["Phase 1 — Syllabus"])
async def upload_syllabus(
    file: UploadFile = File(...),
    session_name: Optional[str] = None,
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a syllabus PDF.
    - pdfplumber extracts raw text
    - Gemini parses topics/subtopics/difficulty into structured JSON
    - Returns session_id used in all subsequent calls
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    content = await file.read()
    raw_text = ""
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    raw_text += text + "\n"
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF parsing failed: {str(e)}")

    if len(raw_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="PDF appears to be scanned/image-based or empty. Text extraction failed."
        )

    prompt = f"""
Extract all subjects, topics, and subtopics from this syllabus text.

Return a JSON object with this exact structure:
{{
  "topics": [
    {{
      "subject": "Subject name",
      "name": "Topic name",
      "subtopics": [
        {{ "name": "Subtopic name", "weightage": "low|medium|high" }}
      ],
      "difficulty": "easy|medium|hard"
    }}
  ]
}}

Rules:
- If weightage is not mentioned, default to "medium"
- If difficulty cannot be inferred, default to "medium"
- Group topics under the correct subject
- Ignore administrative info (dates, exam centers, rules)
- Return only JSON

Syllabus text:
{raw_text[:8000]}
"""

    parsed = call_llm_json(prompt)
    topics_data = parsed.get("topics", [])

    if not topics_data:
        raise HTTPException(
            status_code=422,
            detail="Could not extract topics from the syllabus. Check if the PDF has readable text."
        )

    topics = [Topic(**t) for t in topics_data]
    session_id = generate_session_id()
    now = datetime.now(timezone.utc).isoformat()

    cur = db.cursor()
    cur.execute(
        "INSERT INTO sessions (id, user_id, session_name, created_at, syllabus_raw, topics_json) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (session_id, current_user["id"], session_name, now, raw_text, json.dumps(topics_data))
    )
    db.commit()
    cur.close()

    return SyllabusResponse(
        session_id=session_id,
        topics=topics,
        total_topics=len(topics)
    )


@app.get("/api/syllabus/{session_id}/topics", tags=["Phase 1 — Syllabus"])
def get_topics(session_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Get the extracted topics for a session."""
    row = get_session_for_user(db, session_id, current_user["id"])
    return {"session_id": session_id, "topics": json.loads(row["topics_json"])}


# ─────────────────────────────────────────────
# PHASE 2 — STUDY PLAN GENERATION
# ─────────────────────────────────────────────

@app.post("/api/plan/generate", response_model=StudyPlanResponse, tags=["Phase 2 — Study Plan"])
def generate_study_plan(req: StudyPlanRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Generate a day-by-day study plan.
    - Uses Gemini to schedule topics across available days
    - Harder/weak topics get more days; last 2 days reserved for revision
    """
    row = get_session_for_user(db, req.session_id, current_user["id"])
    topics = json.loads(row["topics_json"])

    if not topics:
        raise HTTPException(status_code=400, detail="No topics found. Upload syllabus first.")

    days_available = (req.exam_date - date.today()).days
    if days_available <= 0:
        raise HTTPException(status_code=400, detail="Exam date must be in the future.")
    if days_available < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 days before the exam.")

    study_days = max(1, days_available - 2)

    prompt = f"""
You are a study planner. Create a detailed day-by-day study schedule.

Input:
- Total study days available: {study_days} days (last 2 days reserved for revision)
- Daily study hours: {req.daily_hours} hours
- Weak subjects (allocate more time): {req.weak_subjects if req.weak_subjects else "none specified"}
- Topics to cover: {json.dumps(topics)}

Rules:
1. Hard topics and weak subjects get more days
2. Each day should have 1-3 topics maximum (depending on hours)
3. Estimated hours per topic: easy=1h, medium=1.5h, hard=2h
4. Do not exceed daily_hours per day
5. Last 2 days must be revision days (topics = ["Full Revision", "Mock Test"])
6. Distribute topics so nothing is crammed on day 1

Return JSON:
{{
  "plan": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "topics": ["Topic name 1"],
      "estimated_hours": 2.5,
      "is_revision": false
    }}
  ]
Start date: {date.today().isoformat()}
Total days in plan (including revision): {days_available}
"""

    try:
        parsed = call_llm_json(prompt)
        if isinstance(parsed, list):
            plan_data = parsed
        else:
            plan_data = parsed.get("plan", [])
            
        if not plan_data:
            raise ValueError("Agent returned an empty plan.")

        plan = [DayPlan(**d) for d in plan_data]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to generate study plan: {str(e)}")
    save_session_field(db, req.session_id, "plan_json", json.dumps(plan_data))
    # Store exam_date for dashboard countdown
    save_session_field(db, req.session_id, "exam_date", req.exam_date.isoformat())

    return StudyPlanResponse(
        session_id=req.session_id,
        total_days=len(plan),
        plan=plan
    )


@app.get("/api/plan/{session_id}", tags=["Phase 2 — Study Plan"])
def get_study_plan(session_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Get the current study plan for a session."""
    row = get_session_for_user(db, session_id, current_user["id"])
    if not row["plan_json"]:
        return {"session_id": session_id, "plan": None}
    return {"session_id": session_id, "plan": json.loads(row["plan_json"])}


# ─────────────────────────────────────────────
# PHASE 3 — FLASHCARD GENERATION (NLP, no API)
# ─────────────────────────────────────────────

@app.post("/api/flashcards/generate", response_model=FlashcardsResponse, tags=["Phase 3 — Flashcards"])
def generate_flashcards(req: FlashcardRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Generate flashcards using rule-based NLP — no external API required.

    How it works:
    1. Sentence-tokenises the raw syllabus text (stored from Phase 1)
    2. Scores each sentence for relevance to the topic using keyword overlap
    3. Applies question templates: definition, cause/effect, process, property, fill-in-the-blank
    4. Falls back to subtopic-name cards and generic templates if sentences are sparse
    5. Assigns SRS difficulty and next_review_day to each card

    All topics are processed instantly — no rate limits, no quota, no API key needed.
    """
    row = get_session_for_user(db, req.session_id, current_user["id"])
    topics = json.loads(row["topics_json"])
    syllabus_raw = row.get("syllabus_raw") or ""

    if not topics:
        raise HTTPException(status_code=400, detail="No topics found. Upload syllabus first.")

    all_decks: list[FlashcardDeck] = []
    all_cards_flat: list[dict] = []

    for topic in topics:
        topic_name = topic.get("name", "Unknown Topic")
        cards = generate_flashcards_nlp(topic, syllabus_raw, req.cards_per_topic)
        if cards:
            all_decks.append(FlashcardDeck(topic=topic_name, cards=cards))
            all_cards_flat.extend([c.model_dump() for c in cards])

    if not all_decks:
        raise HTTPException(status_code=500, detail="Flashcard generation failed for all topics.")

    save_session_field(db, req.session_id, "flashcards_json", json.dumps(all_cards_flat))
    log_study_event(db, current_user["id"], req.session_id, "review", len(all_cards_flat))
    update_streak(db, current_user["id"])

    return FlashcardsResponse(
        session_id=req.session_id,
        total_cards=len(all_cards_flat),
        decks=all_decks
    )


@app.get("/api/flashcards/{session_id}", tags=["Phase 3 — Flashcards"])
def get_flashcards(session_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Get saved flashcards for a session."""
    row = get_session_for_user(db, session_id, current_user["id"])
    if not row["flashcards_json"]:
        raise HTTPException(status_code=404, detail="Flashcards not generated yet.")
    cards = json.loads(row["flashcards_json"])
    return {"session_id": session_id, "total_cards": len(cards), "cards": cards}


# ─────────────────────────────────────────────
# PHASE 3b — FEEDBACK LOOP
# ─────────────────────────────────────────────

@app.post("/api/flashcards/feedback", response_model=FeedbackSummary, tags=["Phase 3b — Feedback Loop"])
def submit_feedback(req: FeedbackRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Submit user feedback on flashcards after a review session.

    - too_easy → SRS interval doubled (resurface less)
    - too_hard → resurface tomorrow; flags topic for plan adaptation
    - skip     → resurface in 2 days

    Submitting feedback for the same card again overwrites previous rating (upsert).
    After collecting feedback, call POST /api/plan/adapt to let the agent rewrite the plan.
    """
    get_session_for_user(db, req.session_id, current_user["id"])
    user_id = current_user["id"]

    cur = db.cursor()
    for item in req.cards:
        item.validate_feedback()
        key = make_card_key(req.session_id, item.topic, item.question)
        cur.execute("""
            INSERT INTO card_feedback
                (session_id, user_id, card_key, topic, question, answer, difficulty, feedback, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (card_key) DO UPDATE SET
                feedback   = EXCLUDED.feedback,
                created_at = EXCLUDED.created_at
        """, (
            req.session_id, user_id, key, item.topic, item.question,
            item.answer, item.difficulty, item.feedback,
            datetime.now(timezone.utc).isoformat()
        ))

    db.commit()
    log_study_event(db, user_id, req.session_id, "feedback", len(req.cards))
    update_streak(db, user_id)

    cur.execute(
        "SELECT topic, feedback FROM card_feedback WHERE session_id = %s",
        (req.session_id,)
    )
    all_fb = cur.fetchall()
    cur.close()

    too_easy  = [r for r in all_fb if r["feedback"] == "too_easy"]
    too_hard  = [r for r in all_fb if r["feedback"] == "too_hard"]
    skipped   = [r for r in all_fb if r["feedback"] == "skip"]
    affected  = list({r["topic"] for r in all_fb})

    return FeedbackSummary(
        session_id=req.session_id,
        total_feedback=len(all_fb),
        too_easy_count=len(too_easy),
        too_hard_count=len(too_hard),
        skip_count=len(skipped),
        affected_topics=affected,
    )


@app.get("/api/feedback/{session_id}", tags=["Phase 3b — Feedback Loop"])
def get_feedback(session_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """View all submitted feedback for a session, grouped by topic."""
    get_session_for_user(db, session_id, current_user["id"])
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM card_feedback WHERE session_id = %s ORDER BY created_at DESC",
        (session_id,)
    )
    rows = cur.fetchall()
    cur.close()

    by_topic: dict = {}
    for r in rows:
        t = r["topic"]
        if t not in by_topic:
            by_topic[t] = {"too_easy": 0, "too_hard": 0, "skip": 0, "cards": []}
        by_topic[t][r["feedback"]] = by_topic[t].get(r["feedback"], 0) + 1
        by_topic[t]["cards"].append({
            "question": r["question"],
            "feedback": r["feedback"],
            "created_at": r["created_at"]
        })

    return {
        "session_id": session_id,
        "total_feedback": len(rows),
        "by_topic": by_topic,
    }


@app.post("/api/plan/adapt", response_model=AdaptPlanResponse, tags=["Phase 3b — Feedback Loop"])
def adapt_plan(req: AdaptPlanRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    The core agentic step. Reads all flashcard feedback and asks Gemini to rewrite the study plan.

    - too_hard topics → more days, moved earlier
    - too_easy topics → days compressed
    - skipped topics  → dedicated re-study day inserted before revision block
    - >30% hard       → extra revision day added at end
    - plan_version increments; changes_summary explains what changed in plain English
    """
    row = get_session_for_user(db, req.session_id, current_user["id"])

    if not row["plan_json"]:
        raise HTTPException(status_code=400, detail="Generate study plan first.")
    if not row["topics_json"]:
        raise HTTPException(status_code=400, detail="No topics found.")

    current_plan = json.loads(row["plan_json"])
    topics = json.loads(row["topics_json"])

    cur = db.cursor()
    cur.execute(
        "SELECT topic, question, difficulty, feedback FROM card_feedback WHERE session_id = %s",
        (req.session_id,)
    )
    feedback_rows = cur.fetchall()
    cur.close()

    if not feedback_rows:
        raise HTTPException(
            status_code=400,
            detail="No feedback submitted yet. Use POST /api/flashcards/feedback first."
        )

    topic_signals: dict = {}
    for r in feedback_rows:
        t = r["topic"]
        if t not in topic_signals:
            topic_signals[t] = {"too_easy": 0, "too_hard": 0, "skip": 0}
        topic_signals[t][r["feedback"]] += 1

    hard_topics    = [t for t, s in topic_signals.items() if s["too_hard"] > s["too_easy"]]
    easy_topics    = [t for t, s in topic_signals.items() if s["too_easy"] > s["too_hard"] and s["too_hard"] == 0]
    skipped_topics = [t for t, s in topic_signals.items() if s["skip"] > 0]

    current_version = row.get("plan_version") or 1
    exam_date = row.get("exam_date") or "the exam date"

    prompt = f"""
You are a study plan agent. A student has been studying and gave feedback on their flashcards.
Your job is to REWRITE the study plan based on their performance signals.

CURRENT PLAN (version {current_version}):
{json.dumps(current_plan, indent=2)}

ALL AVAILABLE TOPICS:
{json.dumps([t.get("name") for t in topics])}

STUDENT PERFORMANCE SIGNALS:
- Topics student struggled with (too_hard): {hard_topics}
- Topics student found easy (too_easy): {easy_topics}
- Topics student skipped (not ready): {skipped_topics}

REWRITING RULES:
1. Hard topics → give MORE days (add 1-2 extra), prioritise early in schedule
2. Easy topics → COMPRESS their days by half; merge with adjacent topics
3. Skipped topics → INSERT a dedicated re-study day before the final revision block
4. If >30% of topics are hard → ADD one extra revision day at the end
5. Keep the exam date constraint: The exam is on {exam_date}. DO NOT add days past this date. The last day of the plan must be before {exam_date}.
6. Keep at least 1 revision day at the end

Return JSON with this exact structure:
{{
  "plan": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "topics": ["Topic A"],
      "estimated_hours": 2.0,
      "is_revision": false
    }}
  ],
  "changes_summary": "Plain English: what changed and why (2-4 sentences)."
}}
"""

    try:
        parsed = call_llm_json(prompt, api_key=req.gemini_api_key)
        if isinstance(parsed, list):
            new_plan_data = parsed
            changes_summary = "Plan updated based on your feedback."
        else:
            new_plan_data   = parsed.get("plan", [])
            changes_summary = parsed.get("changes_summary", "Plan updated based on your feedback.")

        if not new_plan_data:
            raise ValueError("Agent returned an empty plan.")

        new_plan    = [DayPlan(**d) for d in new_plan_data]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Plan adaptation failed: {str(e)}")
    new_version = current_version + 1

    cur = db.cursor()
    cur.execute(
        "UPDATE sessions SET plan_json = %s, plan_version = %s WHERE id = %s",
        (json.dumps(new_plan_data), new_version, req.session_id)
    )
    db.commit()
    cur.close()
    log_study_event(db, current_user["id"], req.session_id, "plan_adapt", 0)

    return AdaptPlanResponse(
        session_id=req.session_id,
        plan_version=new_version,
        total_days=len(new_plan),
        plan=new_plan,
        changes_summary=changes_summary,
    )


@app.get("/api/flashcards/review-queue/{session_id}", tags=["Phase 3b — Feedback Loop"])
def get_review_queue(session_id: str, day_offset: int = 0, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Returns flashcards due for review on a given day (default: today, day_offset=0).
    SRS intervals are adjusted by user feedback.
    Use ?day_offset=1 for tomorrow's queue, etc.
    """
    row = get_session_for_user(db, session_id, current_user["id"])
    if not row["flashcards_json"]:
        raise HTTPException(status_code=404, detail="No flashcards generated yet.")

    all_cards = json.loads(row["flashcards_json"])

    cur = db.cursor()
    cur.execute(
        "SELECT card_key, feedback FROM card_feedback WHERE session_id = %s",
        (session_id,)
    )
    fb_rows = cur.fetchall()
    cur.close()

    feedback_map = {r["card_key"]: r["feedback"] for r in fb_rows}

    due_cards = []
    for card in all_cards:
        key = make_card_key(session_id, card.get("topic", ""), card.get("question", ""))
        user_fb = feedback_map.get(key)
        review_day = srs_with_feedback(card.get("difficulty", "medium"), user_fb)

        if review_day == day_offset or (day_offset == 0 and review_day <= 1):
            due_cards.append({
                **card,
                "user_feedback": user_fb,
                "adjusted_review_day": review_day,
            })

    return {
        "session_id": session_id,
        "day_offset": day_offset,
        "cards_due": len(due_cards),
        "cards": due_cards,
    }


# ─────────────────────────────────────────────
# PHASE 4 — EXPORT
# ─────────────────────────────────────────────

def _build_anki_package(cards: list[dict]) -> bytes:
    deck_id  = random.randrange(1 << 30, 1 << 31)
    model_id = random.randrange(1 << 30, 1 << 31)

    anki_model = genanki.Model(
        model_id,
        "StudyAgent Model",
        fields=[
            {"name": "Question"},
            {"name": "Answer"},
            {"name": "Topic"},
            {"name": "Difficulty"},
        ],
        templates=[{
            "name": "Card 1",
            "qfmt": "<b>{{Topic}}</b><br><br>{{Question}}",
            "afmt": "{{FrontSide}}<hr id=answer>{{Answer}}<br><br><small>Difficulty: {{Difficulty}}</small>",
        }],
        css="""
            .card { font-family: Arial, sans-serif; font-size: 16px; text-align: left; padding: 20px; }
            b { color: #4A90D9; }
            hr { border: 1px solid #eee; }
            small { color: #888; }
        """
    )

    anki_deck = genanki.Deck(deck_id, "StudyAgent — Generated Deck")
    for card in cards:
        note = genanki.Note(
            model=anki_model,
            fields=[
                card.get("question", ""),
                card.get("answer", ""),
                card.get("topic", ""),
                card.get("difficulty", "medium").capitalize(),
            ]
        )
        anki_deck.add_note(note)

    with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as tmp:
        genanki.Package(anki_deck).write_to_file(tmp.name)
        return open(tmp.name, "rb").read()


@app.post("/api/export/anki", tags=["Phase 4 — Export"])
def export_anki(req: ExportRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Export flashcards as an Anki .apkg file. Import into Anki desktop or AnkiMobile."""
    row = get_session_for_user(db, req.session_id, current_user["id"])
    if not row["flashcards_json"]:
        raise HTTPException(status_code=400, detail="Generate flashcards first.")
    cards = json.loads(row["flashcards_json"])
    apkg_bytes = _build_anki_package(cards)
    return StreamingResponse(
        io.BytesIO(apkg_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=studyagent_{req.session_id}.apkg"}
    )


def generate_html_export(row: dict) -> str:
    topics = json.loads(row["topics_json"]) if row.get("topics_json") else []
    plan = json.loads(row["plan_json"]) if row.get("plan_json") else []
    flashcards = json.loads(row["flashcards_json"]) if row.get("flashcards_json") else []
    
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Study Guide & Flashcards</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  body {{ font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #fafaf9; max-width: 1200px; margin: 0 auto; padding: 2rem; background: #1c1917; }}
  h1 {{ font-size: 2.5rem; font-weight: 800; color: #fafaf9; text-align: center; margin-bottom: 2rem; letter-spacing: -0.025em; }}
  h2 {{ font-size: 1.8rem; font-weight: 700; color: #fafaf9; border-bottom: 2px solid #44403c; padding-bottom: 0.5rem; margin-top: 3rem; margin-bottom: 1.5rem; }}
  .plan-grid, .flashcard-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }}
  .day, .card {{ background: #292524; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); border: 1px solid #44403c; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; page-break-inside: avoid; }}
  .day:hover, .card:hover {{ transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.6); border-color: #57534e; }}
  .day h3 {{ margin-top: 0; margin-bottom: 0.5rem; color: #fafaf9; font-size: 1.25rem; font-weight: 800; }}
  .day p {{ color: #d6d3d1; margin-bottom: 0.5rem; }}
  .q {{ font-weight: 700; font-size: 1.15rem; margin-bottom: 12px; color: #fafaf9; flex-grow: 1; }}
  .a {{ margin-bottom: 16px; color: #d6d3d1; font-size: 1rem; flex-grow: 1; border-top: 1px dashed #44403c; padding-top: 12px; }}
  .meta {{ font-size: 0.75rem; font-weight: 600; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 12px; border-top: 1px solid #44403c; }}
  .badge {{ background: #44403c; color: #fafaf9; padding: 4px 10px; border-radius: 9999px; font-weight: 700; }}
  .badge.hard {{ background: #7f1d1d; color: #fecaca; }}
  .badge.easy {{ background: #14532d; color: #bbf7d0; }}
  @media (max-width: 900px) {{ .flashcard-grid, .plan-grid {{ grid-template-columns: repeat(2, 1fr); }} }}
  @media (max-width: 600px) {{ .flashcard-grid, .plan-grid {{ grid-template-columns: 1fr; }} }}
  @media print {{ body {{ background: white; color: black; max-width: 1200px; padding: 0; }} h1, h2, .day h3, .q, .a, .meta, .day p {{ color: black; }} .day, .card {{ background: white; border: 1px solid #ddd; box-shadow: none; break-inside: avoid; }} .a {{ border-top: 1px dashed #ddd; }} .meta {{ border-top: 1px solid #ddd; }} .badge {{ background: #eee; color: #333; }} .badge.hard {{ background: #fecaca; color: #7f1d1d; }} .badge.easy {{ background: #bbf7d0; color: #14532d; }} }}
</style>
</head>
<body>
  <h1>Your Study Guide & Flashcards</h1>
"""
    if plan:
        html += "<h2>Study Plan</h2>\n"
        html += "<div class='plan-grid'>\n"
        for d in plan:
            html += f"<div class='day'><h3>Day {d['day']} ({d['date']})</h3><p><b>Topics:</b> {', '.join(d['topics'])}</p><p><b>Hours:</b> {d['estimated_hours']}h</p></div>\n"
        html += "</div>\n"
            
    if flashcards:
        html += "<h2>Flashcards</h2>\n"
        html += "<div class='flashcard-grid'>\n"
        for c in flashcards:
            q = str(c.get('question','')).replace('<', '&lt;').replace('>', '&gt;')
            a = str(c.get('answer','')).replace('<', '&lt;').replace('>', '&gt;')
            diff = c.get('difficulty', 'medium').lower()
            html += f"<div class='card'><div class='q'>Q: {q}</div><div class='a'>A: {a}</div><div class='meta'><span>{c.get('topic')}</span><span class='badge {diff}'>{diff}</span></div></div>\n"
        html += "</div>\n"
            
    html += "</body></html>"
    return html


@app.post("/api/export/html", tags=["Phase 4 — Export"])
def export_html(req: ExportRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Export everything (topics + plan + flashcards) as a beautifully formatted HTML file."""
    row = get_session_for_user(db, req.session_id, current_user["id"])
    html = generate_html_export(row)
    return StreamingResponse(
        io.BytesIO(html.encode("utf-8")),
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=studyagent_{req.session_id}.html"}
    )


@app.post("/api/export/zip", tags=["Phase 4 — Export"])
def export_zip(req: ExportRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Export everything in a ZIP: Anki .apkg + full JSON + flashcards SVG + plan text."""
    row = get_session_for_user(db, req.session_id, current_user["id"])

    anki_bytes = b""
    if row["flashcards_json"]:
        cards = json.loads(row["flashcards_json"])
        anki_bytes = _build_anki_package(cards)

    plan_text = ""
    if row["plan_json"]:
        for day in json.loads(row["plan_json"]):
            plan_text += f"Day {day['day']} ({day['date']}) — {', '.join(day['topics'])} [{day['estimated_hours']}h]\n"

    export_data = {
        "session_id": req.session_id,
        "topics": json.loads(row["topics_json"]) if row["topics_json"] else [],
        "study_plan": json.loads(row["plan_json"]) if row["plan_json"] else [],
        "flashcards": json.loads(row["flashcards_json"]) if row["flashcards_json"] else [],
    }

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        if anki_bytes:
            zf.writestr("flashcards.apkg", anki_bytes)
            # Add a simple CSV for flashcards so it's readable anywhere
            cards = json.loads(row["flashcards_json"]) if row["flashcards_json"] else []
            csv_text = "Topic,Question,Answer,Difficulty\n"
            for c in cards:
                q = str(c.get('question','')).replace('"', '""')
                a = str(c.get('answer','')).replace('"', '""')
                csv_text += f"\"{c.get('topic')}\",\"{q}\",\"{a}\",\"{c.get('difficulty')}\"\n"
            zf.writestr("flashcards.csv", csv_text)
            
        if plan_text:
            zf.writestr("study_plan.txt", plan_text)
            
        zf.writestr("full_export.json", json.dumps(export_data, indent=2))
        zf.writestr("study_guide.html", generate_html_export(row))
        
        if row["flashcards_json"]:
            fc_cards = json.loads(row["flashcards_json"])
            zf.writestr("flashcards.svg", _build_flashcards_svg(fc_cards))
    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=studyagent_{req.session_id}.zip"}
    )


# ─────────────────────────────────────────────
# SVG EXPORTS (plan + flashcards)
# ─────────────────────────────────────────────

_SUBJECT_PALETTE = [
    "#4F86F7", "#F75C4F", "#34C98A", "#F7A94F",
    "#A64FF7", "#F7D94F", "#4FC3F7", "#F74FA6",
    "#7EE8A2", "#FF8C69",
]

_DIFF_BADGE = {"easy": "#34C98A", "medium": "#F7A94F", "hard": "#F75C4F"}


def _wrap_text(text: str, max_chars: int) -> list[str]:
    words = text.split()
    lines, current = [], ""
    for word in words:
        if len(current) + len(word) + 1 <= max_chars:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def _build_flashcards_svg(cards: list[dict]) -> str:
    CARD_W, CARD_H = 320, 180
    COLS, GAP, PADDING = 2, 20, 30
    W = COLS * CARD_W + (COLS + 1) * GAP
    rows = (len(cards) + COLS - 1) // COLS
    SVG_H = rows * (CARD_H + GAP) + GAP + 70

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{SVG_H}" '
        f'viewBox="0 0 {W} {SVG_H}" font-family="Arial, Helvetica, sans-serif">',
        f'  <rect width="{W}" height="{SVG_H}" fill="#F8FAFC"/>',
        f'  <text x="{W//2}" y="32" font-size="18" font-weight="bold" fill="#1E293B" text-anchor="middle">📚 Flashcard Deck</text>',
        f'  <text x="{W//2}" y="52" font-size="12" fill="#64748B" text-anchor="middle">{len(cards)} cards</text>',
    ]

    for idx, card in enumerate(cards):
        col = idx % COLS
        row = idx // COLS
        cx = GAP + col * (CARD_W + GAP)
        cy = 70 + GAP + row * (CARD_H + GAP)

        diff = card.get("difficulty", "medium").lower()
        strip_color = _DIFF_BADGE.get(diff, "#94A3B8")
        badge_label = diff.upper()

        lines.append(f'  <rect x="{cx}" y="{cy}" width="{CARD_W}" height="{CARD_H}" fill="white" rx="10" stroke="#E2E8F0" stroke-width="1"/>')
        lines.append(f'  <rect x="{cx}" y="{cy}" width="{CARD_W}" height="32" fill="{strip_color}" rx="10"/>')
        lines.append(f'  <rect x="{cx}" y="{cy + 22}" width="{CARD_W}" height="10" fill="{strip_color}"/>')

        topic_label = card.get("topic", "")[:34] + ("…" if len(card.get("topic", "")) > 34 else "")
        lines.append(f'  <text x="{cx + 10}" y="{cy + 20}" font-size="11" font-weight="bold" fill="white">{topic_label}</text>')

        badge_x = cx + CARD_W - 48
        lines.append(f'  <rect x="{badge_x}" y="{cy + 4}" width="42" height="16" fill="white" rx="8" opacity="0.3"/>')
        lines.append(f'  <text x="{badge_x + 21}" y="{cy + 15}" font-size="9" font-weight="bold" fill="white" text-anchor="middle">{badge_label}</text>')

        q_lines = _wrap_text(card.get("question", ""), 44)[:3]
        for li, ql in enumerate(q_lines):
            lines.append(f'  <text x="{cx + 10}" y="{cy + 50 + li * 15}" font-size="11" font-weight="bold" fill="#1E293B">{ql}</text>')

        lines.append(f'  <line x1="{cx + 10}" y1="{cy + 100}" x2="{cx + CARD_W - 10}" y2="{cy + 100}" stroke="#E2E8F0" stroke-width="1"/>')

        a_lines = _wrap_text(card.get("answer", ""), 44)[:3]
        for li, al in enumerate(a_lines):
            lines.append(f'  <text x="{cx + 10}" y="{cy + 116 + li * 14}" font-size="10" fill="#475569">{al}</text>')

        review_day = card.get("next_review_day", 3)
        review_label = f"review in {review_day}d"
        lines.append(f'  <text x="{cx + CARD_W - 10}" y="{cy + CARD_H - 8}" font-size="9" fill="#94A3B8" text-anchor="end">{review_label}</text>')

    lines.append("</svg>")
    return "\n".join(lines)


@app.post("/api/flashcards/export/svg", tags=["Phase 3 — Flashcards"])
def export_flashcards_svg(req: ExportRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Export flashcards as a visual SVG card grid."""
    row = get_session_for_user(db, req.session_id, current_user["id"])
    if not row["flashcards_json"]:
        raise HTTPException(status_code=400, detail="Generate flashcards first.")
    svg_bytes = _build_flashcards_svg(json.loads(row["flashcards_json"])).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(svg_bytes),
        media_type="image/svg+xml",
        headers={"Content-Disposition": f"attachment; filename=flashcards_{req.session_id}.svg"}
    )


def _build_plan_svg(plan: list[dict], topics_meta: list[dict]) -> str:
    from datetime import datetime as dt
    W, HEADER_H, LEGEND_H, ROW_H, FOOTER_H, PADDING = 800, 84, 44, 68, 52, 24

    subject_names = list(dict.fromkeys(t.get("subject", "General") for t in topics_meta))
    subject_colour = {s: _SUBJECT_PALETTE[i % len(_SUBJECT_PALETTE)] for i, s in enumerate(subject_names)}
    topic_subject = {t.get("name", ""): t.get("subject", "General") for t in topics_meta}

    total_rows = len(plan)
    SVG_H = HEADER_H + LEGEND_H + total_rows * ROW_H + FOOTER_H
    total_hours = sum(d.get("estimated_hours", 0) for d in plan)
    study_days  = sum(1 for d in plan if not d.get("is_revision", False))
    revision_days = total_rows - study_days

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{SVG_H}" '
        f'viewBox="0 0 {W} {SVG_H}" font-family="Arial, Helvetica, sans-serif">',
        """  <defs>
    <pattern id="stripe" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="8" fill="#EEF2FF"/>
    </pattern>
  </defs>""",
        f'  <rect width="{W}" height="{SVG_H}" fill="#F8FAFC" rx="12"/>',
        f'  <rect x="0" y="0" width="{W}" height="{HEADER_H}" fill="#1E293B" rx="12"/>',
        f'  <rect x="0" y="{HEADER_H - 12}" width="{W}" height="12" fill="#1E293B"/>',
        f'  <text x="{PADDING}" y="38" font-size="22" font-weight="bold" fill="white">📚 StudyAgent — Study Plan</text>',
        f'  <text x="{PADDING}" y="66" font-size="13" fill="#94A3B8">{study_days} study days · {revision_days} revision days · {total_hours:.1f}h total</text>',
    ]

    lx = PADDING
    ly = HEADER_H + 12
    lines.append(f'  <text x="{lx}" y="{ly + 16}" font-size="11" fill="#64748B" font-weight="bold">SUBJECTS:</text>')
    lx += 72
    for subj, colour in subject_colour.items():
        label = subj[:18] + ("…" if len(subj) > 18 else "")
        lines.append(f'  <rect x="{lx}" y="{ly + 4}" width="12" height="12" fill="{colour}" rx="3"/>')
        lines.append(f'  <text x="{lx + 16}" y="{ly + 15}" font-size="11" fill="#334155">{label}</text>')
        lx += len(label) * 7 + 32
        if lx > W - 160:
            break

    tl_x = 130
    tl_y_start = HEADER_H + LEGEND_H
    tl_y_end   = HEADER_H + LEGEND_H + total_rows * ROW_H
    lines.append(f'  <line x1="{tl_x}" y1="{tl_y_start}" x2="{tl_x}" y2="{tl_y_end}" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="4 4"/>')

    for i, day in enumerate(plan):
        ry = HEADER_H + LEGEND_H + i * ROW_H
        is_revision = day.get("is_revision", False)
        bg_colour = "url(#stripe)" if is_revision else ("white" if i % 2 == 0 else "#F1F5F9")
        lines.append(f'  <rect x="{PADDING}" y="{ry + 4}" width="{W - PADDING * 2}" height="{ROW_H - 8}" fill="{bg_colour}" rx="8" stroke="#E2E8F0" stroke-width="1"/>')
        dot_colour = "#6366F1" if is_revision else "#1E293B"
        lines.append(f'  <circle cx="{tl_x}" cy="{ry + ROW_H // 2}" r="6" fill="{dot_colour}" stroke="white" stroke-width="2"/>')

        date_str = day.get("date", "")
        try:
            d = dt.strptime(date_str, "%Y-%m-%d")
            date_label = d.strftime("%d %b")
            day_label  = d.strftime("%a")
        except Exception:
            date_label = date_str
            day_label  = f"Day {day.get('day', i+1)}"

        pill_x = PADDING + 4
        lines.append(f'  <rect x="{pill_x}" y="{ry + 16}" width="68" height="38" fill="#1E293B" rx="8"/>')
        lines.append(f'  <text x="{pill_x + 34}" y="{ry + 31}" font-size="11" fill="#94A3B8" text-anchor="middle">{day_label}</text>')
        lines.append(f'  <text x="{pill_x + 34}" y="{ry + 46}" font-size="13" font-weight="bold" fill="white" text-anchor="middle">{date_label}</text>')

        chip_x = tl_x + 18
        chip_y = ry + ROW_H // 2 - 11
        topics_list = day.get("topics", [])

        for topic_name in topics_list:
            subj   = topic_subject.get(topic_name, "General")
            colour = subject_colour.get(subj, "#94A3B8")
            label  = topic_name[:28] + ("…" if len(topic_name) > 28 else "")
            chip_w = min(len(label) * 7 + 20, 260)
            if chip_x + chip_w > W - 100:
                lines.append(f'  <text x="{chip_x}" y="{chip_y + 14}" font-size="10" fill="#94A3B8">+{len(topics_list) - topics_list.index(topic_name)} more</text>')
                break
            lines.append(f'  <rect x="{chip_x}" y="{chip_y}" width="{chip_w}" height="22" fill="{colour}22" rx="11" stroke="{colour}" stroke-width="1.5"/>')
            lines.append(f'  <circle cx="{chip_x + 10}" cy="{chip_y + 11}" r="4" fill="{colour}"/>')
            lines.append(f'  <text x="{chip_x + 18}" y="{chip_y + 15}" font-size="11" fill="#1E293B">{label}</text>')
            chip_x += chip_w + 8

        hrs = day.get("estimated_hours", 0)
        badge_label  = "Revision" if is_revision else f"{hrs}h"
        badge_colour = "#6366F1" if is_revision else "#0EA5E9"
        bw = 64 if is_revision else 44
        lines.append(f'  <rect x="{W - PADDING - bw - 4}" y="{ry + 22}" width="{bw}" height="24" fill="{badge_colour}" rx="12"/>')
        lines.append(f'  <text x="{W - PADDING - bw // 2 - 4}" y="{ry + 38}" font-size="11" font-weight="bold" fill="white" text-anchor="middle">{badge_label}</text>')

    fy = HEADER_H + LEGEND_H + total_rows * ROW_H + 12
    lines.append(f'  <rect x="{PADDING}" y="{fy}" width="{W - PADDING * 2}" height="{FOOTER_H - 16}" fill="#1E293B" rx="8"/>')
    lines.append(f'  <text x="{W // 2}" y="{fy + 22}" font-size="12" fill="#94A3B8" text-anchor="middle">Generated by StudyAgent · {datetime.now(timezone.utc).strftime("%d %b %Y")}</text>')
    lines.append(f'  <text x="{W // 2}" y="{fy + 38}" font-size="13" font-weight="bold" fill="white" text-anchor="middle">🎯 {study_days} study days · ⏱ {total_hours:.1f}h · 🔁 {revision_days} revision days</text>')
    lines.append("</svg>")
    return "\n".join(lines)


@app.post("/api/plan/export/svg", tags=["Phase 2 — Study Plan"])
def export_plan_svg(req: ExportRequest, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Export the study plan as a clean SVG timeline diagram."""
    row = get_session_for_user(db, req.session_id, current_user["id"])
    if not row["plan_json"]:
        raise HTTPException(status_code=400, detail="Generate study plan first.")
    plan = json.loads(row["plan_json"])
    topics_meta = json.loads(row["topics_json"]) if row["topics_json"] else []
    svg_bytes = _build_plan_svg(plan, topics_meta).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(svg_bytes),
        media_type="image/svg+xml",
        headers={"Content-Disposition": f"attachment; filename=studyplan_{req.session_id}.svg"}
    )


# ─────────────────────────────────────────────
# UTILITY
# ─────────────────────────────────────────────

@app.get("/api/session/{session_id}", tags=["Utility"])
def get_session_status(session_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Check which phases are complete for a session."""
    row = get_session_for_user(db, session_id, current_user["id"])
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) AS cnt FROM card_feedback WHERE session_id = %s", (session_id,))
    feedback_count = cur.fetchone()["cnt"]
    cur.close()
    return {
        "session_id": session_id,
        "session_name": row.get("session_name"),
        "created_at": row["created_at"],
        "exam_date": row.get("exam_date"),
        "plan_version": row.get("plan_version") or 1,
        "phases_complete": {
            "syllabus_uploaded": bool(row["topics_json"]),
            "plan_generated": bool(row["plan_json"]),
            "flashcards_generated": bool(row["flashcards_json"]),
            "feedback_submitted": feedback_count > 0,
            "plan_adapted": (row.get("plan_version") or 1) > 1,
        },
        "feedback_cards_submitted": feedback_count,
    }


@app.delete("/api/session/{session_id}", tags=["Utility"])
def delete_session(session_id: str, db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Delete a session and all its data (owner only)."""
    get_session_for_user(db, session_id, current_user["id"])
    cur = db.cursor()
    cur.execute("DELETE FROM card_feedback WHERE session_id = %s", (session_id,))
    cur.execute("DELETE FROM study_events WHERE session_id = %s", (session_id,))
    cur.execute("DELETE FROM sessions WHERE id = %s", (session_id,))
    db.commit()
    cur.close()
    return {"message": f"Session '{session_id}' deleted."}


@app.get("/health", tags=["Utility"])
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/", tags=["Utility"])
def root():
    return {
        "message": "StudyAgent API v3",
        "docs": "/docs",
        "auth": [
            "POST /api/auth/register",
            "POST /api/auth/login",
            "POST /api/auth/refresh",
            "POST /api/auth/logout",
            "GET  /api/auth/me",
        ],
        "dashboard": [
            "GET  /api/dashboard              ← full analytics, all sessions",
            "GET  /api/dashboard/session/{id} ← deep single-session analytics",
        ],
        "phases": [
            "POST /api/syllabus/upload              ← Gemini  [auth required]",
            "POST /api/plan/generate                ← Gemini  [auth required]",
            "POST /api/plan/export/svg              ← no API  [auth required]",
            "POST /api/flashcards/generate          ← NLP     [auth required]",
            "POST /api/flashcards/export/svg        ← no API  [auth required]",
            "── FEEDBACK LOOP ──",
            "POST /api/flashcards/feedback          ← no API  [auth required]",
            "GET  /api/feedback/{session_id}        ← no API  [auth required]",
            "POST /api/plan/adapt                   ← Gemini  [auth required]",
            "GET  /api/flashcards/review-queue/{id} ← no API  [auth required]",
            "── EXPORT ──",
            "POST /api/export/anki | /api/export/json | /api/export/zip  [auth required]",
        ]
    }


if __name__ == "__main__":
    import uvicorn
    import sys
    import asyncio
    
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    uvicorn.run(app, host="127.0.0.1", port=8000)