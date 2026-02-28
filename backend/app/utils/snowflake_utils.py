"""Snowflake database utilities and schema setup."""

import os
from app.database import get_snowflake_connection


def get_snowflake_schemas() -> dict:
    """
    Returns DDL statements for Snowflake tables.
    
    Run these once to initialize analytics tables.
    """
    return {
        "dim_users": """
            CREATE TABLE IF NOT EXISTS dim_users (
                user_id STRING PRIMARY KEY,
                mentor_id STRING,
                name STRING,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
            );
        """,
        
        "dim_goals": """
            CREATE TABLE IF NOT EXISTS dim_goals (
                goal_id STRING PRIMARY KEY,
                user_id STRING,
                title STRING,
                category STRING,
                frequency STRING,
                created_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES dim_users(user_id)
            );
        """,
        
        "fact_checkins": """
            CREATE TABLE IF NOT EXISTS fact_checkins (
                checkin_id STRING PRIMARY KEY,
                goal_id STRING,
                user_id STRING,
                completed BOOLEAN,
                timestamp TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
                FOREIGN KEY (goal_id) REFERENCES dim_goals(goal_id),
                FOREIGN KEY (user_id) REFERENCES dim_users(user_id)
            );
        """,
        
        "fact_journal_entries": """
            CREATE TABLE IF NOT EXISTS fact_journal_entries (
                entry_id STRING PRIMARY KEY,
                user_id STRING,
                text STRING,
                sentiment_score FLOAT,
                mood_tags VARIANT,
                created_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES dim_users(user_id)
            );
        """,
        
        "metrics_adherence": """
            CREATE TABLE IF NOT EXISTS metrics_adherence (
                user_id STRING,
                metric_date DATE,
                adherence_7d FLOAT,
                adherence_30d FLOAT,
                adherence_90d FLOAT,
                checkins_completed_7d INT,
                checkins_total_7d INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
                PRIMARY KEY (user_id, metric_date),
                FOREIGN KEY (user_id) REFERENCES dim_users(user_id)
            );
        """,
        
        "metrics_streak": """
            CREATE TABLE IF NOT EXISTS metrics_streak (
                user_id STRING,
                current_streak INT,
                longest_streak INT,
                last_completion TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES dim_users(user_id)
            );
        """,
        
        "metrics_risk": """
            CREATE TABLE IF NOT EXISTS metrics_risk (
                user_id STRING,
                risk_level STRING,  -- low, medium, high
                risk_score FLOAT,
                missed_count_3d INT,
                missed_count_7d INT,
                last_checkin_days_ago INT,
                last_evaluated TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES dim_users(user_id)
            );
        """,
        
        "view_mentor_dashboard": """
            CREATE OR REPLACE VIEW mentor_dashboard AS
            SELECT
                u.mentor_id,
                u.user_id,
                u.name,
                COALESCE(ma.adherence_7d, 0) as adherence_7d,
                COALESCE(ma.adherence_30d, 0) as adherence_30d,
                COALESCE(ms.current_streak, 0) as current_streak,
                COALESCE(mr.risk_level, 'unknown') as risk_level,
                COALESCE(mr.risk_score, 0) as risk_score,
                mr.missed_count_7d,
                mr.last_checkin_days_ago,
                ma.metric_date
            FROM dim_users u
            LEFT JOIN metrics_adherence ma ON u.user_id = ma.user_id
            LEFT JOIN metrics_streak ms ON u.user_id = ms.user_id
            LEFT JOIN metrics_risk mr ON u.user_id = mr.user_id
            WHERE u.mentor_id IS NOT NULL
            ORDER BY mr.risk_score DESC, ma.adherence_7d ASC;
        """
    }


def initialize_snowflake_schema():
    """Create all Snowflake tables and views."""
    conn = get_snowflake_connection()
    cursor = conn.cursor()
    
    try:
        schemas = get_snowflake_schemas()
        for table_name, ddl in schemas.items():
            print(f"Creating {table_name}...")
            cursor.execute(ddl)
        
        conn.commit()
        print("✓ Snowflake schema initialized successfully")
    except Exception as e:
        print(f"✗ Error initializing schema: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def compute_adherence_metrics(user_id: str, days: int = 7):
    """
    Compute adherence score for a user over N days.
    
    Returns percentage of completed check-ins.
    """
    conn = get_snowflake_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(f"""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completed,
                ROUND(100.0 * SUM(CASE WHEN completed THEN 1 ELSE 0 END) / 
                      NULLIF(COUNT(*), 0), 2) as adherence_pct
            FROM fact_checkins
            WHERE user_id = %s
            AND timestamp >= DATEADD(day, -{days}, CURRENT_TIMESTAMP());
        """, (user_id,))
        
        result = cursor.fetchone()
        return {
            "total_checkins": result[0] if result else 0,
            "completed": result[1] if result else 0,
            "adherence_percent": result[2] if result else 0.0
        }
    finally:
        cursor.close()
        conn.close()


def detect_risk_patterns(user_id: str):
    """
    Detect risk patterns for a user.
    
    Returns: risk_level, missed_count, last_checkin_days_ago
    """
    conn = get_snowflake_connection()
    cursor = conn.cursor()
    
    try:
        # Check 7-day missed count
        cursor.execute("""
            SELECT COUNT(*) as missed_count
            FROM fact_checkins
            WHERE user_id = %s
            AND completed = FALSE
            AND timestamp >= DATEADD(day, -7, CURRENT_TIMESTAMP());
        """, (user_id,))
        
        missed_7d = cursor.fetchone()[0]
        
        # Check last checkin date
        cursor.execute("""
            SELECT DATEDIFF(day, MAX(timestamp), CURRENT_TIMESTAMP()) as days_ago
            FROM fact_checkins
            WHERE user_id = %s;
        """, (user_id,))
        
        result = cursor.fetchone()
        days_since_checkin = result[0] if result and result[0] else None
        
        # Determine risk level
        risk_level = "low"
        risk_score = 0.0
        
        if missed_7d >= 4:
            risk_level = "high"
            risk_score = 0.8 + (min(missed_7d - 4, 3) * 0.05)
        elif missed_7d >= 2:
            risk_level = "medium"
            risk_score = 0.5 + (missed_7d * 0.1)
        
        if days_since_checkin and days_since_checkin > 3:
            risk_level = "high"
            risk_score = max(risk_score, 0.7)
        
        return {
            "risk_level": risk_level,
            "risk_score": min(risk_score, 1.0),
            "missed_count_7d": missed_7d,
            "days_since_last_checkin": days_since_checkin or 999
        }
    finally:
        cursor.close()
        conn.close()


def get_mentor_patient_metrics(mentor_id: str):
    """Get aggregated metrics for all patients of a mentor."""
    conn = get_snowflake_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT
                user_id,
                name,
                adherence_7d,
                current_streak,
                risk_level,
                risk_score,
                missed_count_7d,
                last_checkin_days_ago
            FROM mentor_dashboard
            WHERE mentor_id = %s
            ORDER BY risk_score DESC;
        """, (mentor_id,))
        
        results = cursor.fetchall()
        return [
            {
                "user_id": r[0],
                "name": r[1],
                "adherence_7d": r[2],
                "current_streak": r[3],
                "risk_level": r[4],
                "risk_score": r[5],
                "missed_count_7d": r[6],
                "days_since_checkin": r[7]
            }
            for r in results
        ]
    finally:
        cursor.close()
        conn.close()
