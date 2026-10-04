"""Local-first message risk analysis API."""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Literal
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("trustguard")

MODEL = "qwen2.5:7b"
OLLAMA_URL = "http://localhost:11434/api/generate"


class AnalyzeRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class RiskFactor(BaseModel):
    label: str
    severity: Literal["low", "med", "high"]


class Highlight(BaseModel):
    text: str
    reason: str


class Analysis(BaseModel):
    fraud_score: int = Field(ge=0, le=100)
    classification: Literal["fraud", "legitimate", "uncertain"]
    risk_factors: list[RiskFactor]
    highlights: list[Highlight]
    explanation: str
    recommended_actions: list[str]
    model: str
    latency_ms: int
    ai_status: Literal["online", "fallback"]


RULES: list[tuple[str, str, str, int, str]] = [
    (r"\b(act now|immediately|urgent|within \d+ hours?|expires today|account will be (?:blocked|suspended))\b", "Urgency", "Creates pressure so you act before checking.", 20, "high"),
    (r"\b(kyc|know your customer|account verification|verify your account|bank account blocked|account suspended)\b", "Fake authority", "Claims a bank or service needs urgent account verification.", 22, "high"),
    (r"\b(otp|one[- ]time password|pin|password|upi pin|cvv)\b.{0,40}\b(share|send|reply|provide|enter|confirm|give)\b|\b(share|send|reply|provide|enter|confirm|give)\b.{0,40}\b(otp|one[- ]time password|pin|password|upi pin|cvv)\b", "Credential request", "Asks for a secret that should never be shared with a person.", 34, "high"),
    (r"\b(lottery|prize|won|winner|cashback|refund|free gift|reward)\b.{0,60}\b(claim|collect|click|fee|pay|link)\b|\b(claim|collect)\b.{0,35}\b(prize|lottery|reward|winnings)\b", "Unexpected reward", "A surprise reward tied to a click or payment is a common scam lure.", 24, "high"),
    (r"\b(delivery|courier|parcel|package)\b.{0,50}\b(fee|failed|address|pay|customs|hold)\b", "Delivery fee", "Unexpected parcel fees sent by message should be verified independently.", 22, "med"),
    (r"\b(job|work from home|part[- ]time|recruit)\b.{0,70}\b(earn|salary|deposit|registration fee|training fee|guaranteed)\b", "Unverified job offer", "A job that asks for money or promises easy income deserves extra checking.", 22, "med"),
    (r"\b(click|open|visit)\b.{0,30}\b(link|url|below)\b|https?://(?:bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|rb\.gy)/\S+", "Suspicious link", "A link in an unexpected message can lead to a fake sign-in page.", 22, "high"),
    (r"https?://[^\s/]*?(?:paytm|google|amazon|sbi|hdfc|icici|phonepe)[^\s/]*\.(?:com|in|net)\b", "Lookalike address", "A familiar brand name inside an unfamiliar web address may be impersonation.", 28, "high"),
    (r"\b(send|transfer|pay|deposit)\b.{0,35}\b(money|rupees|rs\.?|₹|upi|fee)\b|\b(upi id|collect request)\b", "Payment request", "Unexpected payment or UPI collect requests need independent verification.", 18, "med"),
]

SAFE_HINT = re.compile(r"\b(otp|one[- ]time password|transaction|debited|credited|order|delivered|statement)\b", re.I)


def rule_analysis(message: str) -> dict:
    found: list[dict] = []
    highlights: list[dict] = []
    score = 8
    for pattern, label, reason, weight, severity in RULES:
        match = re.search(pattern, message, re.I)
        if label == "Credential request" and re.search(r"\bdo not share\b.{0,30}\b(otp|one[- ]time password|pin|password|cvv)\b", message, re.I):
            match = None
        if match:
            score += weight
            found.append({"label": label, "severity": severity})
            highlights.append({"text": match.group(0), "reason": reason})
    if SAFE_HINT.search(message) and not found:
        score = 12
    return {"fraud_score": min(96, score), "risk_factors": found, "highlights": highlights}


