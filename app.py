"""
VoiceLearn Flask Backend
------------------------
AI Provider Priority:
  1. Gemini  (primary   — user's X-Gemini-Key, or server GEMINI_API_KEY fallback)
  2. ChatGPT (alternative — user's X-Openai-Key, model gpt-4o-mini)
  3. Claude  (premium   — user's X-Claude-Key, model claude-3-5-sonnet)

Routes:
  POST /api/explain        — AI explanation
  POST /api/generate-voice — Murf AI text-to-speech
  POST /api/generate-quiz  — AI-generated MCQ quiz
  GET  /api/health         — Health check

Security: API keys are read from request headers (BYOK) — never stored.
"""

import os
import json
import requests  # type: ignore[import]
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv  # type: ignore[import]
from flask import Flask, request, jsonify  # type: ignore[import]
from flask_cors import CORS  # type: ignore[import]
from flask_sqlalchemy import SQLAlchemy  # type: ignore[import]
from sqlalchemy.orm import Mapped, mapped_column, relationship  # type: ignore[import]
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey  # type: ignore[import]

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///voicelearn.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
]}})
db = SQLAlchemy(app)

# ─────────────────────────────────────────────
# Database Models (SQLAlchemy 2.0 style)
# ─────────────────────────────────────────────

class User(db.Model):  # type: ignore[misc]
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    topics: Mapped[list["Topic"]] = relationship("Topic", back_populates="user")
    quizzes: Mapped[list["Quiz"]] = relationship("Quiz", back_populates="user")


