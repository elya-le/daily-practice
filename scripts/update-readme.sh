#!/bin/bash

echo "Updating README stats..."

TOTAL=$(find leetcode -name "day-*.py" -o -name "day-*.js" 2>/dev/null | wc -l)
EASY=$(find leetcode -name "*.py" -o -name "*.js" 2>/dev/null | xargs grep -l "Difficulty: Easy" 2>/dev/null | wc -l)
MEDIUM=$(find leetcode -name "*.py" -o -name "*.js" 2>/dev/null | xargs grep -l "Difficulty: Medium" 2>/dev/null | wc -l)
HARD=$(find leetcode -name "*.py" -o -name "*.js" 2>/dev/null | xargs grep -l "Difficulty: Hard" 2>/dev/null | wc -l)

STREAK=$(git log --oneline --grep="Day [0-9]" --since="30 days ago" | wc -l)

CURRENT_DATE=$(date '+%B %d, %Y')

sed -i.bak "s/\*\*Current Streak\*\*: [0-9]* days/**Current Streak**: $STREAK days/" README.md
sed -i.bak "s/\*\*Problems Solved\*\*: [0-9]* total/**Problems Solved**: $TOTAL total/" README.md
sed -i.bak "s/Easy: [0-9]*/Easy: $EASY/" README.md
sed -i.bak "s/Medium: [0-9]*/Medium: $MEDIUM/" README.md
sed -i.bak "s/Hard: [0-9]*/Hard: $HARD/" README.md
sed -i.bak "s/\*Last updated: .*/\*Last updated: $CURRENT_DATE\*/" README.md

rm README.md.bak 2>/dev/null || true

echo "README updated successfully"
echo "Stats: $TOTAL total problems ($EASY easy, $MEDIUM medium, $HARD hard)"
echo "Streak: $STREAK days"