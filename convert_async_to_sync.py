#!/usr/bin/env python3
"""
Script to help automate conversion from Async to Synchronous SQLAlchemy
Usage: python convert_async_to_sync.py <file_path>
"""

import re
import sys
from pathlib import Path


def convert_async_to_sync(file_content: str) -> str:
    """Convert async/await patterns to synchronous patterns."""
    
    # Remove 'async ' from function definitions
    content = re.sub(r'\nasync def ', '\ndef ', file_content)
    content = re.sub(r'^async def ', 'def ', content, flags=re.MULTILINE)
    
    # Remove 'await ' from statements
    content = re.sub(r'\bawait\s+', '', content)
    
    # Update imports
    content = re.sub(
        r'from sqlalchemy\.ext\.asyncio import AsyncSession',
        'from sqlalchemy.orm import Session',
        content
    )
    
    # Update type hints
    content = re.sub(r':\s*AsyncSession', ': Session', content)
    content = re.sub(r'->\s*AsyncSession', '-> Session', content)
    
    return content


def process_file(file_path: str) -> None:
    """Process a single file and convert async to sync."""
    path = Path(file_path)
    
    if not path.exists():
        print(f"Error: File not found: {file_path}")
        sys.exit(1)
    
    if not path.suffix == '.py':
        print(f"Error: Not a Python file: {file_path}")
        sys.exit(1)
    
    # Read file
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Convert content
    converted = convert_async_to_sync(content)
    
    # Save backup
    backup_path = path.with_suffix('.py.backup')
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Backup saved to: {backup_path}")
    
    # Write converted content
    with open(path, 'w', encoding='utf-8') as f:
        f.write(converted)
    print(f"Converted file: {file_path}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python convert_async_to_sync.py <file_path>")
        print("Example: python convert_async_to_sync.py app/repositories/user_repo.py")
        sys.exit(1)
    
    file_path = sys.argv[1]
    process_file(file_path)
    print("Conversion complete!")