class Topic(db.Model):  # type: ignore[misc]
    __tablename__ = 'topics'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id'), nullable=True)
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    level: Mapped[str] = mapped_column(String(50), nullable=False)
    language: Mapped[str] = mapped_column(String(50), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    provider_used: Mapped[str] = mapped_column(String(20), nullable=False, default='gemini')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user: Mapped[Optional[User]] = relationship("User", back_populates="topics")
    voice_outputs: Mapped[list["VoiceOutput"]] = relationship("VoiceOutput", back_populates="topic")


class VoiceOutput(db.Model):  # type: ignore[misc]
    __tablename__ = 'voice_outputs'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic_id: Mapped[int] = mapped_column(Integer, ForeignKey('topics.id'), nullable=False)
    voice_id: Mapped[str] = mapped_column(String(100), nullable=False)
    audio_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    topic: Mapped[Topic] = relationship("Topic", back_populates="voice_outputs")


class Quiz(db.Model):  # type: ignore[misc]
    __tablename__ = 'quizzes'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id'), nullable=True)
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user: Mapped[Optional[User]] = relationship("User", back_populates="quizzes")
    questions: Mapped[list["QuizQuestion"]] = relationship("QuizQuestion", back_populates="quiz")


class QuizQuestion(db.Model):  # type: ignore[misc]
    __tablename__ = 'quiz_questions'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quiz_id: Mapped[int] = mapped_column(Integer, ForeignKey('quizzes.id'), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[str] = mapped_column(Text, nullable=False)   # JSON array string
    correct_answer: Mapped[int] = mapped_column(Integer, nullable=False)
    quiz: Mapped[Quiz] = relationship("Quiz", back_populates="questions")


# ─────────────────────────────────────────────
# AI Provider Implementations
# ─────────────────────────────────────────────

def call_gemini(prompt: str, api_key: str) -> str:
    """Call Google Gemini API. Primary provider."""
    import google.generativeai as genai  # type: ignore[import]
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content(prompt)
    return str(response.text)


def call_openai(prompt: str, api_key: str) -> str:
    """Call OpenAI ChatGPT API. Alternative provider."""
    from openai import OpenAI  # type: ignore[import]
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
    )
    return str(response.choices[0].message.content)


def call_claude(prompt: str, api_key: str) -> str:
    """Call Anthropic Claude API. Premium provider."""
    import anthropic  # type: ignore[import]
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return str(message.content[0].text)  # type: ignore[index]


def ai_complete(
    prompt: str,
    gemini_key: Optional[str],
    openai_key: Optional[str],
    claude_key: Optional[str],
    preferred_model: str = 'gemini',
) -> tuple[str, str]:
    """
    Route to appropriate AI provider and return (response_text, provider_name).

    Priority:
      • If preferred_model == 'claude' and claude_key set → Claude
      • Elif gemini_key available → Gemini  (primary default)
      • Elif openai_key available → ChatGPT (alternative)
      • Elif claude_key available → Claude  (premium fallback)
      • Else server-side GEMINI_API_KEY env fallback
    """
    # Explicit Claude selection
    if preferred_model == 'claude' and claude_key and claude_key.strip().startswith('sk-ant'):
        return call_claude(prompt, claude_key.strip()), 'claude'

    # Primary: Gemini
    gemini_api_key = (gemini_key or '').strip() or os.getenv('GEMINI_API_KEY', '')
    if gemini_api_key:
        return call_gemini(prompt, gemini_api_key), 'gemini'

    # Alternative: ChatGPT
    if openai_key and openai_key.strip():
        return call_openai(prompt, openai_key.strip()), 'chatgpt'

    # Premium fallback: Claude
    if claude_key and claude_key.strip().startswith('sk-ant'):
        return call_claude(prompt, claude_key.strip()), 'claude'

    raise ValueError(
        "No AI provider available. Add a Gemini, OpenAI, or Claude key in Settings."
    )


# ─────────────────────────────────────────────
# Helper: extract BYOK keys from request headers
# ─────────────────────────────────────────────

def get_keys() -> tuple[Optional[str], Optional[str], Optional[str], str]:
    """Return (gemini_key, openai_key, claude_key, preferred_model) from headers."""
    gemini_key = request.headers.get('X-Gemini-Key') or None
    openai_key = request.headers.get('X-Openai-Key') or None
    claude_key = request.headers.get('X-Claude-Key') or None
    preferred_model = (request.headers.get('X-AI-Model') or 'gemini').lower()
    return gemini_key, openai_key, claude_key, preferred_model


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route('/api/explain', methods=['POST'])
def explain():
    """
    Body: { topic, level, language }
    Headers: X-Gemini-Key | X-Openai-Key | X-Claude-Key, X-AI-Model
    Returns: { explanation, provider }
    """
    data: dict = request.get_json(silent=True) or {}
    topic: str = str(data.get('topic', '')).strip()
    level: str = str(data.get('level', 'Beginner')).strip()
    language: str = str(data.get('language', 'English')).strip()
    gemini_key, openai_key, claude_key, preferred_model = get_keys()

    if not topic:
        return jsonify({'error': 'topic is required'}), 400

    prompt = (
        f"You are an expert tutor. Explain the following topic clearly and engagingly.\n\n"
        f"Topic: {topic}\n"
        f"Level: {level} (adapt complexity accordingly)\n"
        f"Language: {language} (respond entirely in this language)\n\n"
        f"Provide a well-structured explanation in 3-5 paragraphs. "
        f"Use simple analogies where helpful. Do not use markdown headers — plain paragraphs only."
    )

    try:
        explanation, provider = ai_complete(prompt, gemini_key, openai_key, claude_key, preferred_model)
    except Exception as e:
        return jsonify({'error': str(e)}), 502

    # Persist to DB
    try:
        row = Topic(
            topic=topic, level=level, language=language,
            explanation=explanation, provider_used=provider
        )
        db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({'explanation': explanation, 'provider': provider})


@app.route('/api/generate-voice', methods=['POST'])
def generate_voice():
    """
    Body: { text, voiceId? }
    Header: X-Murf-Key
    Returns: { audioUrl }
    """
    data: dict = request.get_json(silent=True) or {}
    text: str = str(data.get('text', '')).strip()
    voice_id: str = str(data.get('voiceId', 'en-US-natalie'))
    murf_key: str = str(request.headers.get('X-Murf-Key', '')).strip()

    if not text:
        return jsonify({'error': 'text is required'}), 400
    if not murf_key:
        return jsonify({'error': 'Murf API key is required (X-Murf-Key header)'}), 401

    text_truncated: str = text[:3000]

    try:
        resp = requests.post(
            'https://api.murf.ai/v1/speech/generate',
            headers={'Content-Type': 'application/json', 'api-key': murf_key},
            json={
                'voiceId': voice_id,
                'text': text_truncated,
                'format': 'MP3',
                'sampleRate': 24000,
                'encodeAsBase64': False
            },
            timeout=30
        )
        resp.raise_for_status()
        result: dict = resp.json()
        audio_url: str = str(
            result.get('audioFile') or result.get('audio_url') or result.get('url', '')
        )
        if not audio_url:
            return jsonify({'error': 'Murf returned no audio URL', 'details': result}), 502
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': f'Murf API error: {e.response.text}'}), 502
    except Exception as e:
        return jsonify({'error': f'Voice generation error: {str(e)}'}), 502

    return jsonify({'audioUrl': audio_url})


@app.route('/api/generate-quiz', methods=['POST'])
def generate_quiz():
    """
    Body: { topic, level? }
    Headers: X-Gemini-Key | X-Openai-Key | X-Claude-Key, X-AI-Model
    Returns: { quiz: [{ question, options, correctAnswer }], provider }
    """
    data: dict = request.get_json(silent=True) or {}
    topic: str = str(data.get('topic', '')).strip()
    level: str = str(data.get('level', 'Beginner')).strip()
    gemini_key, openai_key, claude_key, preferred_model = get_keys()

    if not topic:
        return jsonify({'error': 'topic is required'}), 400

    prompt = (
        f"Create exactly 4 multiple-choice questions to test understanding of: {topic} (level: {level}).\n\n"
        f"Respond ONLY with a valid JSON array. No prose, no markdown, just the array.\n"
        f"Format:\n"
        f'[\n'
        f'  {{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0}}\n'
        f']\n'
        f"correctAnswer is the 0-based index of the correct option."
    )

    try:
        raw, provider = ai_complete(prompt, gemini_key, openai_key, claude_key, preferred_model)
        raw = raw.strip().lstrip('`').rstrip('`')
        if raw.startswith('json'):
            raw = raw[4:].strip()
        quiz: list = json.loads(raw)
        if not isinstance(quiz, list):
            raise ValueError("AI did not return a JSON array")
        for q in quiz:
            assert 'question' in q and 'options' in q and 'correctAnswer' in q
    except Exception as e:
        return jsonify({'error': f'Quiz generation error: {str(e)}'}), 502

    # Persist quiz to DB
    try:
        quiz_row = Quiz(topic=topic)
        db.session.add(quiz_row)
        db.session.flush()
        for q in quiz:
            qq = QuizQuestion(
                quiz_id=quiz_row.id,
                question=str(q['question']),
                options=json.dumps(q['options']),
                correct_answer=int(q['correctAnswer'])
            )
            db.session.add(qq)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({'quiz': quiz, 'provider': provider})


@app.route('/api/health', methods=['GET'])
def health():
    server_gemini = '✅' if os.getenv('GEMINI_API_KEY') else '❌ (add to .env)'
    return jsonify({
        'status': 'ok',
        'version': '2.0.0',
        'providers': {
            'gemini': f'primary — server key: {server_gemini}',
            'chatgpt': 'alternative — user BYOK only',
            'claude': 'premium — user BYOK only',
        }
    })


# ─────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✅ SQLite DB initialised (voicelearn.db)")
        print("📡 AI providers: Gemini (primary) → ChatGPT (alternative) → Claude (premium)")
    app.run(debug=True, port=5000)
