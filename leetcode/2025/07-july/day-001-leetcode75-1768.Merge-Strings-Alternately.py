### Phase 1: Problem Analysis (15 minutes)

# **Step 1: Read & Restate (5 minutes)**
# - Read problem 3 times

# - Write in ONE sentence:
# Draft: This problem asks me to merge two strings together in alternating the sequence in how the letter are added to new combined sting.
# Edit: This problem asks me to merge two strings by alternating characters from each string, starting with the first string.

# - List inputs: type, format, constraints
# string, letter, lowercase
# - List outputs: type, format, what it represents
# string, letter, lowercase
# - List ALL constraints (array length, value ranges, etc.)
# 1 <= word1.length, word2.length <= 100
# word1 and word2 consist of lowercase English letters.

# **Step 2: Example Breakdown (5 minutes)**
# - Input:  word1 = "abc", word2 = "pqr"
# - Output: "apbqcr"
# - Manual trace: "Given word1 = "abc", word2 = "pqr", I transform it by 
# Draft:
# 1. starting from the first integer of the first string, 
# 2. sumbmitting what that letter is
# 3. moing to the first integer of the second string is
# 4. submitting what that letter is after the letter from the first string
# 5. repeating this until one of the strings runs outs of letter
# 6. if on of the strings is still left with letter when the other does not
# Edit:
# Take first character from word1 ('a')
# Take first character from word2 ('p')
# Take second character from word1 ('b')
# Take second character from word2 ('q')
# Continue until one string is exhausted
# Append remaining characters from the longer string


# - Identify the core transformation happening
# The core transformation is combining two strings but in the specific way of alternating the sequence of how the letters are added

# **Step 3: Pattern & Approach (5 minutes)**
# - Problem type: [Array/String/Tree/Graph/DP/Math/etc.]
# String Manipulation
# - Similar problems: [name specific ones if any]

# - Data structures needed: [be specific - HashMap, Stack, etc.]
# String and two pointers
# - Algorithm family: [Two Pointers, Sliding Window, DFS, BFS, etc.]
# Two Pointers

# ### Phase 2: Solution Design (15 minutes)

# **Step 4: High-Level Strategy (5 minutes)**
# Write exactly 3-5 bullet points:
# - Main approach in one sentence
# Use two pointer to iterate through bother strings simultanoully alternaintg between taking characters from both strings until there are no more characters
# - Key insight or trick
# Loop than append remaing characters
# - Time complexity: O(?)
#O(n + m)
# - Space complexity: O(?)
#O(n + m)

# **Step 5: Detailed Steps (10 minutes)**
# Number each step:
# 1. [Initialization - what variables, what values]
#  Create result string (empty), set pointer i = 0 for word1, set pointer j = 0 for word2
# 2. [Main logic - loop/recursion structure]
# Main alternating loop - While both pointers are within bounds (i < word1.length AND j < word2.length):

# Add word1[i] to result string
# Add word2[j] to result string
# Increment both pointers (i++, j++)
# 3. [Processing - what happens each iteration]
# Handle remaining characters from word1 - While i < word1.length:
# Add word1[i] to result string
# Increment i
# 4. [Termination - when to stop, what to return]
# Handle remaining characters from word2 - While j < word2.length:
# Add word2[j] to result string
# Increment j
# Return result - Return the completed merged string

# ### Phase 3: Implementation (20 minutes)
# **Step 6: Pseudocode (5 minutes)**
# ```
# function solutionName(input):
#     // 1. Initialize: variable = value
#     // 2. Loop: for/while condition
#     // 3. Process: if/else logic
#     // 4. Return: result
# ```


# **Step 7: Code (15 minutes)**
# - Write actual code
# - Say out loud: "I'm creating variable X to track Y because Z"
# - For each line, state WHY you're writing it

class Solution:
    def mergeAlternately(self, word1: str, word2: str) -> str:
        # initialize: screat result string and pointers
        result = ""
        i = 0 # pointer for word1
        j = 0 # pointer for word2

        # loop: alternate while both strings have characters
        while i < len(word1) and j <len(word2):
            result += word1[i] # add char from word1
            result += word2[j] # add char from word2
            i += 1
            j += 1
        
        # process: handle remaing characters from word1
        while i < len(word1):
            result += word1[i]
            i += 1
        # process: handle remaing characters from word1
        while j < len(word2):
            result += word2[j]
            j += 1
        # return: merged string

        return result

