"""
Day 003: 1768.Merge-Strings-Alternately
Difficulty: Easy
"""


# this problem is asking me to merge two strings together in alternating sequence in how the letters are added to the ne combined string until the longest string is exhausted, then append the remaining characters from the longer string.

class Solution:
    def mergeAlternately(self, word1: str, word2: str) -> str:
        merged = []
        i, j = 0, 0
        
        # loop until we reach the end of either string
        while i < len(word1) and j < len(word2):
            merged.append(word1[i])
            merged.append(word2[j])
            i += 1
            j += 1
        
        # append remaining characters from the longer string
        if i < len(word1):
            merged.append(word1[i:])
        if j < len(word2):
            merged.append(word2[j:])
        
        return ''.join(merged)
    


