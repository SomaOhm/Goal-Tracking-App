import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-1.5-pro")

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

    response = model.generate_content(prompt)
    return response.text