def ask_ollama(message: str, rules: dict) -> dict | None:
    schema = {"type": "object", "properties": {
        "fraud_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "classification": {"type": "string", "enum": ["fraud", "legitimate", "uncertain"]},
        "explanation": {"type": "string"},
        "highlights": {"type": "array", "items": {"type": "object", "properties": {"text": {"type": "string"}, "reason": {"type": "string"}}, "required": ["text", "reason"]}},
        "recommended_actions": {"type": "array", "items": {"type": "string"}},
    }, "required": ["fraud_score", "classification", "explanation", "highlights", "recommended_actions"]}
    prompt = (
        "You are a careful fraud analyst. Analyze the message and return JSON matching the schema. "
        "Quote exact suspicious substrings. Legitimate OTP/bank notices without links or requests for secrets score low. "
        "Do not claim to verify the sender. Use simple language. If evidence is mixed, choose uncertain.\n"
        "Examples:\n"
        'Message: "Your bank OTP is 482901. Do not share it." => low, legitimate.\n'
        'Message: "KYC expired. Send your OTP now or account blocked" => high, fraud.\n'
        'Message: "Parcel held. Pay fee at bit.ly/parcel" => high, fraud.\n'
        'Message: "Your card purchase of Rs 240 is complete." => low, legitimate.\n'
        'Message: "Congratulations, claim your prize today" => high, fraud.\n'
        'Message: "Work from home, flexible hours" => uncertain without further evidence.\n'
        f"Rule-based signals: {json.dumps(rules['risk_factors'])}\nMessage: {message}"
    )
    body = json.dumps({"model": MODEL, "prompt": prompt, "format": schema, "stream": False,
                       "options": {"temperature": 0.2, "num_predict": 450}}).encode()
    try:
        with urlopen(Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"}), timeout=4) as response:
            return json.loads(json.loads(response.read()).get("response", "{}"))
    except (URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError):
        return None


app = FastAPI(title="TrustGuard", description="Local-first hybrid scam message screening", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL, "mode": "local Ollama with rule fallback"}


@app.post("/analyze-message", response_model=Analysis)
def analyze(request: AnalyzeRequest) -> Analysis:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Paste a message to analyze.")
    started = time.perf_counter()
    rules = rule_analysis(message)
    ai = ask_ollama(message, rules)
    if ai:
        llm_score = max(0, min(100, int(ai.get("fraud_score", 50))))
        score = round(0.6 * llm_score + 0.4 * rules["fraud_score"])
        classification = "fraud" if score >= 61 else "legitimate" if score < 40 else "uncertain"
        highlights = ai.get("highlights") or rules["highlights"]
        # Never show a model quote as an inline highlight unless it appears in the source.
        highlights = [h for h in highlights if isinstance(h, dict) and h.get("text") and h["text"].casefold() in message.casefold()]
        explanation = str(ai.get("explanation", "The model and safety checks reviewed this message."))
        actions = ai.get("recommended_actions") or ["Do not click links or share passwords, PINs, or OTPs.", "Contact the organization through its official app or number."]
        model, status = MODEL, "online"
    else:
        score = rules["fraud_score"]
        classification = "fraud" if score >= 61 else "legitimate" if score < 40 else "uncertain"
        highlights = rules["highlights"]
        explanation = ("This message has signs commonly used to pressure people into sharing information or money. Verify the sender through an official channel." if score >= 61 else
                       "The message contains a few signals that are worth checking. Avoid links and verify the request directly with the organization." if score >= 40 else
                       "No strong scam signals were found in this text. Still, never share an OTP or password with anyone.")
        actions = ["Do not click unexpected links or share passwords, PINs, or OTPs.", "Contact the organization through its official app or a number you find independently.", "If you already lost money in India, call 1930 or visit cybercrime.gov.in."]
        model, status = "Rule engine (Ollama offline)", "fallback"
    labels = {x["label"] for x in rules["risk_factors"]}
    factors = rules["risk_factors"]
    if ai and not factors:
        factors = [{"label": "Context analysis", "severity": "low"}]
    logger.info("analysis complete chars=%d score=%d mode=%s", len(message), score, status)
    return Analysis(fraud_score=score, classification=classification, risk_factors=factors,
                    highlights=highlights, explanation=explanation, recommended_actions=actions[:4],
                    model=model, latency_ms=round((time.perf_counter() - started) * 1000), ai_status=status)
