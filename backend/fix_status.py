import re

with open('/home/tanice/Desktop/Kronos/kronos/src/components/StarCreditManager.jsx', 'r') as f:
    text = f.read()

# Add settled status to the colors object if needed, let's check it first
statusColorsMatch = re.search(r'const statusColors = \{.*?\}', text, re.DOTALL)
trailColorsMatch = re.search(r'const trailColors = \{.*?\}', text, re.DOTALL)

# Add status color for settled
if statusColorsMatch and 'settled:' not in statusColorsMatch.group():
    text = text.replace('active: 0x00ff00,', 'active: 0x00ff00,\n  settled: 0x0088ff,')
if trailColorsMatch and 'settled:' not in trailColorsMatch.group():
    text = text.replace('active: 0x33ff33,', 'active: 0x33ff33,\n  settled: 0x33aaff,')

with open('/home/tanice/Desktop/Kronos/kronos/src/components/StarCreditManager.jsx', 'w') as f:
    f.write(text)
