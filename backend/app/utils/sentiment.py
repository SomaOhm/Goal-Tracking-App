"""Sentiment analysis utilities for analyzing user messages and feedback."""

import re


def extract_sentiment(text: str) -> dict:
    """
    Simple sentiment analysis based on keywords.
    
    Args:
        text: Text to analyze
        
    Returns:
        Dictionary with sentiment score and label
    """
    positive_words = [
        "good", "great", "excellent", "amazing", "wonderful",
        "happy", "love", "excited", "proud", "accomplished"
    ]
    negative_words = [
        "bad", "terrible", "awful", "hate", "sad", "frustrated",
        "disappointed", "failed", "struggle", "difficult"
    ]
    
    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count > negative_count:
        sentiment = "positive"
        score = min(1.0, positive_count / 5)
    elif negative_count > positive_count:
        sentiment = "negative"
        score = max(-1.0, -negative_count / 5)
    else:
        sentiment = "neutral"
        score = 0.0
    
    return {
        "sentiment": sentiment,
        "score": score,
        "positive_indicators": positive_count,
        "negative_indicators": negative_count
    }


def parse_emotions(text: str) -> list[str]:
    """
    Extract emotional indicators from text.
    
    Args:
        text: Text to analyze
        
    Returns:
        List of detected emotions
    """
    emotions = {
        "joy": ["happy", "joy", "excited", "thrilled"],
        "sadness": ["sad", "depressed", "gloomy"],
        "anger": ["angry", "frustrated", "mad"],
        "fear": ["scared", "worried", "anxious"],
        "confidence": ["confident", "proud", "accomplished"],
        "doubt": ["unsure", "hesitant", "confused"]
    }
    
    detected = []
    text_lower = text.lower()
    
    for emotion, keywords in emotions.items():
        if any(keyword in text_lower for keyword in keywords):
            detected.append(emotion)
    
    return detected
