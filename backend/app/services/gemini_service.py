"""Gemini AI service for goal planning, progress reviews, and mentor assistance."""

from app.config import settings

if settings.GEMINI_API_KEY:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3-flash-preview")
else:
    model = None


def coach_ask(prompt: str) -> str:
    """Sync call to Gemini for coach/group analysis. Returns reply text or raises."""
    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text if response and response.text else "No response generated."

async def generate_goal_plan(user_description, group_theme, constraints):
    """
    Generate a structured goal plan using Gemini AI.
    
    Args:
        user_description: User's goal description
        group_theme: Theme or context for the goal group
        constraints: Any constraints or limitations
        
    Returns:
        Structured goal plan with subgoals and habits
    """
    prompt = f"""
    You are a structured goal planning assistant.

    Group theme: {group_theme}
    User goal: {user_description}
    Constraints: {constraints}

    Return JSON:
    {{
      "goal": "...",
      "subgoals": [],
      "habits": []
    }}
    """

    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text


async def review_progress(context_summary):
    """
    Review user progress and provide coaching feedback.
    
    Args:
        context_summary: Summary of user's progress data
        
    Returns:
        Coaching feedback with encouragement, adjustments, and action steps
    """
    prompt = f"""
    You are a group accountability coach.
    Review the following progress data and provide:
    1. Encouragement
    2. Adjustments
    3. Specific action steps

    Context:
    {context_summary}
    """
    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text


async def mentor_copilot(context, mentor_message):
    """
    Provide mentor assistance copilot responses.
    
    Args:
        context: Operational data and analytics for the patient
        mentor_message: Message from the mentor
        
    Returns:
        Mentor copilot response with data citations and next steps
    """
    prompt = f"""
    You are a mentor assistant copilot.
    Do not diagnose.
    Cite which data point you used.
    Propose next steps.

    Context:
    {context}

    Mentor message:
    {mentor_message}
    """
    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text
