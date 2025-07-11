"""
Day 002: 1071. Greatest Common Divisor of Strings
Difficulty: Easy
"""


# draft: This problem is asking me to find the longest string that can be repeated to creat both input strings
# edit: This problem asked me to find the largest strin that divide both input strins , where "divided" means the string can be repeated to form the original strings

# list inpputs: type, format, contraints
# str1: string, uppercase English letters
# str2: string, uppercase English letters

# list outputs: type, format, what it represents
# represents greatest common divisor string

# list ALL constraints: array length, value ranges, etc.
# 1 <= str1.length, str2.length <= 1000
# str1 and str2 consist of English uppercase letters

# **Step 2: Example Breakdown (5 minutes)**
# - Input: str1 = "ABCABC", str2 = "ABC"
# - Output: "ABC"
# - Manual trace: "Given str1 = "ABCABC", str2 = "ABC", I transform it by
# draft:
# 1. checking if "ABC" can be repeated to make "ABCABC" - yes, "ABC" + "ABC" = "ABCABC"
# 2. checking if "ABC" can be repeated to make "ABC" - yes, "ABC" = "ABC"
# 3. finding the longest such string
# edit:
# check if both strings can be formed by repeating some common pattern
# "ABCABC" = "ABC" repeated 2 times
# "ABC" = "ABC" repeated 1 time
# the common pattern is "ABC"
# verify: str1 + str2 = "ABCABCABC" and str2 + str1 = "ABCABCABC" (they match)
# the GCD of lengths 6 and 3 is 3, so pattern length is 3
# return first 3 characters: "ABC"

# - identify the core transformation happening
# the core transformation is finding the largest repeating substring that can construct both input strings

# 3. pattern & approach 
# - problem type: [array/string/tree/graph/dp/math/etc.]
# string manipulation + math (GCD concept)
# - similar problems: [name specific ones if any]
# greatest common divisor of numbers, string pattern matching
# - data structures needed: [be specific - hashmap, stack, etc.]
# string slicing, GCD function
# - algorithm family: [two pointers, sliding window, DFS, BFS, etc.]
# mathematical approach using GCD


# 4. high-Level strategy - write exactly 3-5 bullet points:
# - main approach in one sentence
# check if strings are compatible using concatenation test, then find GCD of lengths to determine pattern size
# - key insight or trick
# if str1 + str2 == str2 + str1, then they share a common repeating pattern
# - time complexity: O(?)
# O(n + m) where n and m are string lengths
# - space complexity: O(?)
# O(n + m) for string concatenation

# 5. detailed steps - number each step:
# - 1. [initialization - what variables, what values]
# no special initialization needed, work directly with input strings
# - 2. [main logic - loop/recursion structure]
# first check compatibility: if str1 + str2 != str2 + str1, return ""
# - 3. [processing - what happens each iteration]
# calculate GCD of string lengths using euclidean algorithm
# extract substring of length GCD from either string
# - 4. [termination - when to stop, what to return]
# return the substring of length GCD, or empty string if not compatible

# 6. pseudocode 
# ```
# function gcdOfStrings(str1, str2):
#     // 1. Check compatibility
#     if str1 + str2 != str2 + str1:
#         return ""
#     // 2. Find GCD of lengths
#     gcd_length = gcd(len(str1), len(str2))
#     // 3. Return pattern
#     return str1[:gcd_length]
# ```

# 7. code 
# - write actual code
# - say out loud: "I'm creating variable X to track Y because Z"
# - For each line, state WHY you're writing it

class Solution:
  def gcdOfStrings(self, str1: str, str2: str) -> str:
    # check compatibility: if concatenating in different orders gives different results,
    # then no common divisor exists
      if str1 + str2 != str2 + str1:
        return ""
      # helper function to calculate GCD of two numbers
      def gcd(a, b):
        while b:
          a, b = b, a % b
        return a
      # find GCD of string lengths - this will be the length of our answer
      gcd_length = gcd(len(str1), len(str2))

      # return the first gcd_length characters - this is our repeating pattern
      return str1[:gcd_length]


# 8. test with example 
# using example 1: str1 = "ABCABC", str2 = "ABC"
# - str1 + str2 = "ABCABCABC"
# - str2 + str1 = "ABCABCABC"
# - they're equal, so continue
# - gcd(6, 3) = 3
# - str1[:3] = "ABC"
# - expected: "ABC" ✓

# 9. edge cases 
# - no common pattern: "LEET", "CODE" → ""
# - same strings: "ABC", "ABC" → "ABC"
# - single character: "A", "A" → "A"
# - different lengths: "ABCABC", "ABC" → "ABC"
# - empty result: strings with no common divisor → ""