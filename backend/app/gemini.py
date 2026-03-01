from app.config import settings

if settings.GEMINI_API_KEY:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3-flash-preview")
else:
    model = None

async def generate_goal_plan(user_description, group_theme, constraints):
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